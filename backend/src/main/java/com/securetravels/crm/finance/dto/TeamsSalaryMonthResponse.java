package com.securetravels.crm.finance.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

public record TeamsSalaryMonthResponse(
        String month,
        Totals totals,
        List<TeamsSalaryLineResponse> lines,
        Map<String, Long> byRole,
        String message) {

    public record Totals(
            long headcount,
            long paidCount,
            long draftCount,
            BigDecimal totalNet,
            BigDecimal paidNet,
            int totalWorkedMinutes,
            String totalWorkedHoursLabel) {}
}
