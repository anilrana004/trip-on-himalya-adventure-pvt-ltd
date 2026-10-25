package com.securetravels.crm.attendance.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public record WeeklyOffRequest(@NotNull List<Integer> days) {
}
