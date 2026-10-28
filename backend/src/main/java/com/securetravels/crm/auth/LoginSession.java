package com.securetravels.crm.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** The clock from sign-in until sign-out. A token refresh keeps this same row. */
@Entity
@Table(name = "login_sessions")
public class LoginSession {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "login_at", nullable = false, updatable = false)
    private Instant loginAt;

    @Column(name = "logout_at")
    private Instant logoutAt;

    @Column(name = "logout_reason", length = 20)
    private String logoutReason;

    protected LoginSession() {}

    public LoginSession(UUID id, UUID userId, Instant loginAt) {
        this.id = id;
        this.userId = userId;
        this.loginAt = loginAt;
    }

    public void close(Instant when, String reason) {
        if (logoutAt == null) {
            this.logoutAt = when;
            this.logoutReason = reason;
        }
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public Instant getLoginAt() { return loginAt; }
    public Instant getLogoutAt() { return logoutAt; }
    public String getLogoutReason() { return logoutReason; }
    public boolean isOpen() { return logoutAt == null; }
}
