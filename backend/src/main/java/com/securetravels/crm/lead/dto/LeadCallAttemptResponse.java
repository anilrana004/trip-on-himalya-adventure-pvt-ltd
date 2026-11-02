package com.securetravels.crm.lead.dto;

import com.securetravels.crm.lead.LeadCallAttempt;

import java.time.Instant;
import java.util.UUID;

public record LeadCallAttemptResponse(
        UUID id,
        UUID leadId,
        UUID actorId,
        String actorName,
        LeadCallAttempt.Outcome outcome,
        String notes,
        Instant createdAt
) {}
