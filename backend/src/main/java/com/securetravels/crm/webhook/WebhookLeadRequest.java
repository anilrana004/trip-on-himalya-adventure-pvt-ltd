package com.securetravels.crm.webhook;

import com.fasterxml.jackson.annotation.JsonAlias;

import java.math.BigDecimal;

/**
 * Public channel lead payload (website form or sibling storefront BFF).
 * Accepts camelCase and legacy snake_case. Validated in {@link WebhookService}.
 */
public record WebhookLeadRequest(
        @JsonAlias("customer_name") String customerName,
        @JsonAlias("mobile_number") String mobileNumber,
        @JsonAlias("whatsapp_number") String whatsappNumber,
        String email,
        @JsonAlias("lead_source") String source,
        String destination,
        /** Optional published trek slug — resolves to tripId for sticky assignment. */
        @JsonAlias("trip_slug") String tripSlug,
        @JsonAlias("num_persons") Integer numPersons,
        BigDecimal budget,
        @JsonAlias("message") String remarks,
        @JsonAlias("consent_given") boolean consentGiven,
        @JsonAlias("consent_scope") String consentScope,
        /**
         * Optional Meta Lead Ads id. When set, intake uses {@code createFromMeta}
         * so Zapier and native Meta share the same external key (dual-path safe).
         */
        @JsonAlias("meta_lead_id") String metaLeadId
) {}
