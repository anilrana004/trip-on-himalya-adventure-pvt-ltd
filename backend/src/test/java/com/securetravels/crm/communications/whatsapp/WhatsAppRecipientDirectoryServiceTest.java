package com.securetravels.crm.communications.whatsapp;

import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.communications.TimelineEvent;
import com.securetravels.crm.communications.consent.ConsentService;
import com.securetravels.crm.communications.consent.ConsentStatus;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.lang.reflect.Field;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppRecipientDirectoryServiceTest {

    @Mock private LeadRepository leads;
    @Mock private ConsentService consent;

    private WhatsAppRecipientDirectoryService service;
    private UserPrincipal manager;

    @BeforeEach
    void setUp() {
        service = new WhatsAppRecipientDirectoryService(leads, consent);
        manager = new UserPrincipal(UUID.randomUUID(), "mgr@toh.in", "Mgr", Role.MANAGER, true);
    }

    @Test
    void salesCannotOpenDirectory() {
        UserPrincipal sales = new UserPrincipal(UUID.randomUUID(), "s@toh.in", "S", Role.SALES, true);
        assertThatThrownBy(() -> service.list(sales, null, null, true, 0, 50))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void dedupesSameMobileAndMarksIneligibleWithoutConsent() {
        Lead consented = lead("Anita", "9876543210", null, true, Lead.Status.INTERESTED);
        Lead duplicate = lead("Anita 2", "9876543210", null, false, Lead.Status.NEW);
        Lead noConsent = lead("Ravi", "9123456789", "9123456789", false, Lead.Status.NEW);

        when(leads.findWhatsAppDirectory(isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(consented, duplicate, noConsent)));
        when(consent.effectiveForMobile(eq("9876543210"), eq(TimelineEvent.Channel.WHATSAPP)))
                .thenReturn(ConsentStatus.GRANTED);
        when(consent.effectiveForMobile(eq("9123456789"), eq(TimelineEvent.Channel.WHATSAPP)))
                .thenReturn(ConsentStatus.UNKNOWN);

        Page<WhatsAppRecipientResponse> page = service.list(manager, null, null, false, 0, 50);

        assertThat(page.getTotalElements()).isEqualTo(2);
        WhatsAppRecipientResponse anita = page.getContent().stream()
                .filter(r -> r.mobileDigits().equals("9876543210"))
                .findFirst()
                .orElseThrow();
        assertThat(anita.eligible()).isTrue();
        assertThat(anita.customerName()).isEqualTo("Anita");

        WhatsAppRecipientResponse ravi = page.getContent().stream()
                .filter(r -> r.mobileDigits().equals("9123456789"))
                .findFirst()
                .orElseThrow();
        assertThat(ravi.eligible()).isFalse();
        assertThat(ravi.ineligibleReason()).containsIgnoringCase("consent");
    }

    @Test
    void eligibleOnlyHidesSuppressed() {
        Lead lead = lead("Guest", "9988776655", null, true, Lead.Status.QUOTATION_SENT);
        when(leads.findWhatsAppDirectory(isNull(), isNull(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(lead)));
        when(consent.effectiveForMobile(eq("9988776655"), eq(TimelineEvent.Channel.WHATSAPP)))
                .thenReturn(ConsentStatus.REVOKED);

        Page<WhatsAppRecipientResponse> page = service.list(manager, null, null, true, 0, 50);
        assertThat(page.getTotalElements()).isZero();
    }

    private static Lead lead(String name, String mobile, String wa, boolean consent, Lead.Status status) {
        Lead lead = new Lead();
        try {
            Field id = Lead.class.getDeclaredField("id");
            id.setAccessible(true);
            id.set(lead, UUID.randomUUID());
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        lead.setCustomerName(name);
        lead.setMobileNumber(mobile);
        lead.setMobileDigits(mobile);
        lead.setWhatsappNumber(wa);
        lead.setConsentGiven(consent);
        lead.setStatus(status);
        lead.setHeat(Lead.Heat.WARM);
        lead.setSource(Lead.Source.WEBSITE);
        return lead;
    }
}
