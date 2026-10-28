-- One row per sign-in. Refreshing the access token does not start a new row.
-- Sign-out, a revoked session, or a stolen refresh token closes it.

CREATE TABLE login_sessions (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    login_at        TIMESTAMPTZ NOT NULL,
    logout_at       TIMESTAMPTZ,
    logout_reason   VARCHAR(20),
    CONSTRAINT chk_login_logout_reason CHECK (
        logout_reason IS NULL OR logout_reason IN ('LOGOUT', 'REVOKED', 'REUSE')
    )
);

CREATE INDEX idx_login_sessions_user_login ON login_sessions (user_id, login_at DESC);
CREATE INDEX idx_login_sessions_login_at ON login_sessions (login_at DESC);

ALTER TABLE refresh_tokens
    ADD COLUMN login_session_id UUID REFERENCES login_sessions (id) ON DELETE SET NULL;
