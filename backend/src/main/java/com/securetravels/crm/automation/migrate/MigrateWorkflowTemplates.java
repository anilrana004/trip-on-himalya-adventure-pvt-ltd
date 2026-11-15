package com.securetravels.crm.automation.migrate;

import com.securetravels.crm.automation.definition.ActionType;
import com.securetravels.crm.automation.definition.Condition;
import com.securetravels.crm.automation.definition.ConditionNode;
import com.securetravels.crm.automation.definition.ConditionOp;
import com.securetravels.crm.automation.definition.StepDefinition;
import com.securetravels.crm.automation.definition.TriggerDefinition;
import com.securetravels.crm.automation.definition.WorkflowDefinition;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Native CRM automation library (M1–M11). Seeded ACTIVE by
 * {@link MigrateTemplateBootstrap}; effects apply when dry-run is off and
 * legacy hard-coded MIGRATE paths are gated off.
 */
public final class MigrateWorkflowTemplates {

    private static final List<String> FAST_TRACK_SOURCES = List.of(
            "FACEBOOK_ADS", "INSTAGRAM", "GOOGLE_ADS", "WEBSITE", "STOREFRONT");

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
                m9BookedCleanup(),
                m10LostCleanup(),
                m11SoftDuplicateCallback());
    }

    /** M1 — new lead → INITIAL_CALL +5m; ads/web/storefront SLA 15m else 1h. */
    public static Template m1SpeedToLead() {
        Map<String, Object> branch = new LinkedHashMap<>();
        branch.put("cases", List.of(Map.of(
                "when", conditionMap(ConditionNode.leaf(
                        new Condition("source", ConditionOp.IN, FAST_TRACK_SOURCES))),
                "goto", "call-fast")));
        branch.put("default", "call-std");

        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "New-lead speed-to-lead",
                "Native speed-to-lead: first call in 5 minutes; 15-minute SLA for ads/web/storefront.",
                TriggerDefinition.event("lead.created"),
                null,
                List.of(
                        new StepDefinition("route-sla", 1, ActionType.BRANCH, null, branch, null),
                        task("call-fast", 2, "INITIAL_CALL", "OWNER", 5, null, 10, null, null),
                        notifyOwner(3, "Call within 5 minutes",
                                "New lead assigned to you — call the customer now."),
                        stop(4),
                        task("call-std", 5, "INITIAL_CALL", "OWNER", 5, 1, null, null, null),
                        notifyOwner(6, "Call within 5 minutes",
                                "New lead assigned to you — call the customer now."),
                        stop(7)));
        return new Template("new-lead-speed-to-lead", def.name(), def.description(), def);
    }

    /** M2 — INTERESTED → cancel first-call/callback/cadence, schedule FU 1/3/8/15d. */
    public static Template m2FollowUpCadence() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Follow-up cadence",
                "Native follow-up cadence after INTERESTED.",
                TriggerDefinition.event("lead.interested"),
                null,
                List.of(
                        cancelTypes(1, List.of("INITIAL_CALL", "CALLBACK",
                                "FOLLOW_UP_1D", "FOLLOW_UP_3D", "FOLLOW_UP_8D", "FOLLOW_UP_15D")),
                        task("fu-1d", 2, "FOLLOW_UP_1D", "OWNER", days(1), 24, null, null, null),
                        task("fu-3d", 3, "FOLLOW_UP_3D", "OWNER", days(3), 24, null, null, null),
                        task("fu-8d", 4, "FOLLOW_UP_8D", "OWNER", days(8), 24, null, null, null),
                        task("fu-15d", 5, "FOLLOW_UP_15D", "OWNER", days(15), 24, null, null, null),
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
                "Native quotation chase after QUOTATION_SENT.",
                TriggerDefinition.event("lead.quotation"),
                null,
                List.of(
                        cancelTypes(1, List.of("QUOTATION")),
                        task("quotation", 2, "QUOTATION", "OWNER", days(2), 24, null, null, null),
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
                "Native WhatsApp booking confirmation via SendGate.",
                TriggerDefinition.event("booking.confirmed"),
                null,
                List.of(
                        new StepDefinition("wa-confirm", 1, ActionType.SEND_MESSAGE, null, send, null),
                        stop(2)));
        return new Template("booking-confirmation-send", def.name(), def.description(), def);
    }

    /** M5 — unpaid payment due soon → PAYMENT_REMINDER task (booking-deduped). */
    public static Template m5BalanceDueReminder() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Balance-due reminder",
                "Native balance-due reminder task for unpaid receivables.",
                TriggerDefinition.event("payment.due_soon"),
                null,
                List.of(
                        task("pay-reminder", 1, "PAYMENT_REMINDER", "OWNER", 1, 24, null, null,
                                List.of("PAYMENT_REMINDER")),
                        notifyOwner(2, "Balance payment due",
                                "Chase the unpaid balance on this booking."),
                        stop(3)));
        return new Template("balance-due-reminder", def.name(), def.description(), def);
    }

    /** M6 — payment past due → mark OVERDUE + notify OPS. */
    public static Template m6PaymentOverdue() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Payment overdue marking",
                "Native payment overdue mark + ops notify (sweep still syncs CORE ops mirror).",
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
                "Native OPS prep task + notify (handoff create stays CORE).",
                TriggerDefinition.event("booking.confirmed"),
                null,
                List.of(
                        task("ops-prep", 1, "OPS", "ROLE", null, 48, null, "travelDate",
                                List.of("OPS")),
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
                "Native scarcity notify (latch + audit stay CORE).",
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
                "Native cleanup when a lead is booked.",
                TriggerDefinition.event("lead.booked"),
                null,
                List.of(
                        cancelAll(1),
                        notifyOwner(2, "Booking confirmed — follow-up closed",
                                "No further follow-up needed for this lead."),
                        stop(3)));
        return new Template("lead-booked-cleanup", def.name(), def.description(), def);
    }

    /** M10 — LOST lead → cancel open tasks + notify owner. */
    public static Template m10LostCleanup() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Lead lost cleanup",
                "Native cleanup when a lead is marked lost.",
                TriggerDefinition.event("lead.lost"),
                null,
                List.of(
                        cancelAll(1),
                        notifyOwner(2, "Lead marked lost — follow-ups closed",
                                "No further follow-up for this lead."),
                        stop(3)));
        return new Template("lead-lost-cleanup", def.name(), def.description(), def);
    }

    /** M11 — soft-duplicate inbound → CALLBACK +2h if no open first-call/callback. */
    public static Template m11SoftDuplicateCallback() {
        WorkflowDefinition def = new WorkflowDefinition(
                WorkflowDefinition.CURRENT_SCHEMA_VERSION,
                "Soft-duplicate callback",
                "Native callback when the same mobile hits again on an active lead.",
                TriggerDefinition.event("lead.soft_duplicate"),
                null,
                List.of(
                        task("soft-dup-callback", 1, "CALLBACK", "OWNER", 120, 4, null, null,
                                List.of("INITIAL_CALL", "CALLBACK")),
                        updateFollowUp(2, "today"),
                        notifyOwner(3, "Callback — lead contacted again",
                                "Same number came in again. Call them."),
                        stop(4)));
        return new Template("lead-soft-duplicate-callback", def.name(), def.description(), def);
    }

    private static int days(int d) {
        return d * 24 * 60;
    }

    private static Map<String, Object> conditionMap(ConditionNode node) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("operator", node.operator().name());
        List<Map<String, Object>> leaves = new java.util.ArrayList<>();
        if (node.conditions() != null) {
            for (Condition c : node.conditions()) {
                Map<String, Object> leaf = new LinkedHashMap<>();
                leaf.put("field", c.field());
                leaf.put("op", c.op().name());
                leaf.put("value", c.value());
                leaves.add(leaf);
            }
        }
        map.put("conditions", leaves);
        map.put("children", List.of());
        return map;
    }

    private static StepDefinition task(String id, int order, String type, String assignee,
                                       Integer dueInMinutes, Integer slaHours, Integer slaMinutes,
                                       String dueDateField, List<String> skipIfOpenTypes) {
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
        if (slaHours != null) {
            cfg.put("slaHours", slaHours);
        }
        if (slaMinutes != null) {
            cfg.put("slaMinutes", slaMinutes);
        }
        if (skipIfOpenTypes != null && !skipIfOpenTypes.isEmpty()) {
            cfg.put("skipIfOpenTypes", skipIfOpenTypes);
        }
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
        return new StepDefinition("stop-" + order, order, ActionType.STOP, null, Map.of(), null);
    }
}
