package com.securetravels.crm.auth;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshCookieTest {

    @Test
    @DisplayName("the refresh cookie is HttpOnly, Lax, and not readable as a script cookie")
    void writesHostOnlyCookie() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        RefreshCookie.write(response, "refresh-value", 3600, false, "Lax", "");

        String header = response.getHeader("Set-Cookie");
        assertThat(header).contains("toh_refresh=refresh-value");
        assertThat(header).contains("HttpOnly");
        assertThat(header).contains("SameSite=Lax");
        assertThat(header).contains("Path=/api/auth");
        assertThat(header).doesNotContain("Domain=");
        assertThat(header.toLowerCase()).doesNotContain("; secure");
    }

    @Test
    @DisplayName("SameSite=None forces Secure, which browsers require")
    void noneRequiresSecure() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        RefreshCookie.write(response, "refresh-value", 60, false, "None", "example.com");
        String header = response.getHeader("Set-Cookie");
        assertThat(header).contains("SameSite=None");
        assertThat(header.toLowerCase()).contains("secure");
        assertThat(header).contains("Domain=example.com");
    }

    @Test
    @DisplayName("clearing the cookie expires it")
    void clearExpires() {
        MockHttpServletResponse response = new MockHttpServletResponse();
        RefreshCookie.clear(response, true, "Lax", "");
        assertThat(response.getHeader("Set-Cookie")).contains("Max-Age=0");
    }

    @Test
    void readsTheNamedCookie() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new jakarta.servlet.http.Cookie(RefreshCookie.NAME, "abc"));
        assertThat(RefreshCookie.read(request)).isEqualTo("abc");
    }
}
