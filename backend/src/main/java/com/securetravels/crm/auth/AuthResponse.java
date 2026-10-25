package com.securetravels.crm.auth;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.securetravels.crm.user.Role;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        @JsonInclude(JsonInclude.Include.NON_NULL) String refreshToken,
        String tokenType,
        long expiresInSeconds,
        UserInfo user
) {
    public record UserInfo(UUID id, String email, String fullName, Role role) {}

    /** HTTP responses omit the refresh token. It travels in the HttpOnly cookie. */
    public AuthResponse withoutRefresh() {
        return new AuthResponse(accessToken, null, tokenType, expiresInSeconds, user);
    }
}