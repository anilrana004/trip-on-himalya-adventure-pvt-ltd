package com.securetravels.crm.lead.dto;

import jakarta.validation.constraints.Size;

import java.time.Instant;

/** Complete or reschedule the lead's scheduled follow-up. */
public record FollowUpActionRequest(
        Instant followUpAt,
        @Size(max = 2000, message = "notes too long")
        String notes
) {
}
