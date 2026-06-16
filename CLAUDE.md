# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # local dev server
npm run build        # Next.js production build
npm run lint         # ESLint
npm run build:cf     # Cloudflare Workers build (via opennextjs-cloudflare)
npm run preview:cf   # preview Cloudflare build locally
npm run deploy:cf    # deploy to Cloudflare Workers
npm run seed         # seed items table from data/eval.csv (requires .env.local)
npm run create-raters  # provision rater accounts in Supabase
```

No test suite exists.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # server-only, never expose to client
```

## Architecture

**Human evaluation platform** where multiple raters independently score 100 chatbot answers across 3 dimensions (completeness, correctness, fluency, scale 1–5). The app prevents raters from seeing each other's scores to avoid bias; only aggregated stats are surfaced.

### Supabase Client Pattern

Three distinct clients — use the correct one for each context:

| File | When to use |
|------|-------------|
| [lib/supabase/client.ts](lib/supabase/client.ts) | Client components (browser) |
| [lib/supabase/server.ts](lib/supabase/server.ts) | Server components, route handlers, Server Actions |
| [lib/supabase/admin.ts](lib/supabase/admin.ts) | Server-only; uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS |

`lib/supabase/admin.ts` has `import 'server-only'` at the top — never import it in any client component or it will error at build time.

### Auth & Access Control Flow

1. Middleware ([middleware.ts](middleware.ts)) guards `/`, `/score`, `/dashboard`, `/profile`, `/tutorial` — redirects to `/login` if unauthenticated.
2. After login via magic link, `requireProfile()` ([lib/requireProfile.ts](lib/requireProfile.ts)) redirects to `/profile/setup` if the user hasn't filled in their profile yet. After setup, redirects to `/tutorial`.
3. Admin vs. rater role is determined by `rater_codes.is_admin` in Supabase (checked via admin client in `lib/getAdminStatus.ts`). `/dashboard` is admin-only; admins are redirected away from `/score`.

### Database Schema

| Table | Key constraint |
|-------|---------------|
| `items` | 100 rows (id 1–100); seeded from `data/eval.csv` |
| `scores` | `unique(rater_id, item_id)`; upsert on conflict |
| `profiles` | `user_id` PK; RLS: own rows only |
| `rater_codes` | no RLS policies — service role access only |

RLS on `scores` restricts each rater to their own rows. The dashboard and `/api/stats` route bypass RLS using the admin client and Postgres RPCs (`overall_stats()`, `item_stats()`) that are `SECURITY DEFINER` — they return only aggregated values, never individual rater rows.

### Page Routing Summary

- `/` (home): Raters see progress + resume link (auto-jumps to first incomplete item). Admins see a link to `/dashboard` only.
- `/score?item=N`: Scoring UI — admins are redirected to `/dashboard`. Item id is clamped to 1–100.
- `/dashboard`: Admin-only aggregate stats. Fetches all scores via admin client, computes Krippendorff alpha server-side.
- `/dashboard/rater/[raterId]`: Admin drill-down showing a single rater's full score sheet (all 100 items with per-dimension scores and comments). Read-only.
- `/tutorial`: Shown once after profile setup, before the rater starts scoring.

Dashboard and API routes use `export const dynamic = "force-dynamic"` because they always need fresh data and cannot be statically rendered.

### Scoring Page (`/score`)

The scoring page is a server component ([app/score/page.tsx](app/score/page.tsx)) that fetches the current item and the rater's existing scores, then passes them to `ScorePageClient` ([app/score/ScorePageClient.tsx](app/score/ScorePageClient.tsx)).

Key behaviors in `ScorePageClient`:
- **Autosave**: 400 ms debounce on every score/comment change via `upsert`
- **Keyboard shortcuts**: `1`–`5` to score the focused dimension (focus auto-advances), `Enter`/`→` to go to next item, `←` for previous
- **Navigation guard**: blocks advancing if any dimension is unscored, or if any dimension ≤ 2 and `comment` is empty
- **Modals**: SweetAlert2 (`Swal`) is used for all user-facing warnings and confirmations (not native `alert`/`confirm`)

### Stats (`lib/stats/krippendorff.ts`)

Krippendorff's alpha (ordinal) is computed server-side for inter-rater reliability. All raw scores are fetched via admin client (bypassing RLS), then `krippendorffAlphaOrdinal()` is called per dimension. This computation is done in both `/dashboard/page.tsx` (server component) and `/api/stats/route.ts` (route handler).

### Deployment Target

Production deploys to **Cloudflare Workers** via `@opennextjs/cloudflare`. The `open-next.config.ts` configures edge wrappers. `wrangler.toml` points to `.open-next/worker.js`. Always run `npm run build:cf` (not `npm run build`) to verify Cloudflare compatibility before deploying.
