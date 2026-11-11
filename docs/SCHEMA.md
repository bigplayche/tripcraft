# Database schema

Source of truth: `supabase/migrations/0001_schema.sql` (tables), `0002_security.sql` (functions, triggers, grants, RLS), `0003_storage.supabase.sql` (private documents bucket).

Every table has Row Level Security enabled. "Member" means a row in `trip_members` for the trip; roles are `owner`, `editor`, `viewer`.

| Table | Purpose | Who can read | Who can write |
|---|---|---|---|
| `users` | Profile, 1:1 with `auth.users` (created by trigger) | Self; people who share a trip | Self |
| `user_preferences` | Onboarding preferences used by the AI | Self | Self |
| `subscriptions` | Plan, Stripe ids, period end, trip pass | Self | Server only (Stripe webhook) |
| `destinations` | Shared cache of destination lookups, with `source` and `fetched_at` | Any signed-in user | Server only |
| `destination_views` | Recently viewed destinations | Self | Self |
| `trips` | Trip basics, budget, notes, packing list, emergency contacts | Members | Owner and editors; delete: owner |
| `trip_members` | Membership and role | Members | Owner changes roles and removes; members can leave. Rows are added only by `handle_new_trip()` and `accept_invite()` |
| `trip_invites` | Invite tokens, role, expiry, revocation | Owner | Owner |
| `itineraries` | One per trip: summary, assumptions, `generated_by`, budget at generation | Members | Owner and editors |
| `itinerary_days` | One row per calendar day | Members | Owner and editors |
| `itinerary_items` | Scheduled stops; `travel_from_prev` holds provider travel time with source and timestamp | Members | Owner and editors |
| `hotels` | Stay options; `est_nightly` is an estimate; `rating` only when verified | Members | Owner and editors |
| `restaurants`, `activities` | Recommendation pools and group suggestions | Members | Owner and editors; any member may insert a `suggested` row |
| `trip_expenses` | Budget lines: category, amount, `estimated`/`booked`/`paid`, shared flag | Members | Owner and editors |
| `expense_splits` | Per-member share of a shared expense, settled flag | Members | Owner and editors; a member can settle their own share |
| `group_polls`, `group_votes` | Votes on destinations, activities, restaurants | Members | Editors create polls; every member votes (one vote per poll) |
| `trip_comments` | Trip discussion | Members | Any member; delete: author or owner |
| `saved_places` | Bookmarked places | Self | Self |
| `chat_conversations`, `chat_messages` | Concierge history with place cards and sources | Self | Self |
| `uploaded_documents` | Metadata for private files (`storage_path`, never a public URL) | Members | Editors upload; delete: uploader or owner |
| `notifications` | In-app notifications | Self | Created by `accept_invite()` / `notify_trip_members()` only |
| `ai_usage` | Per-request tokens and estimated cost, drives quotas | Self | Server only |
| `stripe_events` | Processed webhook ids (idempotency) | Nobody | Server only |

Helper functions (security definer): `is_trip_member`, `can_edit_trip`, `is_trip_owner`, `trip_role`, `shares_trip_with`, `peek_invite`, `accept_invite`, `notify_trip_members`.

Indexes cover every foreign key used for lookups (`trip_id`, `user_id`, `day_id + position`, conversation and notification timelines).
