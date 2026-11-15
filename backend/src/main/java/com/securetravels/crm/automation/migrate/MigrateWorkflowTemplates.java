package com.securetravels.crm.automation.migrate;

import com.securetravels.crm.automation.definition.ActionType;
import com.securetravels.crm.automation.definition.StepDefinition;
import com.securetravels.crm.automation.definition.TriggerDefinition;
import com.securetravels.crm.automation.definition.WorkflowDefinition;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Phase 4 MIGRATE template library (M1–M9). Hard-coded services remain live;
 * these definitions activate in dry-run shadow so the engine can prove parity
 * without double side effects.
 */
public final class MigrateWorkflowTemplates {

    public record Template(String slug, String name, String description, WorkflowDefinition definition) {
    }

    private MigrateWorkflowTemplates() {
    }

    public static List<Template> all() {
        return List.of(
                m1SpeedToLead(),
                m2FollowUpCadence(),
                m3QuotationChase(),
                m4BookingConfirmationSend(),
                m5BalanceDueReminder(),
                m6PaymentOverdue(),
                m7BookingConfirmedOps(),
                m8BatchScarcityAlert(),
                m9BookedCleanup());
    }

    /** M1 — new lead → INITIAL_CALL due +5m / SLA +1h + notify owner. */
    public static Template m1SpeedToLead() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "New-lead speed-to-lead",
                "Shadow of FollowUpAutomation.onLeadCreated. Fast-track 15m SLA for ads/web is still hard-coded.",
                TriggerDefinition.event("lead.created"),
                null,
                List.of(
                        task("initial-call", 1, "INITIAL_CALL", "OWNER", 5, 1, null),
                        notifyOwner(2, "Call within 5 minutes",
                                "New lead assigned to you — call the customer now."),
                        stop(3)));
        return new Template("new-lead-speed-to-lead", def.name(), def.description(), def);
    }

    /** M2 — INTERESTED → cancel first-call/callback/cadence, schedule FU 1/3/8/15d. */
    public static Template m2FollowUpCadence() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Follow-up cadence",
                "Shadow of FollowUpAutomation.onInterested.",
                TriggerDefinition.event("lead.interested"),
                null,
                List.of(
                        cancelTypes(1, List.of("INITIAL_CALL", "CALLBACK",
                                "FOLLOW_UP_1D", "FOLLOW_UP_3D", "FOLLOW_UP_8D", "FOLLOW_UP_15D")),
                        task("fu-1d", 2, "FOLLOW_UP_1D", "OWNER", days(1), 24, null),
                        task("fu-3d", 3, "FOLLOW_UP_3D", "OWNER", days(3), 24, null),
                        task("fu-8d", 4, "FOLLOW_UP_8D", "OWNER", days(8), 24, null),
                        task("fu-15d", 5, "FOLLOW_UP_15D", "OWNER", days(15), 24, null),
                        updateFollowUp(6, "today+1"),
                        notifyOwner(7, "Follow-up 1 — tomorrow",
                                "Cadence started — first follow-up is due tomorrow."),
                        stop(8)));
        return new Template("follow-up-cadence", def.name(), def.description(), def);
    }

    /** M3 — QUOTATION_SENT → quotation chase +2d. */
    public static Template m3QuotationChase() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Quotation no-response chase",
                "Shadow of FollowUpAutomation.onQuotationSent.",
                TriggerDefinition.event("lead.quotation"),
                null,
                List.of(
                        cancelTypes(1, List.of("QUOTATION")),
                        task("quotation", 2, "QUOTATION", "OWNER", days(2), 24, null),
                        updateFollowUp(3, "today+2"),
                        notifyOwner(4, "Quotation follow-up",
                                "Send / confirm the quotation for this lead."),
                        stop(5)));
        return new Template("quotation-no-response-chase", def.name(), def.description(), def);
    }

    /** M4 — booking confirmed → WhatsApp BOOKING_CONFIRMED via SendGate. */
    public static Template m4BookingConfirmationSend() {
        Map<String, Object> send = new LinkedHashMap<>();
        send.put("channel", "WHATSAPP");
        send.put("templateCode", "BOOKING_CONFIRMED");
        send.put("purpose", "TRANSACTIONAL");
        send.put("to", "customerMobile");
        send.put("bodyValues", List.of(
                "{customerName}", "{bookingRef}", "{packageName}", "{travelDate}"));
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Booking-confirmation send",
                "Shadow of BookingConfirmationNotifier (AFTER_COMMIT SendGate).",
                TriggerDefinition.event("booking.confirmed"),
                null,
                List.of(
                        new StepDefinition("wa-confirm", 1, ActionType.SEND_MESSAGE, null, send, null),
                        stop(2)));
        return new Template("booking-confirmation-send", def.name(), def.description(), def);
    }

    /** M5 — unpaid payment due soon → PAYMENT_REMINDER task. */
    public static Template m5BalanceDueReminder() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Balance-due reminder",
                "Shadow of PaymentSweep → PaymentService.ensureReminder.",
                TriggerDefinition.event("payment.due_soon"),
                null,
                List.of(
                        task("pay-reminder", 1, "PAYMENT_REMINDER", "OWNER", 1, 24, null),
                        notifyOwner(2, "Balance payment due",
                                "Chase the unpaid balance on this booking."),
                        stop(3)));
        return new Template("balance-due-reminder", def.name(), def.description(), def);
    }

    /** M6 — payment past due → mark OVERDUE (live sweep already did; shadow records intent). */
    public static Template m6PaymentOverdue() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Payment overdue marking",
                "Shadow of PaymentSweep overdue transition + ops payment mirror.",
                TriggerDefinition.event("payment.overdue"),
                null,
                List.of(
                        new StepDefinition("mark-overdue", 1, ActionType.UPDATE_FIELD, null,
                                Map.of("field", "status", "value", "OVERDUE"), null),
                        notifyRole(2, "OPS", "Payment overdue",
                                "A receivable crossed its due date — sync ops payment status."),
                        stop(3)));
        return new Template("payment-overdue", def.name(), def.description(), def);
    }

    /** M7 — booking confirmed → OPS prep task + notify OPS (handoff row stays CORE). */
    public static Template m7BookingConfirmedOps() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "OPS prep on booking confirmed",
                "Shadow of OperationsService.openOpsPrepTask + notifyOps (handoff create stays CORE).",
                TriggerDefinition.event("booking.confirmed"),
                null,
                List.of(
                        task("ops-prep", 1, "OPS", "ROLE", null, 48, "travelDate"),
                        notifyRole(2, "OPS", "New ops handoff",
                                "Booking confirmed — arrange hotel / transport / guide."),
                        stop(3)));
        return new Template("booking-confirmed-ops", def.name(), def.description(), def);
    }

    /** M8 — batch crossed scarcity threshold → notify OPS. */
    public static Template m8BatchScarcityAlert() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Batch scarcity alert",
                "Shadow of CapacityAlertService.onSeatsBooked (latched live path stays authoritative).",
                TriggerDefinition.event("batch.scarcity_alert"),
                null,
                List.of(
                        notifyRole(1, "OPS", "Batch scarcity alert",
                                "A departure crossed the fill threshold — check seats left."),
                        stop(2)));
        return new Template("batch-scarcity-alert", def.name(), def.description(), def);
    }

    /** M9 — BOOKING_CONFIRMED lead → cancel all open follow-ups + notify. */
    public static Template m9BookedCleanup() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Lead booking-confirmed cleanup",
                "Shadow of FollowUpAutomation.onBooked.",
                TriggerDefinition.event("lead.booked"),
                null,
                List.of(
                        cancelAll(1),
                        notifyOwner(2, "Booking confirmed — follow-up closed",
                                "No further follow-up needed for this lead."),
                        stop(3)));
        return new Template("lead-booked-cleanup", def.name(), def.description(), def);
    }

    private static int days(int d) {
        return d * 24 * 60;
    }

    private static StepDefinition task(String id, int order, String type, String assignee,
                                       Integer dueInMinutes, int slaHours, String dueDateField) {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("type", type);
        cfg.put("assignee", assignee);
        if ("ROLE".equals(assignee)) {
            cfg.put("role", "OPS");
        }
        if (dueInMinutes != null) {
            cfg.put("dueInMinutes", dueInMinutes);
        }
        if (dueDateField != null) {
            cfg.put("dueDateField", dueDateField);
        }
        cfg.put("slaHours", slaHours);
        return new StepDefinition(id, order, ActionType.CREATE_TASK, null, cfg, null);
    }

    private static StepDefinition cancelTypes(int order, List<String> types) {
        return new StepDefinition("cancel-" + order, order, ActionType.CANCEL_OPEN_TASKS, null,
                Map.of("types", types), null);
    }

    private static StepDefinition cancelAll(int order) {
        return new StepDefinition("cancel-all", order, ActionType.CANCEL_OPEN_TASKS, null, Map.of(), null);
    }

    private static StepDefinition notifyOwner(int order, String title, String body) {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("target", "OWNER");
        cfg.put("title", title);
        cfg.put("body", body);
        return new StepDefinition("notify-" + order, order, ActionType.NOTIFY_USER, null, cfg, null);
    }

    private static StepDefinition notifyRole(int order, String role, String title, String body) {
        Map<String, Object> cfg = new LinkedHashMap<>();
        cfg.put("role", role);
        cfg.put("title", title);
        cfg.put("body", body);
        return new StepDefinition("notify-" + order, order, ActionType.NOTIFY_USER, null, cfg, null);
    }

    private static StepDefinition updateFollowUp(int order, String value) {
        return new StepDefinition("follow-up-date-" + order, order, ActionType.UPDATE_FIELD, null,
                Map.of("field", "followUpDate", "value", value), null);
    }

    private static StepDefinition stop(int order) {
        return new StepDefinition("stop", order, ActionType.STOP, null, Map.of(), null);
    }
}
