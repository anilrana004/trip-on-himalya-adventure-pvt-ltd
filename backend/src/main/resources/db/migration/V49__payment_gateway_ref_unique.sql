-- CORE C4: idempotent gateway confirmation keyed by payments.gateway_ref.
-- Partial unique index so blank/NULL refs stay allowed for manual lines.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gateway_ref
    ON payments (gateway_ref)
    WHERE gateway_ref IS NOT NULL AND btrim(gateway_ref) <> '';
