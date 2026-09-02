# Shetrunjay Hills Web — Project Context

Next.js 16 / React 19 / TypeScript frontend for a GIS dashboard (MapLibre GL)
showing conservation/forest-cover data for the Shatrunjay hill range, with
role-based layer visibility and an admin user-management panel.

This checkout is a **static demo build with no backend**. The real system is
a Go API + PostGIS stack described in a separate monorepo; that stack is not
present here. Everything that would normally be an HTTP call is replaced by
in-memory mock data so the app is fully browsable (`npm run dev`) without any
server running.

## Where the mock data lives

- **[lib/layers-mock.ts](lib/layers-mock.ts)** — stands in for the Go API's
  `/api/layers` and `/api/login`.
  - `MOCK_LAYERS`: 5 GeoJSON features (hill boundary, roads, metro line,
    range point, species point). Geometries are copied verbatim from
    `infra/postgis-init/init.sql` in the main monorepo — not invented, so the
    demo renders the same shapes as the real deployment.
  - `PUBLIC_LAYER_NAMES` / `layersForRole()`: mirrors `role_layer_permissions`
    in that same SQL file. `admin` and `support_team` see all 5 layers;
    everyone else (including anonymous/public) sees all but `metro_train`.
  - `MOCK_USERS` / `mockLogin()`: 3 hardcoded accounts (`regular_user`,
    `admin_user`, `support_user`, all password `password123`), matching the
    seed users in `init.sql`. Login mints an **unsigned** JWT-shaped token
    (`alg: "none"`) — fine here because [lib/auth.ts](lib/auth.ts) only ever
    decodes claims client-side and never verifies a signature.
  - Consumed through **[lib/layers-api.ts](lib/layers-api.ts)**
    (`fetchLayers`), which is the seam a real API call would replace later —
    call sites don't know they're talking to mock data.

- **[lib/forest-cover-mock.ts](lib/forest-cover-mock.ts)** — placeholder data
  for the Forest Cover theme panel (FRD §1.1), until real per-year
  satellite/drone imagery and zonal stats exist.
  - Zone/grid areas sum to the *real* surveyed hill area (~3,396 ha, from
    `PalitanaStudyArea.geojson`) but the split into zones/grid cells and the
    per-year cover-percent trend are synthetic/illustrative.
  - `getZoneStats(year)` / `getGridStats(year)` deterministically vary output
    by year so switching the year filter visibly changes the UI — not a real
    measurement.

**Rule of thumb:** geometry and role/permission shapes in the mocks are
intentionally faithful to the real backend's seed data; everything else
(forest cover stats, colors, trends) is explicitly illustrative filler. Keep
that distinction in mind — don't "fix" the illustrative numbers to look more
realistic, and don't treat the copied geometries/roles as arbitrary either.

## Other notable structure

- `app/(dashboard)/` — the map dashboard (`page.tsx` → `MapDashboardLazy`)
  and `admin/users` (admin-only user management, also mock-backed).
- `components/Map.tsx`, `MapDashboard.tsx` — MapLibre GL map + layer/theme
  controls.
- `components/LoginForm.tsx`, `hooks/use-auth-state.ts` — auth flow built on
  `lib/auth.ts` (localStorage JWT-shaped token, client-side decode only).
- `AGENTS.md` at repo root notes this Next.js version has breaking API
  changes from training data — check `node_modules/next/dist/docs/` before
  writing framework code. It also points at `/specs/003-frontend-web-dashboard/`
  and `/.specify/memory/constitution.md` for planned work, but **neither
  directory exists in this checkout** — treat those as external/future
  references, not available context.
