-- =====================================================================
-- Run this entire file in Supabase SQL Editor (Database → SQL Editor → New Query → paste → Run)
-- Idempotent: safe to re-run.
-- =====================================================================

-- Add 'email' column on patients if not present (best-effort lookup target)
alter table if exists patients add column if not exists email text;

-- ---------------------------------------------------------------------
-- Prescriptions: doctor creates -> receptionist dispatches -> patient receives
-- ---------------------------------------------------------------------
create table if not exists prescriptions (
  id              bigserial primary key,
  doctor_id       bigint,
  patient_id      bigint,
  patient_name    text default '',
  patient_email   text default '',
  diagnosis       text default '',
  medicines       jsonb default '[]'::jsonb,
  notes           text default '',
  status          text default 'pending_dispatch',  -- pending_dispatch | sent
  email_status    text default 'not_attempted',     -- sent | mock | failed | no_email | not_attempted
  email_detail    text default '',
  sent_at         timestamptz,
  sent_by         bigint,
  created_at      timestamptz default now()
);

create index if not exists idx_prescriptions_status      on prescriptions(status);
create index if not exists idx_prescriptions_doctor      on prescriptions(doctor_id);
create index if not exists idx_prescriptions_patient_em  on prescriptions(patient_email);

-- ---------------------------------------------------------------------
-- Medication reminders: shared between patient and receptionist
-- ---------------------------------------------------------------------
create table if not exists medication_reminders (
  id              bigserial primary key,
  patient_id      bigint,                  -- link to patients table (receptionist-created)
  owner_user_id   bigint,                  -- link to users.id (patient-created)
  created_by      bigint,                  -- users.id of creator
  medication      text not null,
  dose            text not null default '',
  frequency       text default 'daily',
  times           jsonb default '[]'::jsonb,
  start_date      date,
  end_date        date,
  notes           text default '',
  active          boolean default true,
  email_alerts    boolean default false,
  email           text default '',
  created_at      timestamptz default now()
);

create index if not exists idx_reminders_owner   on medication_reminders(owner_user_id);
create index if not exists idx_reminders_patient on medication_reminders(patient_id);
create index if not exists idx_reminders_active  on medication_reminders(active);

-- ---------------------------------------------------------------------
-- Disable RLS (we authenticate at the API layer via tokens, not via Supabase Auth)
-- This matches the existing pattern used by the users/patients/consultations tables.
-- ---------------------------------------------------------------------
alter table prescriptions          disable row level security;
alter table medication_reminders   disable row level security;

-- =====================================================================
-- Done. Backend will start using these tables immediately.
-- =====================================================================
