package com.securetravels.crm.auth;

/**
 * Optional body for non-browser clients. The web app sends the refresh token
 * in the {@code toh_refresh} cookie and an empty JSON object.
 */
public record RefreshRequest(String refreshToken) {}
