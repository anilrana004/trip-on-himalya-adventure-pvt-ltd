-- A fresh sign-in closes any open desk clock from an earlier browser.

ALTER TABLE login_sessions
    DROP CONSTRAINT chk_login_logout_reason;

ALTER TABLE login_sessions
    ADD CONSTRAINT chk_login_logout_reason CHECK (
        logout_reason IS NULL
        OR logout_reason IN ('LOGOUT', 'REVOKED', 'REUSE', 'SUPERSEDED')
    );
