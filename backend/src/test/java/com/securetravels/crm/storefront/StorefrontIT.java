package com.securetravels.crm.storefront;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.greaterThanOrEqualTo;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Public storefront catalogue must work without a JWT — the customer site is
 * a separate Vercel app that only reads live trips.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class StorefrontIT {

    @Autowired MockMvc mockMvc;

    @Test
    @DisplayName("GET /api/storefront/trips is public and returns live cards")
    void listsPublicTripsWithoutAuth() throws Exception {
        mockMvc.perform(get("/api/storefront/trips"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
                .andExpect(jsonPath("$[0].slug").isNotEmpty())
                .andExpect(jsonPath("$[0].fromPriceInr").isNumber())
                .andExpect(jsonPath("$[0].contentBrief").doesNotExist());
    }

    @Test
    @DisplayName("GET /api/storefront/trips/{slug} returns detail without CRM notes")
    void tripDetailBySlug() throws Exception {
        mockMvc.perform(get("/api/storefront/trips/kedarkantha-trek"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Kedarkantha Trek"))
                .andExpect(jsonPath("$.itinerary").isNotEmpty())
                .andExpect(jsonPath("$.contentBrief").doesNotExist());
    }

    @Test
    @DisplayName("unknown slug → 404")
    void missingSlug404() throws Exception {
        mockMvc.perform(get("/api/storefront/trips/no-such-trek-zzzz"))
                .andExpect(status().isNotFound());
    }
}
