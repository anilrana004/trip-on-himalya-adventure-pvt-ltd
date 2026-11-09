package com.securetravels.crm.finance.dto;

public record TeamsSalaryDayResponse(
        String workDate,
        String status,
        int workedMinutes,
        int overtimeMinutes,
        String workedHoursLabel,
        String checkInAt,
        String checkOutAt) {}
