package com.securetravels.crm.dashboard.dto;

import java.math.BigDecimal;

/** Daily/monthly sales-dashboard cards (Module 4) + follow-up SLA queue. */
public record DashboardSummaryResponse(
        String period,
        java.time.LocalDate from,
        long totalLeads,
        long newLeads,
        long followUpDue,
        long interested,
        long quotationSent,
        long bookingConfirmed,
        long lost,
        long newBookings,
        long confirmedBookings,
        BigDecimal revenue,
        /** Open INITIAL_CALL tasks — sales has not marked first call done. */
        long firstCallPending,
        /** Open INITIAL_CALL past dueAt — queue not clearing in 5 minutes. */
        long firstCallOverdue,
        /** NEW paid-ad / website / storefront leads still uncontacted (hot queue). */
        long hotUncalled,
        /** Open cadence follow-ups past due (manager SLA view). */
        long followUpOverdue,
        /** Open tasks that already breached sla_deadline (escalated or pending escalate). */
        long slaBreached
) {
}
