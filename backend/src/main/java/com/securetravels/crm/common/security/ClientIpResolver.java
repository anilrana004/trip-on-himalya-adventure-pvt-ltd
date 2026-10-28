package com.securetravels.crm.common.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;

/**
 * Client address for rate limits and audit. The Vercel BFF sets
 * {@code X-Forwarded-For} to the browser edge IP; Railway may also set
 * {@code X-Real-IP}. Leftmost XFF hop is the original client when the proxy
 * chain is trusted (our BFF does not append spoofable client-supplied chains
 * beyond what the platform already set).
 */
@Component
public class ClientIpResolver {

    public String resolve(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        String remote = request.getRemoteAddr();
        return remote == null || remote.isBlank() ? "unknown" : remote;
    }
}
