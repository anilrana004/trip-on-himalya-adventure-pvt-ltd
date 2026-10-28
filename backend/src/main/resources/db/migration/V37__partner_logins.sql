-- Partner logins: a transport or vendor user is tied to one existing vendor.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('SALES', 'OPS', 'MANAGER', 'ADMIN', 'CEO', 'FINANCE', 'TRANSPORT', 'VENDOR'));

ALTER TABLE users ADD COLUMN vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX uq_users_vendor ON users (vendor_id) WHERE vendor_id IS NOT NULL;
