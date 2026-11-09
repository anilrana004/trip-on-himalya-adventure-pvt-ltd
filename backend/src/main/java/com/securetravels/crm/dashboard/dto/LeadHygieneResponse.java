package com.securetravels.crm.dashboard.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Manager/admin sales accountability: on-time follow-up hygiene per salesperson,
 * attention queue (leads needing action), and recent team updates. All numbers
 * come from leads + tasks + lead_call_attempts + audit_log — no second store.
 */
public record LeadHygieneResponse(
        String scope,
        Instant asOf,
        Totals totals,
        List<OwnerRow> owners,
        List<AttentionLead> attention,
        List<UpdateEvent> feed) {

    public record Totals(
            long openTasks,
            long overdueTasks,
            long slaBreachedOpen,
            long firstCallPending,
            long firstCallOverdue,
            long hotUncalled,
            long quietLeads24h,
            long callsLoggedToday,
            long completedOnTimeToday,
            long completedLateToday) {
    }

    public record OwnerRow(
            UUID ownerId,
            String fullName,
            String email,
            long openLeads,
            long openTasks,
            long overdueTasks,
            long slaBreachedOpen,
            long firstCallPending,
            long firstCallOverdue,
            long hotUncalled,
            long quietLeads24h,
            long callsLoggedToday,
            long completedOnTimeToday,
            long completedLateToday,
            Double avgMinutesToFirstContact,
            int onTimePct) {
    }

    public record AttentionLead(
            UUID leadId,
            String customerName,
            String phone,
            String status,
            String source,
            UUID ownerId,
            String ownerName,
            String heat,
            Instant lastContactedAt,
            long callCount,
            String nextTaskType,
            String nextTaskStatus,
            Instant dueAt,
            Instant slaDeadline,
            Instant escalatedAt,
            String reason) {
    }

    public record UpdateEvent(
            Instant at,
            String kind,
            UUID leadId,
            String customerName,
            UUID actorId,
            String actorName,
            String summary) {
    }
}
