package com.securetravels.crm.communications.email;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.communications.SendDecision;
import com.securetravels.crm.communications.SendGateService;
import com.securetravels.crm.communications.SendRequest;
import com.securetravels.crm.communications.SubjectType;
import com.securetravels.crm.communications.TimelineEvent;
import com.securetravels.crm.communications.consent.ConsentService;
import com.securetravels.crm.communications.consent.ConsentStatus;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Manager/Admin bulk email to selected leads. Recipients are snapshotted, then
 * a sweep delivers via Zapier Catch Hook or inline SendGate (SES/sandbox).
 */
@Service
public class BulkEmailCampaignService {

    private static final Logger log = LoggerFactory.getLogger(BulkEmailCampaignService.class);
    private static final int MAX_LEADS = 500;
    private static final Set<Role> MANAGERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final EmailCampaignRepository campaigns;
    private final EmailCampaignRecipientRepository recipients;
    private final LeadRepository leads;
    private final SendGateService sendGate;
    private final ZapierEmailHookClient zapier;
    private final ConsentService consent;
    private final AuditService audit;

    public BulkEmailCampaignService(EmailCampaignRepository campaigns,
                                    EmailCampaignRecipientRepository recipients,
                                    LeadRepository leads,
                                    SendGateService sendGate,
                                    ZapierEmailHookClient zapier,
                                    ConsentService consent,
                                    AuditService audit) {
        this.campaigns = campaigns;
        this.recipients = recipients;
        this.leads = leads;
        this.sendGate = sendGate;
        this.zapier = zapier;
        this.consent = consent;
        this.audit = audit;
    }

    @Transactional
    public BulkEmailCampaignResponse create(BulkEmailCampaignRequest request, UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can launch bulk email campaigns");
        }
        if (request.leadIds().size() > MAX_LEADS) {
            throw new BadRequestException("At most " + MAX_LEADS + " leads per campaign");
        }

        String template = blankToNull(request.templateCode());
        if (template == null) {
            template = "LEAD_FOLLOW_UP";
        }

        EmailCampaign.DeliveryMode mode = request.deliveryMode() == null
                ? EmailCampaign.DeliveryMode.ZAPIER
                : request.deliveryMode();

        EmailCampaign campaign = campaigns.save(new EmailCampaign(
                request.name().trim(),
                template,
                blankToNull(request.subject()),
                blankToNull(request.body()),
                mode,
                caller.id()));

        LinkedHashSet<UUID> unique = new LinkedHashSet<>(request.leadIds());
        List<EmailCampaignRecipient> rows = new ArrayList<>();
        int skippedUpFront = 0;
        for (UUID leadId : unique) {
            Lead lead = leads.findById(leadId).orElse(null);
            if (lead == null
                    || lead.getEmail() == null
                    || lead.getEmail().isBlank()
                    || !lead.isConsentGiven()
                    || consent.effectiveForEmail(lead.getEmail(), TimelineEvent.Channel.EMAIL)
                        == ConsentStatus.REVOKED) {
                skippedUpFront++;
                continue;
            }
            rows.add(new EmailCampaignRecipient(
                    campaign.getId(), lead.getId(), lead.getEmail().trim(), lead.getCustomerName()));
        }
        if (rows.isEmpty()) {
            throw new BadRequestException(
                    "No eligible recipients (need email + consent, and not email-suppressed)");
        }
        recipients.saveAll(rows);
        campaign.setTotalRecipients(rows.size());

        audit.record("EMAIL_CAMPAIGN", campaign.getId(), AuditAction.CREATE, "bulk_email",
                null, "recipients=" + rows.size() + " skipped=" + skippedUpFront + " mode=" + mode);

        log.info("[bulk-email] campaign={} recipients={} skipped={} mode={} by={}",
                campaign.getId(), rows.size(), skippedUpFront, mode, caller.id());
        return BulkEmailCampaignResponse.from(campaign);
    }

    @Transactional(readOnly = true)
    public List<BulkEmailCampaignResponse> list(UserPrincipal caller) {
        requireManager(caller);
        return campaigns.findTop20ByOrderByCreatedAtDesc().stream()
                .map(BulkEmailCampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BulkEmailCampaignResponse get(UUID id, UserPrincipal caller) {
        requireManager(caller);
        EmailCampaign campaign = campaigns.findById(id)
                .orElseThrow(() -> new NotFoundException("Campaign not found"));
        return BulkEmailCampaignResponse.from(campaign);
    }

    /** Process a batch of queued recipients (called by sweep). */
    @Transactional
    public int processBatch(int limit) {
        List<EmailCampaignRecipient> batch = recipients.findByStatusOrderByCreatedAtAsc(
                EmailCampaignRecipient.Status.QUEUED, PageRequest.of(0, limit));
        int done = 0;
        for (EmailCampaignRecipient row : batch) {
            EmailCampaign campaign = campaigns.findById(row.getCampaignId()).orElse(null);
            if (campaign == null || campaign.getStatus() == EmailCampaign.Status.CANCELLED) {
                row.markSkipped("campaign missing or cancelled");
                if (campaign != null) {
                    campaign.incrementSkipped();
                    campaign.markCompletedIfDone();
                }
                done++;
                continue;
            }
            campaign.markRunning();
            try {
                if (campaign.getDeliveryMode() == EmailCampaign.DeliveryMode.ZAPIER) {
                    String ref = zapier.postRecipient(campaign, row);
                    row.markSent(ref);
                    campaign.incrementSent();
                } else {
                    String code = campaign.getTemplateCode() == null ? "LEAD_FOLLOW_UP" : campaign.getTemplateCode();
                    Lead lead = leads.findById(row.getLeadId()).orElse(null);
                    String trek = lead != null && lead.getDestination() != null && !lead.getDestination().isBlank()
                            ? lead.getDestination()
                            : "your Himalayan trek";
                    List<String> values = List.of(trek, row.getCustomerName());

                    SendDecision decision = sendGate.request(SendRequest.email(
                            SubjectType.LEAD, row.getLeadId(), code, row.getEmail(), values, campaign.getCreatedBy()));
                    if (!decision.accepted()) {
                        row.markFailed(decision.reason());
                        campaign.incrementFailed();
                    } else {
                        row.markSent(decision.messageId() == null ? "inline" : decision.messageId().toString());
                        campaign.incrementSent();
                    }
                }
            } catch (Exception ex) {
                row.markFailed(ex.getMessage());
                campaign.incrementFailed();
                log.warn("[bulk-email] recipient={} failed: {}", row.getId(), ex.getMessage());
            }
            campaign.markCompletedIfDone();
            done++;
        }
        return done;
    }

    private static void requireManager(UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can view bulk email campaigns");
        }
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
