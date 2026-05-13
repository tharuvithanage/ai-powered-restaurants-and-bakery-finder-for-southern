# Implementation Roadmap (Incremental, low-risk)

This plan upgrades the product into an enterprise-grade SaaS UX without a disruptive rewrite.

## Phase 0 — Baseline (1–2 days)
- Add analytics events for funnel steps (discover → details → favorite → CTA).
- Add standard UX states to existing pages: skeletons, empty states, error retry.
- Add a global toast system (accessible `aria-live`) for feedback.

## Phase 1 — App Shell (3–5 days)
- Create an `AppShell` wrapper:
  - `AppHeader` (sticky), `AppNav` (drawer/rail), `MainContent`
  - “Skip to content” + focus management
- Wrap all routes with App Shell so layout is consistent.
- Add role-based nav items (User/Admin/Owner).

## Phase 2 — Design Tokens + Theming (2–4 days)
- Introduce token files and consume them from existing CSS:
  - light/dark tokens + `data-theme`
  - spacing and typography tokens
- Update key primitives first: buttons, inputs, cards, alerts.
- Add theme toggle in profile menu (persist preference).

## Phase 3 — Component Library Primitives (1–2 weeks)
- Build accessible primitives used everywhere:
  - `Button`, `Input`, `Select`, `Badge`, `Card`, `Tabs`, `Dialog`, `Drawer`
  - `Skeleton`, `EmptyState`, `ErrorState`, `Table`, `Pagination`
- Replace per-page ad-hoc components gradually (no big-bang).

## Phase 4 — Localization (1–2 weeks)
- Add `LocaleProvider` + `react-i18next`.
- Migrate UI strings page-by-page:
  - start with Auth, Header/Nav, common actions, errors
  - then Discover + Details
  - then Admin/Owner (namespaces per workspace)
- Add language & region settings with persistence.
- Add content translation as optional, explicit per-block action.

## Phase 5 — Performance & Quality (ongoing)
- Code-split route bundles (Admin/Owner especially).
- Reduce render cost:
  - virtualize long lists if needed
  - memoize derived computations
- Add performance monitoring (LCP/CLS/INP) and error tracking.

## Acceptance criteria (system-level)
- One consistent navigation paradigm across all pages.
- WCAG-ready primitives (keyboard, focus, labels).
- Language/region is a preference integrated into onboarding + settings.
- Dark/light mode supported with semantic tokens.
- Predictable, polished loading/empty/error states.

