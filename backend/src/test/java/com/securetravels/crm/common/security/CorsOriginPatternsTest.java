package com.securetravels.crm.common.security;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CorsOriginPatternsTest {

    @Test
    @DisplayName("exact Vercel production origin expands to preview pattern")
    void expandsVercelPreview() {
        List<String> out = CorsOriginPatterns.expand(
                List.of("https://trip-on-himalaya.vercel.app"));

        assertThat(out).containsExactly(
                "https://trip-on-himalaya.vercel.app",
                "https://trip-on-himalaya*.vercel.app");
    }

    @Test
    @DisplayName("non-Vercel origins stay exact")
    void leavesCustomDomainsAlone() {
        assertThat(CorsOriginPatterns.expand(List.of("https://crm.triponhimalaya.com")))
                .containsExactly("https://crm.triponhimalaya.com");
    }

    @Test
    @DisplayName("already-patterned origins are not double-expanded")
    void skipsWildcardOrigins() {
        assertThat(CorsOriginPatterns.expand(List.of("https://*.vercel.app")))
                .containsExactly("https://*.vercel.app");
    }
}
