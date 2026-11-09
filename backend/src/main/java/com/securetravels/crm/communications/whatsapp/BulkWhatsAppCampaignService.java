package com.securetravels.crm.communications.whatsapp;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.PhoneUtils;
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
 * Manager/Admin bulk WhatsApp to selected leads. Recipients snapshotted, then
 * a sweep delivers via Zapier Catch Hook or inline SendGate (Interakt/sandbox).
 */
@Service
public class BulkWhatsAppCampaignService {

    private static final Logger log = LoggerFactory.getLogger(BulkWhatsAppCampaignService.class);
    private static final int MAX_LEADS = 500;
    private static final Set<Role> MANAGERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final WhatsAppCampaignRepository campaigns;
    private final WhatsAppCampaignRecipientRepository recipients;
    private final LeadRepository leads;
    private final SendGateService sendGate;
    private final ZapierWhatsAppHookClient zapier;
    private final ConsentService consent;
    private final AuditService audit;

    public BulkWhatsAppCampaignService(WhatsAppCampaignRepository campaigns,
                                       WhatsAppCampaignRecipientRepository recipients,
                                       LeadRepository leads,
                                       SendGateService sendGate,
                                       ZapierWhatsAppHookClient zapier,
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
    public BulkWhatsAppCampaignResponse create(BulkWhatsAppCampaignRequest request, UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can launch bulk WhatsApp campaigns");
        }
        if (request.leadIds().size() > MAX_LEADS) {
            throw new BadRequestException("At most " + MAX_LEADS + " leads per campaign");
        }

        String template = blankToNull(request.templateCode());
        if (template == null) {
            template = "LEAD_FOLLOW_UP";
        }

        WhatsAppCampaign.DeliveryMode mode = request.deliveryMode() == null
                ? WhatsAppCampaign.DeliveryMode.ZAPIER
                : request.deliveryMode();

        WhatsAppCampaign campaign = campaigns.save(new WhatsAppCampaign(
                request.name().trim(),
                template,
                blankToNull(request.body()),
                mode,
                caller.id()));

        LinkedHashSet<UUID> unique = new LinkedHashSet<>(request.leadIds());
        List<WhatsAppCampaignRecipient> rows = new ArrayList<>();
        int skippedUpFront = 0;
        for (UUID leadId : unique) {
            Lead lead = leads.findById(leadId).orElse(null);
            String rawMobile = resolveMobile(lead);
            String digits = rawMobile == null ? null : PhoneUtils.normalize(rawMobile);
            if (lead == null
                    || digits == null
                    || !lead.isConsentGiven()
                    || consent.effectiveForMobile(digits, TimelineEvent.Channel.WHATSAPP)
                        == ConsentStatus.REVOKED) {
                skippedUpFront++;
                continue;
            }
            rows.add(new WhatsAppCampaignRecipient(
                    campaign.getId(), lead.getId(), digits, lead.getCustomerName()));
        }
        if (rows.isEmpty()) {
            throw new BadRequestException(
                    "No eligible recipients (need WhatsApp/mobile + consent, and not WA-suppressed)");
        }
        recipients.saveAll(rows);
        campaign.setTotalRecipients(rows.size());

        audit.record("WHATSAPP_CAMPAIGN", campaign.getId(), AuditAction.CREATE, "bulk_whatsapp",
                null, "recipients=" + rows.size() + " skipped=" + skippedUpFront + " mode=" + mode);

        log.info("[bulk-whatsapp] campaign={} recipients={} skipped={} mode={} by={}",
                campaign.getId(), rows.size(), skippedUpFront, mode, caller.id());
        return BulkWhatsAppCampaignResponse.from(campaign);
    }

    @Transactional(readOnly = true)
    public List<BulkWhatsAppCampaignResponse> list(UserPrincipal caller) {
        requireManager(caller);
        return campaigns.findTop20ByOrderByCreatedAtDesc().stream()
                .map(BulkWhatsAppCampaignResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public BulkWhatsAppCampaignResponse get(UUID id, UserPrincipal caller) {
        requireManager(caller);
        WhatsAppCampaign campaign = campaigns.findById(id)
                .orElseThrow(() -> new NotFoundException("Campaign not found"));
        return BulkWhatsAppCampaignResponse.from(campaign);
    }

    @Transactional
    public int processBatch(int limit) {
        List<WhatsAppCampaignRecipient> batch = recipients.findByStatusOrderByCreatedAtAsc(
                WhatsAppCampaignRecipient.Status.QUEUED, PageRequest.of(0, limit));
        int done = 0;
        for (WhatsAppCampaignRecipient row : batch) {
            WhatsAppCampaign campaign = campaigns.findById(row.getCampaignId()).orElse(null);
            if (campaign == null || campaign.getStatus() == WhatsAppCampaign.Status.CANCELLED) {
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
                if (campaign.getDeliveryMode() == WhatsAppCampaign.DeliveryMode.ZAPIER) {
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

                    SendDecision decision = sendGate.request(SendRequest.whatsappTemplate(
                            SubjectType.LEAD, row.getLeadId(), code, row.getMobile(), values, campaign.getCreatedBy()));
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
                log.warn("[bulk-whatsapp] recipient={} failed: {}", row.getId(), ex.getMessage());
            }
            campaign.markCompletedIfDone();
            done++;
        }
        return done;
    }

    private static String resolveMobile(Lead lead) {
        if (lead == null) return null;
        if (lead.getWhatsappNumber() != null && !lead.getWhatsappNumber().isBlank()) {
            return lead.getWhatsappNumber();
        }
        return lead.getMobileNumber();
    }

    private static void requireManager(UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can view bulk WhatsApp campaigns");
        }
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
