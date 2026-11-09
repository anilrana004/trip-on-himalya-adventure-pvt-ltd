-- Company teams salary: attendance snapshot on payroll lines + optional base salary on users.
-- staff_payroll remains the single pay store; finance posts SALARIES expenses when marked PAID.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS monthly_salary numeric(12, 2);

ALTER TABLE staff_payroll
    ADD COLUMN IF NOT EXISTS role_snapshot varchar(20),
    ADD COLUMN IF NOT EXISTS working_days integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS present_days integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS half_days integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS leave_days integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS absent_days integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS worked_minutes integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS overtime_minutes integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS paid_at timestamptz,
    ADD COLUMN IF NOT EXISTS payment_ref varchar(80),
    ADD COLUMN IF NOT EXISTS expense_id uuid;

CREATE INDEX IF NOT EXISTS idx_staff_payroll_user_month
    ON staff_payroll (user_id, period_month);

COMMENT ON COLUMN staff_payroll.worked_minutes IS 'Snapshot from staff_attendance for the period; source of truth for pay hours.';
COMMENT ON COLUMN users.monthly_salary IS 'Default basic pay used when generating a month run.';
