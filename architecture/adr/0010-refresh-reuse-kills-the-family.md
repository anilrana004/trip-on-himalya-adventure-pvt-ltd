# ADR 0010 — Replaying a rotated refresh token revokes every live session

- **Status:** Accepted
- **Date:** 2026-10-25
- **Relates to:** `AuthService`, `RefreshCookie`, `SecurityConfig`

## Context

Refresh tokens rotate. The old row is marked revoked and points at the
replacement hash. Until this change, presenting that old token returned 401
and left the replacement usable. A stolen copy and the real browser could
both keep a session.

The API is stateless JWT. Spring CSRF is off because API clients send
`Authorization: Bearer`, which a cross-site form cannot set. The refresh
cookie is the exception: the browser attaches it. `SameSite=Lax` withholds
it from cross-site posts. A CSRF token on top of that would break the
non-browser refresh body, which scripts and tests still use.

## Decision

If a refresh token is already revoked because it was rotated (`replacedBy`
is set), revoke every active refresh row for that user and refuse the
request. Logout sets `replacedBy` to null, so logging out one browser does
not kill the others.

`GET /api/auth/sessions` and `DELETE /api/auth/sessions/{id}` list and revoke
the caller's own rows. The response has the row id and expiry, not the hash.

API responses set `X-Content-Type-Options`, `X-Frame-Options: DENY`,
`Referrer-Policy: no-referrer`, `Content-Security-Policy: default-src 'none'`,
a locked-down `Permissions-Policy`, and HSTS when the request is HTTPS.

Dependabot updates Maven, npm, and GitHub Actions. Pull requests run
GitHub dependency review and a gitleaks scan of the pull-request commits.
OWASP dependency-check is not on `mvn verify`: the NVD feed needs an API key
and a large database download, and it would make every test run depend on
that service. The advisory feed Dependabot and dependency review already use
is the check that runs here.

## Consequences

A user who had two browsers open must log in again on both after a reuse
event. That is the point of the control. Two-factor authentication, DPDPA
export/delete, and hiding trek cost from sales are still open.
