package com.securetravels.crm.common.exception;

/**
 * Returned as HTTP 429 with {@code Retry-After}. Used for login lockout and
 * similar operator-safe throttles — never for silent drops.
 */
public class TooManyRequestsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyRequestsException(String message, long retryAfterSeconds) {
        super(message);
        this.retryAfterSeconds = Math.max(1L, retryAfterSeconds);
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
