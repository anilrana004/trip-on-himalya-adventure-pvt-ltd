-- Office face verification for managers+: enroll desk staff, match webcam descriptors,
-- keep an audit log of MATCH / NO_MATCH attempts (Asia/Kolkata desk use).

CREATE TABLE face_profiles (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL UNIQUE REFERENCES users (id),
    model           VARCHAR(40) NOT NULL DEFAULT 'face-api-128',
    descriptor_json TEXT NOT NULL,
    sample_count    INT NOT NULL DEFAULT 1,
    snapshot_jpeg   BYTEA,
    enrolled_by     UUID NOT NULL REFERENCES users (id),
    enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    active          BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_face_profiles_active ON face_profiles (active) WHERE active = TRUE;

CREATE TABLE face_verifications (
    id                UUID PRIMARY KEY,
    subject_user_id   UUID REFERENCES users (id),
    matched_user_id   UUID REFERENCES users (id),
    verified_by       UUID NOT NULL REFERENCES users (id),
    purpose           VARCHAR(30) NOT NULL,
    result            VARCHAR(20) NOT NULL,
    score             NUMERIC(10, 6),
    threshold_used    NUMERIC(10, 6) NOT NULL,
    snapshot_jpeg     BYTEA,
    login_session_id  UUID REFERENCES login_sessions (id),
    note              VARCHAR(200),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_face_verify_purpose CHECK (
        purpose IN ('ENROLL_CHECK', 'DESK_CHECK', 'IDENTIFY', 'ATTENDANCE')
    ),
    CONSTRAINT chk_face_verify_result CHECK (
        result IN ('MATCH', 'NO_MATCH', 'NO_FACE', 'NO_TEMPLATE', 'AMBIGUOUS', 'ERROR')
    )
);

CREATE INDEX idx_face_verifications_created ON face_verifications (created_at DESC);
CREATE INDEX idx_face_verifications_subject ON face_verifications (subject_user_id, created_at DESC);
CREATE INDEX idx_face_verifications_verifier ON face_verifications (verified_by, created_at DESC);
