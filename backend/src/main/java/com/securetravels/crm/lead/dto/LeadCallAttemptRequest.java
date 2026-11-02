package com.securetravels.crm.lead.dto;

import com.securetravels.crm.lead.LeadCallAttempt;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record LeadCallAttemptRequest(
        @NotNull(message = "outcome is required")
        LeadCallAttempt.Outcome outcome,

        @Size(max = 2000, message = "notes too long")
        String notes
) {}
