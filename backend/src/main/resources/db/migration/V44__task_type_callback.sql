-- Callback tasks created automatically from call outcomes (NO_ANSWER / BUSY / CALLBACK).

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;

ALTER TABLE tasks ADD CONSTRAINT tasks_type_check CHECK (type IN
    ('INITIAL_CALL', 'FOLLOW_UP_1D', 'FOLLOW_UP_3D', 'FOLLOW_UP_8D', 'FOLLOW_UP_15D',
     'QUOTATION', 'PAYMENT_REMINDER', 'OPS', 'REVIEW', 'CUSTOM', 'CALLBACK'));
