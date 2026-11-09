package com.securetravels.crm.finance.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record TeamsSalaryLineResponse(
        UUID id,
        UUID userId,
        String fullName,
        String email,
        String role,
        String periodMonth,
        BigDecimal basicPay,
        BigDecimal allowances,
        BigDecimal deductions,
        BigDecimal netPay,
        String status,
        int workingDays,
        int presentDays,
        int halfDays,
        int leaveDays,
        int absentDays,
        int workedMinutes,
        int overtimeMinutes,
        String workedHoursLabel,
        String overtimeHoursLabel,
        BigDecimal monthlySalaryDefault,
        String paidAt,
        String paymentRef,
        UUID expenseId,
        String notes) {}
