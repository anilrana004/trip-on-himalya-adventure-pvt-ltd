package com.securetravels.crm.dashboard.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** Daily/monthly sales-dashboard cards (Module 4). */
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
        /** NEW paid-ad / website leads still uncontacted (hot queue). */
        long hotUncalled
) {
}