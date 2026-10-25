package com.securetravels.crm.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;

import java.time.Duration;

/**
 * The refresh token is an HttpOnly cookie, not a JSON field the page can read.
 *
 * <p>Host-only by default. The Next.js app proxies {@code /api} on its own
 * origin, so the browser stores the cookie for that host and the proxy
 * forwards it. Do not set {@code Domain} to the API host: the browser would
 * reject it because the response it sees comes from the app host.
 * {@code app.example.com} and {@code api.example.com} are same-site, so
 * {@code SameSite=Lax} is sent on the refresh POST. A {@code *.vercel.app}
 * page calling {@code *.railway.app} is cross-site; Lax will not be sent.
 * Use the custom domain, or the proxy, rather than {@code SameSite=None}.
 */
public final class RefreshCookie {

    public static final String NAME = "toh_refresh";
    public static final String PATH = "/api/auth";

    private RefreshCookie() {
    }

    public static void write(HttpServletResponse response, String token, long maxAgeSeconds,
                             boolean secure, String sameSite, String domain) {
        String site = sameSite == null || sameSite.isBlank() ? "Lax" : sameSite;
        boolean mustSecure = "None".equalsIgnoreCase(site) || secure;
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(NAME, token)
                .httpOnly(true)
                .secure(mustSecure)
                .path(PATH)
                .maxAge(Duration.ofSeconds(Math.max(0, maxAgeSeconds)))
                .sameSite(site);
        if (domain != null && !domain.isBlank()) {
            builder.domain(domain);
        }
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    public static void clear(HttpServletResponse response, boolean secure, String sameSite, String domain) {
        write(response, "", 0, secure, sameSite, domain);
    }

    public static String read(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (NAME.equals(cookie.getName()) && cookie.getValue() != null && !cookie.getValue().isBlank()) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
