create schema if not exists auth_private;

create table if not exists auth_private.auth_otp_request_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  occurred_at timestamptz not null default now(),
  email_normalized text not null,
  email_hash text not null,
  ip_hash text not null,
  outcome text not null check (outcome in ('success', 'failure', 'rate_limited', 'turnstile_rejected')),
  reason text
);

create index if not exists auth_otp_request_events_occurred_at_idx
  on auth_private.auth_otp_request_events (occurred_at desc);
create index if not exists auth_otp_request_events_email_hash_idx
  on auth_private.auth_otp_request_events (email_hash, occurred_at desc);
create index if not exists auth_otp_request_events_ip_hash_idx
  on auth_private.auth_otp_request_events (ip_hash, occurred_at desc);

create table if not exists auth_private.auth_otp_verify_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  occurred_at timestamptz not null default now(),
  email_normalized text not null,
  email_hash text not null,
  ip_hash text not null,
  success boolean not null,
  reason text
);

create index if not exists auth_otp_verify_events_occurred_at_idx
  on auth_private.auth_otp_verify_events (occurred_at desc);
create index if not exists auth_otp_verify_events_email_hash_idx
  on auth_private.auth_otp_verify_events (email_hash, occurred_at desc);

create table if not exists auth_private.auth_otp_verify_state (
  email_hash text primary key,
  failed_attempts integer not null default 0 check (failed_attempts >= 0),
  last_failed_at timestamptz,
  cooldown_until timestamptz,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists auth_otp_verify_state_locked_until_idx
  on auth_private.auth_otp_verify_state (locked_until);
create index if not exists auth_otp_verify_state_updated_at_idx
  on auth_private.auth_otp_verify_state (updated_at desc);

create table if not exists auth_private.auth_audit_events (
  id bigint generated always as identity primary key,
  request_id text not null,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  status text not null,
  email_normalized text,
  email_hash text,
  details jsonb
);

create index if not exists auth_audit_events_occurred_at_idx
  on auth_private.auth_audit_events (occurred_at desc);
create index if not exists auth_audit_events_event_type_idx
  on auth_private.auth_audit_events (event_type, occurred_at desc);
create index if not exists auth_audit_events_email_hash_idx
  on auth_private.auth_audit_events (email_hash, occurred_at desc);

alter table auth_private.auth_otp_request_events enable row level security;
alter table auth_private.auth_otp_verify_events enable row level security;
alter table auth_private.auth_otp_verify_state enable row level security;
alter table auth_private.auth_audit_events enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_otp_request_events'
      and policyname = 'auth_otp_request_events_deny_all'
  ) then
    create policy auth_otp_request_events_deny_all
      on auth_private.auth_otp_request_events
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_otp_verify_events'
      and policyname = 'auth_otp_verify_events_deny_all'
  ) then
    create policy auth_otp_verify_events_deny_all
      on auth_private.auth_otp_verify_events
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_otp_verify_state'
      and policyname = 'auth_otp_verify_state_deny_all'
  ) then
    create policy auth_otp_verify_state_deny_all
      on auth_private.auth_otp_verify_state
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_audit_events'
      and policyname = 'auth_audit_events_deny_all'
  ) then
    create policy auth_audit_events_deny_all
      on auth_private.auth_audit_events
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;
end
$$;
