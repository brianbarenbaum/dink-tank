create schema if not exists auth_private;

create table if not exists auth_private.auth_invite_codes (
  id bigint generated always as identity primary key,
  code_hash text not null unique,
  active boolean not null default true,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz
);

create unique index if not exists auth_invite_codes_single_active_idx
  on auth_private.auth_invite_codes (active)
  where active;
create index if not exists auth_invite_codes_active_expires_at_idx
  on auth_private.auth_invite_codes (active, expires_at);

create table if not exists auth_private.auth_approved_emails (
  email_normalized text primary key,
  approved_at timestamptz not null default now(),
  invite_code_id bigint references auth_private.auth_invite_codes(id)
);

create index if not exists auth_approved_emails_approved_at_idx
  on auth_private.auth_approved_emails (approved_at desc);

create table if not exists auth_private.auth_pending_enrollments (
  email_normalized text primary key,
  invite_code_id bigint not null references auth_private.auth_invite_codes(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists auth_pending_enrollments_expires_at_idx
  on auth_private.auth_pending_enrollments (expires_at);

alter table auth_private.auth_invite_codes enable row level security;
alter table auth_private.auth_approved_emails enable row level security;
alter table auth_private.auth_pending_enrollments enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_invite_codes'
      and policyname = 'auth_invite_codes_deny_all'
  ) then
    create policy auth_invite_codes_deny_all
      on auth_private.auth_invite_codes
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_approved_emails'
      and policyname = 'auth_approved_emails_deny_all'
  ) then
    create policy auth_approved_emails_deny_all
      on auth_private.auth_approved_emails
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'auth_private'
      and tablename = 'auth_pending_enrollments'
      and policyname = 'auth_pending_enrollments_deny_all'
  ) then
    create policy auth_pending_enrollments_deny_all
      on auth_private.auth_pending_enrollments
      as restrictive
      for all
      to public
      using (false)
      with check (false);
  end if;
end
$$;
