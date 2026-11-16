package com.securetravels.crm.communications.whatsapp;

import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.util.PhoneUtils;
import com.securetravels.crm.communications.TimelineEvent;
import com.securetravels.crm.communications.consent.ConsentService;
import com.securetravels.crm.communications.consent.ConsentStatus;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Manager desk: collect WhatsApp/mobile numbers already on leads (deduped by digits)
 * so bulk campaigns can select everyone without a second contact store.
 */
@Service
public class WhatsAppRecipientDirectoryService {

    private static final Set<Role> MANAGERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);
    /** Hard cap so the desk stays snappy; managers refine with search/status. */
    private static final int SCAN_LIMIT = 2_000;

    private final LeadRepository leads;
    private final ConsentService consent;

    public WhatsAppRecipientDirectoryService(LeadRepository leads, ConsentService consent) {
        this.leads = leads;
        this.consent = consent;
    }

    @Transactional(readOnly = true)
    public Page<WhatsAppRecipientResponse> list(UserPrincipal caller,
                                                String search,
                                                Lead.Status status,
                                                Boolean eligibleOnly,
                                                int page,
                                                int size) {
        requireManager(caller);
        int safeSize = Math.min(Math.max(size, 1), 200);
        int safePage = Math.max(page, 0);

        String q = blankToNull(search);
        Pageable scan = PageRequest.of(0, SCAN_LIMIT);
        Page<Lead> raw = leads.findWhatsAppDirectory(
                status == null ? null : status.name(),
                q,
                scan);

        Map<String, WhatsAppRecipientResponse> byDigits = new LinkedHashMap<>();
        for (Lead lead : raw.getContent()) {
            WhatsAppRecipientResponse row = toRow(lead);
            if (row == null) continue;
            WhatsAppRecipientResponse existing = byDigits.get(row.mobileDigits());
            if (existing == null || prefer(row, existing)) {
                byDigits.put(row.mobileDigits(), row);
            }
        }

        List<WhatsAppRecipientResponse> filtered = new ArrayList<>();
        for (WhatsAppRecipientResponse row : byDigits.values()) {
            if (Boolean.TRUE.equals(eligibleOnly) && !row.eligible()) continue;
            filtered.add(row);
        }

        int from = Math.min(safePage * safeSize, filtered.size());
        int to = Math.min(from + safeSize, filtered.size());
        List<WhatsAppRecipientResponse> slice = filtered.subList(from, to);
        return new PageImpl<>(slice, PageRequest.of(safePage, safeSize), filtered.size());
    }

    @Transactional(readOnly = true)
    public WhatsAppRecipientSummary summary(UserPrincipal caller) {
        requireManager(caller);
        Page<Lead> raw = leads.findWhatsAppDirectory(null, null, PageRequest.of(0, SCAN_LIMIT));
        Map<String, WhatsAppRecipientResponse> byDigits = new LinkedHashMap<>();
        for (Lead lead : raw.getContent()) {
            WhatsAppRecipientResponse row = toRow(lead);
            if (row == null) continue;
            WhatsAppRecipientResponse existing = byDigits.get(row.mobileDigits());
            if (existing == null || prefer(row, existing)) {
                byDigits.put(row.mobileDigits(), row);
            }
        }
        long eligible = byDigits.values().stream().filter(WhatsAppRecipientResponse::eligible).count();
        long consented = byDigits.values().stream().filter(WhatsAppRecipientResponse::consentGiven).count();
        return new WhatsAppRecipientSummary(byDigits.size(), consented, eligible, raw.getTotalElements());
    }

    private WhatsAppRecipientResponse toRow(Lead lead) {
        String rawMobile = resolveMobile(lead);
        String digits = rawMobile == null ? null : PhoneUtils.normalize(rawMobile);
        if (digits == null || digits.length() < 10) {
            return null;
        }
        boolean consentGiven = lead.isConsentGiven();
        ConsentStatus wa = consent.effectiveForMobile(digits, TimelineEvent.Channel.WHATSAPP);
        String reason = null;
        boolean eligible = true;
        if (!consentGiven) {
            eligible = false;
            reason = "No consent on the lead";
        } else if (wa == ConsentStatus.REVOKED) {
            eligible = false;
            reason = "WhatsApp suppressed";
        }
        return new WhatsAppRecipientResponse(
                lead.getId(),
                lead.getCustomerName(),
                rawMobile.trim(),
                digits,
                consentGiven,
                eligible,
                reason,
                lead.getStatus().name(),
                lead.getHeat().name(),
                lead.getSource().name(),
                lead.getDestination(),
                lead.getOwnerId(),
                lead.getCreatedAt());
    }

    /** Prefer eligible/open pipeline rows when the same mobile appears on several leads. */
    private static boolean prefer(WhatsAppRecipientResponse candidate, WhatsAppRecipientResponse current) {
        int c = rank(candidate);
        int u = rank(current);
        if (c != u) return c > u;
        java.time.Instant a = candidate.createdAt() == null ? java.time.Instant.EPOCH : candidate.createdAt();
        java.time.Instant b = current.createdAt() == null ? java.time.Instant.EPOCH : current.createdAt();
        return a.isAfter(b);
    }

    private static int rank(WhatsAppRecipientResponse row) {
        int score = row.eligible() ? 100 : 0;
        score += switch (row.status()) {
            case "NEW", "INTERESTED" -> 40;
            case "QUOTATION_SENT" -> 30;
            case "BOOKING_CONFIRMED" -> 10;
            default -> 0;
        };
        return score;
    }

    private static String resolveMobile(Lead lead) {
        if (lead.getWhatsappNumber() != null && !lead.getWhatsappNumber().isBlank()) {
            return lead.getWhatsappNumber();
        }
        return lead.getMobileNumber();
    }

    private static void requireManager(UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can open the WhatsApp numbers desk");
        }
    }

    private static String blankToNull(String v) {
        if (v == null) return null;
        String t = v.trim();
        return t.isEmpty() ? null : t.toLowerCase(Locale.ROOT);
    }

    public record WhatsAppRecipientSummary(
            long uniqueNumbers,
            long consented,
            long eligible,
            long leadRowsScanned
    ) {}
}
