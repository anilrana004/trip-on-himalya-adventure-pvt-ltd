-- Desk "Away" closes the open clock without signing the user out of the CRM.
-- Resume opens a new login_sessions row; day hours keep summing via PresenceService.

ALTER TABLE login_sessions
    DROP CONSTRAINT chk_login_logout_reason;

ALTER TABLE login_sessions
    ADD CONSTRAINT chk_login_logout_reason CHECK (
        logout_reason IS NULL
        OR logout_reason IN ('LOGOUT', 'REVOKED', 'REUSE', 'SUPERSEDED', 'PAUSE')
    );
