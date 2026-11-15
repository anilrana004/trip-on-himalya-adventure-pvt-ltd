package com.securetravels.crm.automation.migrate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.automation.definition.ActionType;
import com.securetravels.crm.automation.definition.WorkflowDefinition;
import com.securetravels.crm.automation.validation.ValidationResult;
import com.securetravels.crm.automation.validation.WorkflowValidator;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.communications.WhatsAppTemplate;
import com.securetravels.crm.communications.thread.CommunicationChannel;
import com.securetravels.crm.communications.WhatsAppTemplateRepository;
import com.securetravels.crm.communications.consent.Purpose;
import com.securetravels.crm.communications.template.ChannelTemplate;
import com.securetravels.crm.communications.template.ChannelTemplateRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MigrateWorkflowTemplatesTest {

    @Mock private WhatsAppTemplateRepository whatsappTemplates;
    @Mock private ChannelTemplateRepository channelTemplates;

    private WorkflowValidator validator;

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        validator = new WorkflowValidator(whatsappTemplates, channelTemplates, props, new ObjectMapper());
        when(whatsappTemplates.findByCodeAndEnabledTrue(eq("BOOKING_CONFIRMED")))
                .thenReturn(Optional.of(new WhatsAppTemplate(
                        "BOOKING_CONFIRMED", "securetravels_booking_confirmed",
                        "Booking confirmed", "en", 4, true)));
        when(channelTemplates.findByChannelAndCode(eq(CommunicationChannel.EMAIL), eq("LEAD_FOLLOW_UP")))
                .thenReturn(Optional.of(ChannelTemplate.of(
                        CommunicationChannel.EMAIL, "LEAD_FOLLOW_UP", "Lead follow-up",
                        Purpose.TRANSACTIONAL, 2, ChannelTemplate.ApprovalStatus.APPROVED)));
    }

    @Test
    void allMigrateTemplatesValidate() {
        for (MigrateWorkflowTemplates.Template template : MigrateWorkflowTemplates.all()) {
            ValidationResult result = validator.validate(template.definition());
            assertThat(result.isValid())
                    .as(() -> template.slug() + ": " + result.issues())
                    .isTrue();
        }
    }

    @Test
    void libraryHasAllThirteenNativeSlugs() {
        assertThat(MigrateWorkflowTemplates.all())
                .extracting(MigrateWorkflowTemplates.Template::slug)
                .containsExactly(
                        "new-lead-speed-to-lead",
                        "follow-up-cadence",
                        "quotation-no-response-chase",
                        "booking-confirmation-send",
                        "balance-due-reminder",
                        "payment-overdue",
                        "booking-confirmed-ops",
                        "batch-scarcity-alert",
                        "lead-booked-cleanup",
                        "lead-lost-cleanup",
                        "lead-soft-duplicate-callback",
                        "ai-follow-up-email",
                        "ai-quotation-chase-email");
    }

    @Test
    void m12AndM13UseAiSendMessage() {
        assertThat(MigrateWorkflowTemplates.m12AiFollowUpEmail().definition().steps().get(0).action())
                .isEqualTo(ActionType.AI_SEND_MESSAGE);
        assertThat(MigrateWorkflowTemplates.m13AiQuotationChase().definition().trigger().event())
                .isEqualTo("lead.quotation");
    }

    @Test
    void m1BranchesFastTrackSla() {
        WorkflowDefinition def = MigrateWorkflowTemplates.m1SpeedToLead().definition();
        assertThat(def.trigger().event()).isEqualTo("lead.created");
        assertThat(def.steps().get(0).action()).isEqualTo(ActionType.BRANCH);
        assertThat(def.steps().stream().filter(s -> "call-fast".equals(s.id())).findFirst())
                .isPresent()
                .get()
                .extracting(s -> s.config().get("slaMinutes"))
                .isEqualTo(10);
    }

    @Test
    void m4SendsBookingConfirmedWhatsApp() {
        WorkflowDefinition def = MigrateWorkflowTemplates.m4BookingConfirmationSend().definition();
        assertThat(def.trigger().event()).isEqualTo("booking.confirmed");
        assertThat(def.steps().get(0).action()).isEqualTo(ActionType.SEND_MESSAGE);
        assertThat(def.steps().get(0).config().get("templateCode")).isEqualTo("BOOKING_CONFIRMED");
    }

    @Test
    void m5AndM6UsePaymentLifecycleEvents() {
        assertThat(MigrateWorkflowTemplates.m5BalanceDueReminder().definition().trigger().event())
                .isEqualTo("payment.due_soon");
        assertThat(MigrateWorkflowTemplates.m6PaymentOverdue().definition().trigger().event())
                .isEqualTo("payment.overdue");
    }

    @Test
    void m10AndM11CoverLostAndSoftDup() {
        assertThat(MigrateWorkflowTemplates.m10LostCleanup().definition().trigger().event())
                .isEqualTo("lead.lost");
        assertThat(MigrateWorkflowTemplates.m11SoftDuplicateCallback().definition().trigger().event())
                .isEqualTo("lead.soft_duplicate");
    }
}
