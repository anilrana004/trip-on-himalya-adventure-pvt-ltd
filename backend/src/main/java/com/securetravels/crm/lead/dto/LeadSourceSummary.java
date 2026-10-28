package com.securetravels.crm.lead.dto;

import com.securetravels.crm.lead.Lead;

/** Enquiries already stored on leads, grouped by the source they arrived from. */
public record LeadSourceSummary(
        Lead.Source source,
        long total,
        long open,
        long quoted,
        long booked,
        long lost
) {
}
