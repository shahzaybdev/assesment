-- ============================================================
-- PBL Portal — PostgreSQL Schema
-- ============================================================
-- Run this file against your PostgreSQL database to create
-- all tables required by the backend API.
--
-- Usage:
--   psql -U <user> -d <database> -f server/schema.sql
-- ============================================================

-- ── Extensions ─────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. CANDIDATE ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_account (
  candidate_id      VARCHAR(64) PRIMARY KEY,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL DEFAULT '',
  account_status    VARCHAR(32)  NOT NULL DEFAULT 'active',
  created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidate_account_email
  ON candidate_account (email);

-- ============================================================
-- 2. CANDIDATE PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_profile (
  candidate_id  VARCHAR(64) PRIMARY KEY,
  first_name    VARCHAR(128) NOT NULL DEFAULT '',
  last_name     VARCHAR(128) NOT NULL DEFAULT '',
  phone         VARCHAR(32),
  address       TEXT,
  created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_candidate_profile_account
    FOREIGN KEY (candidate_id)
    REFERENCES candidate_account (candidate_id)
    ON DELETE CASCADE
);

-- ============================================================
-- 3. APPLICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS application (
  application_id      SERIAL PRIMARY KEY,
  candidate_id        VARCHAR(64)  NOT NULL,
  application_status  VARCHAR(32)  NOT NULL DEFAULT 'Applied',
  resume_url          TEXT,
  resume_name         VARCHAR(255),
  date_applied        TIMESTAMP    NOT NULL DEFAULT NOW(),
  date_updated_at     TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_application_candidate
    FOREIGN KEY (candidate_id)
    REFERENCES candidate_account (candidate_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_application_candidate
  ON application (candidate_id);

-- ============================================================
-- 4. ASSESSMENT VERSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_version (
  assessment_version_id SERIAL PRIMARY KEY,
  duration_minutes      INTEGER  NOT NULL DEFAULT 30,
  total_questions       INTEGER  NOT NULL DEFAULT 0,
  maximum_score         INTEGER  NOT NULL DEFAULT 0,
  passing_percentage    INTEGER  NOT NULL DEFAULT 60,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ASSESSMENT FORMS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_form (
  assessment_form_id     SERIAL PRIMARY KEY,
  form_code              VARCHAR(64)  NOT NULL UNIQUE,
  title                  VARCHAR(255) NOT NULL DEFAULT '',
  description            TEXT,
  status                 VARCHAR(32)  NOT NULL DEFAULT 'Active',
  assessment_version_id  INTEGER      NOT NULL,
  created_at             TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_assessment_form_version
    FOREIGN KEY (assessment_version_id)
    REFERENCES assessment_version (assessment_version_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_form_status
  ON assessment_form (status);

-- ============================================================
-- 6. QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS question (
  question_id      SERIAL PRIMARY KEY,
  question_text    TEXT         NOT NULL,
  question_type    VARCHAR(32)  NOT NULL DEFAULT 'multiple_choice',
  score_value      INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. QUESTION OPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS question_option (
  option_id      SERIAL PRIMARY KEY,
  question_id    INTEGER      NOT NULL,
  option_label   VARCHAR(8)   NOT NULL DEFAULT '',
  option_text    VARCHAR(255) NOT NULL DEFAULT '',
  score_value    INTEGER      NOT NULL DEFAULT 0,
  created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_question_option_question
    FOREIGN KEY (question_id)
    REFERENCES question (question_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_question_option_question
  ON question_option (question_id);

-- ============================================================
-- 8. FORM QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS form_question (
  form_question_id    SERIAL PRIMARY KEY,
  assessment_form_id  INTEGER     NOT NULL,
  question_id         INTEGER     NOT NULL,
  question_number     INTEGER     NOT NULL DEFAULT 1,
  question_weight     INTEGER     NOT NULL DEFAULT 1,
  created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP   NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_form_question_form
    FOREIGN KEY (assessment_form_id)
    REFERENCES assessment_form (assessment_form_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_form_question_question
    FOREIGN KEY (question_id)
    REFERENCES question (question_id)
    ON DELETE CASCADE,

  CONSTRAINT uq_form_question_number
    UNIQUE (assessment_form_id, question_number)
);

CREATE INDEX IF NOT EXISTS idx_form_question_form
  ON form_question (assessment_form_id);

-- ============================================================
-- 9. ASSESSMENT INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_invitation (
  invitation_id      VARCHAR(64) PRIMARY KEY,
  assessment_form_id INTEGER      NOT NULL,
  application_id     INTEGER      NOT NULL,
  invitation_status  VARCHAR(32)  NOT NULL DEFAULT 'Assigned',
  expires_at         TIMESTAMP,
  opened_at          TIMESTAMP,
  assigned_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
  due_date           TIMESTAMP,
  created_at         TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_invitation_form
    FOREIGN KEY (assessment_form_id)
    REFERENCES assessment_form (assessment_form_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_invitation_application
    FOREIGN KEY (application_id)
    REFERENCES application (application_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_invitation_application
  ON assessment_invitation (application_id);

CREATE INDEX IF NOT EXISTS idx_invitation_form
  ON assessment_invitation (assessment_form_id);

-- ============================================================
-- 10. ASSESSMENT ATTEMPTS
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_attempt (
  attempt_id           VARCHAR(64) PRIMARY KEY,
  invitation_id        VARCHAR(64)  NOT NULL UNIQUE,
  started_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  status               VARCHAR(32)  NOT NULL DEFAULT 'In Progress',
  submitted_at         TIMESTAMP,
  time_taken_seconds   INTEGER,
  submission_type      VARCHAR(32)  DEFAULT 'Manual',
  answered_questions   INTEGER,
  unanswered_questions INTEGER,
  raw_score            INTEGER,
  maximum_score        INTEGER,
  percentage_score     NUMERIC(5,2),
  created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_attempt_invitation
    FOREIGN KEY (invitation_id)
    REFERENCES assessment_invitation (invitation_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_attempt_invitation
  ON assessment_attempt (invitation_id);

-- ============================================================
-- 11. CANDIDATE RESPONSES
-- ============================================================
CREATE TABLE IF NOT EXISTS candidate_response (
  response_id      SERIAL PRIMARY KEY,
  attempt_id       VARCHAR(64)  NOT NULL,
  question_id      INTEGER      NOT NULL,
  selected_answer  TEXT         NOT NULL DEFAULT '',
  score_awarded    INTEGER      NOT NULL DEFAULT 0,
  created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMP    NOT NULL DEFAULT NOW(),

  CONSTRAINT fk_response_attempt
    FOREIGN KEY (attempt_id)
    REFERENCES assessment_attempt (attempt_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_response_question
    FOREIGN KEY (question_id)
    REFERENCES question (question_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_response_attempt
  ON candidate_response (attempt_id);

CREATE INDEX IF NOT EXISTS idx_response_question
  ON candidate_response (question_id);

-- ============================================================
-- TRIGGERS — keep updated_at fresh
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_candidate_account_updated_at') THEN
    CREATE TRIGGER trg_candidate_account_updated_at
      BEFORE UPDATE ON candidate_account
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_candidate_profile_updated_at') THEN
    CREATE TRIGGER trg_candidate_profile_updated_at
      BEFORE UPDATE ON candidate_profile
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_application_updated_at') THEN
    CREATE TRIGGER trg_application_updated_at
      BEFORE UPDATE ON application
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assessment_version_updated_at') THEN
    CREATE TRIGGER trg_assessment_version_updated_at
      BEFORE UPDATE ON assessment_version
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assessment_form_updated_at') THEN
    CREATE TRIGGER trg_assessment_form_updated_at
      BEFORE UPDATE ON assessment_form
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_question_updated_at') THEN
    CREATE TRIGGER trg_question_updated_at
      BEFORE UPDATE ON question
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assessment_invitation_updated_at') THEN
    CREATE TRIGGER trg_assessment_invitation_updated_at
      BEFORE UPDATE ON assessment_invitation
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_assessment_attempt_updated_at') THEN
    CREATE TRIGGER trg_assessment_attempt_updated_at
      BEFORE UPDATE ON assessment_attempt
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_candidate_response_updated_at') THEN
    CREATE TRIGGER trg_candidate_response_updated_at
      BEFORE UPDATE ON candidate_response
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- ============================================================
-- SEED DATA (optional demo records)
-- ============================================================
-- Uncomment the block below if you want a demo candidate
-- inserted automatically when the schema is created.

/*
INSERT INTO candidate_account (candidate_id, email, password_hash, account_status)
VALUES ('CAND-001', 'candidate@example.com', '', 'active')
ON CONFLICT (candidate_id) DO NOTHING;

INSERT INTO candidate_profile (candidate_id, first_name, last_name)
VALUES ('CAND-001', 'Demo', 'Candidate')
ON CONFLICT (candidate_id) DO NOTHING;
*/
