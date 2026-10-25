# ADR 0009 — Trip On Himalaya is the product name; the Java package stays

- **Status:** Accepted
- **Date:** 2026-10-25
- **Relates to:** `README.md`, `frontend/src/app/layout.tsx`

## Context

Staff see **Trip On Himalaya** (Basecamp OS) in the UI. The repository, Maven
artifact, Java package `com.securetravels`, database name, and demo mailbox
domain still say SecureTravels. That split is confusing, and a global rename
looks like the obvious cleanup.

The package name is in every import, the test tree, the Flyway history, and
the deployed JAR name. Renaming it does not change a screen, a permission, or
a secret. It is a large diff with no user-facing result, and it fights the
rule that this codebase changes in small commits.

## Decision

The user-facing name is Trip On Himalaya. Docs written from this point use
that name.

Do not rename `com.securetravels`, the Maven artifact `securetravels-crm`, or
the database name in a branding pass. Demo addresses on `@securetravels.in`
stay until a migration and the tests that assert them are updated together.

The Fastify app under `server/` and the Vite app under `web/` are not the
running product. They are removed from the working tree. Git history is the
archive. Do not copy them into an `archive/` directory inside this repo.

## Consequences

New code uses the existing package. A later rename, if it is ever worth it,
is its own change with a compile and a full test run, not a drive-by replace.
