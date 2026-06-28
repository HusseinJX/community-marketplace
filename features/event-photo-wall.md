# Event Photo Wall

## Concept
When a lot of people go to the same event, their photos end up scattered across platforms. Here, attendees can post photos directly in the app, tag the event, and all photos aggregate into a single sortable gallery under that event — across every venue showing it.

## Why It Fits
The Live Now system already tags venues to events via `event_slug`. This extends that to attendees: anyone at a World Cup watch party can post a photo tagged `world-cup-final` and it surfaces alongside everyone else's from that night, regardless of which bar they were at.

## What's Already There
- `marketplace-media` Supabase Storage bucket (live, with upload helpers)
- `/api/upload` route (multipart → Supabase Storage)
- `LIVE_EVENTS` picklist in `lib/live-events.ts` (defines the event slugs)
- Clerk auth (identifies the poster)
- Existing `broadcast_saves` heart pattern (reusable for photo saves/likes)
- `/live?event=X` feed already groups content by event

## What Needs Building

### DB
```sql
-- one migration
create table event_photos (
  id uuid primary key default gen_random_uuid(),
  event_slug text not null,
  clerk_user_id text not null,
  image_url text not null,
  caption text,
  created_at timestamptz default now()
);
-- anon read, authed insert
```

### API
- `GET /api/event-photos?event=world-cup-final` — sorted by newest or most-saved
- `POST /api/event-photos` — Clerk-authed, calls existing `/api/upload` then writes row

### UI
- "+ Add photo" button on `/live?event=X` (Clerk-gated, opens upload sheet)
- Photo grid component beneath the venue feed on the event page
- Sort toggle: Newest / Most saved
- Each photo shows user avatar + caption; reuse heart button from `SaveButton.tsx`
- Entry point: `/live/[broadcastId]` detail page — user is already at a venue, one tap to post

## Scope Estimate
Small. One migration, one API route, one new client component. No new auth, no new storage setup, no new event taxonomy.
