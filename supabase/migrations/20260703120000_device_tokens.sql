-- APNs device tokens for native push notifications.
-- One row per device token; optionally linked to a Clerk user so we can target
-- pushes at a person across their devices.
create table if not exists device_tokens (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique,
  platform      text not null default 'ios',
  clerk_user_id text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on device_tokens (clerk_user_id);

-- Vendor/web write paths use the anon key, so grant it explicitly (mirrors the
-- other app-managed tables).
grant select, insert, update, delete on device_tokens to anon, authenticated, service_role;
