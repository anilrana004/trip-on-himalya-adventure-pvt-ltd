package com.securetravels.crm.lead.dto;

import jakarta.validation.constraints.Size;

/** Soft-delete / archive a lead. */
public record LeadDeleteRequest(
        @Size(max = 500, message = "reason too long")
        String reason
) {
}
