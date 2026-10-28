package com.securetravels.crm.incident.dto;

import com.securetravels.crm.incident.FieldIncident;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CreateIncidentRequest(
        @NotNull UUID bookingId,
        @NotNull FieldIncident.Kind kind,
        @NotBlank @Size(max = 2000) String summary,
        LocalDate occurredOn
) {}
