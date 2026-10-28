package com.securetravels.crm.incident.dto;

import com.securetravels.crm.incident.FieldIncident;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record FieldIncidentResponse(
        UUID id,
        UUID bookingId,
        String bookingRef,
        String customerName,
        UUID tripId,
        String tripName,
        UUID batchId,
        LocalDate departureDate,
        FieldIncident.Kind kind,
        String summary,
        LocalDate occurredOn,
        FieldIncident.Status status,
        String resolution,
        String reportedByName,
        Instant createdAt,
        Instant resolvedAt
) {}
