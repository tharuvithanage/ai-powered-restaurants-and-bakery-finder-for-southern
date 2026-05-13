# Enterprise UX + Localization Redesign (React/Vite)

This document defines a next‑generation, conversion‑focused, globally accessible experience for the current product (Home, Restaurant Details, Auth, Profile, Favorites, Admin, Owner). It replaces “translate button” patterns with a scalable **localization system** and a consistent **App Shell** architecture.

---

## 1) Product Strategy (What changes, and why)

### North-star outcomes
- **Conversion**: faster “find → trust → act” (search, shortlist, view details, call-to-action).
- **Retention**: saved preferences, re-engagement loops, personalized recommendations, consistent UI.
- **Global readiness**: locale-aware content formatting + real translations (not DOM hacks).
- **Enterprise readiness**: predictable layout, role-based navigation, auditability, scalability.

### Key UX problems to solve (typical in current structure)
- Navigation and layout differ per page (Home has its own navbar; other pages likely diverge).
- Language switching implemented as “translation overlay” risks React/DOM conflicts and inconsistent UX.
- Admin/Owner experiences feel bolted-on rather than first-class “workspaces.”
- Accessibility and responsive patterns are page-specific rather than system-wide.

### Target experience principles
1. **One shell**: consistent sticky navigation + page scaffolding across all routes.
2. **Progressive disclosure**: show only what’s needed; advanced filters/settings live in drawers.
3. **Trust by design**: clear status, verified badges, ratings context, pricing clarity, safe defaults.
4. **Localization is a capability, not a control**: language is a user/tenant preference that permeates the UI.
5. **Performance is UX**: skeletons, optimistic UI, code-splitting, and predictable layout shift control.

---

## 2) Information Architecture & Navigation (Scalable App Shell)

### Route groups (recommended)
- **Public**: `/` (Discover), `/restaurant/:id` (Details)
- **Auth**: `/login`, `/register`
- **User**: `/profile`, `/favorites`
- **Admin**: `/admin/*` (dashboard, moderation, analytics, users, restaurants)
- **Owner**: `/owner/*` (dashboard, menu, orders, profile, promos)

### App shell layout
**Desktop (≥ 1024px)**
- Top sticky bar: brand, global search, quick actions, notifications, profile menu.
- Left nav (collapsible) for authenticated + role-based sections (User/Admin/Owner).
- Main content with consistent page header pattern: title, subtitle, primary actions.

**Tablet (768–1023px)**
- Top bar stays; left nav becomes icon rail or collapsible drawer.

**Mobile (≤ 767px)**
- Top bar with search + profile.
- Bottom nav for 4–5 primary destinations (Discover, Favorites, Orders/Owner, Admin, Profile) based on role.

### Sticky responsive navigation requirements
- Sticky bar must never cover content; reserve height via CSS variable `--app-header-h`.
- Provide “Skip to content” link for keyboard users.
- Use touch-friendly hit targets (≥ 44px).

---

## 3) Intelligent Localization Experience (Replace “Translate Button”)

### Localization goals
- **Real i18n** for app UI strings (stable, testable, accessible).
- **Locale-aware formatting** for dates, currencies, numbers, units.
- **Content language strategy**: user-generated content vs platform text.

### Recommended architecture (production-grade)
1. **UI translation (first-class)**
   - Use `i18next` + `react-i18next` + ICU message formatting (plural, gender, rich text).
   - Store translation bundles per namespace (e.g., `common`, `auth`, `discover`, `restaurant`, `admin`).
2. **Locale preferences**
   - Preference hierarchy: `org/tenant` → `user` → `browser` fallback.
   - Persist in `localStorage` for anonymous users; persist to user profile when logged in.
3. **Content translation (optional, explicit)**
   - Do **not** auto-translate user content by default.
   - Offer “Translate this review/menu description” inline per block with disclosure (“machine translated”).
4. **Context-aware switching**
   - Language control lives in:
     - Profile menu (“Language & Region”)
     - First-run onboarding (“Choose language”)
     - Admin/Owner workspace settings (“Default language for staff UI”)
   - Also allow quick-switcher in top bar for power users (but presented as a preference, not a “translate hack”).

### If you must use Google Translate (non-enterprise fallback)
- Treat as **temporary**; isolate in a dedicated “Machine Translate” mode with clear messaging.
- Never hide your entire app content using broad selectors (e.g., avoid `.skiptranslate { display:none }`).
- Prefer real i18n for all UI chrome and use machine translation only for content blocks.

---

## 4) Wireframe Structure (System-level)

### A) Discover (Home)
**Header**
- Brand + location context + language/region (in profile menu or top bar)
- Search input (sticky on scroll)
- Quick filters (chips): “Open now”, “Top rated”, “Near me”, “Budget”

**Body**
- Hero: value proposition + primary CTA (“Find restaurants near you”)
- Results grid/list with:
  - card: image, name, rating, cuisine tags, distance, price range, open/closed
  - secondary actions: save, share
- Map as a togglable panel (desktop split view; mobile full-screen modal)

**States**
- Loading: skeleton cards + map placeholder
- Empty: friendly message + reset filters + suggestions
- Error: inline retry + offline hint

### B) Restaurant Details
**Top**
- Cover image + trust badges + “Save” + primary CTA (Call/Reserve/Order)
- Tabs: Overview, Menu, Reviews, Location, About

**Body**
- Sticky in-page tab bar
- Sections with consistent spacing and headings
- Reviews: translate-per-review (optional) + sorting + write review flow

### C) Auth (Login/Register)
- Single-column centered layout
- Social proof + security reassurance
- Progressive form validation + password rules + accessible error summaries

### D) User Profile/Favorites
- Profile: preferences (language/region), dietary tags, notification settings
- Favorites: saved lists, shareable collections, quick reorder (if applicable)

### E) Admin/Owner dashboards
- Workspace header (Org name, environment, time range)
- KPI cards + tables with filters + export
- Strong empty/error states + audit log entries

---

## 5) Design System (Premium, minimal, scalable)

### Tokens (the source of truth)
**Foundations**
- Typography scale, color roles, spacing scale, radii, elevations, motion.
- Semantic color tokens (role-based) instead of raw colors.

**Example token set (semantic roles)**
- `--bg`, `--surface-1`, `--surface-2`
- `--text-1`, `--text-2`, `--text-inverse`
- `--border-1`
- `--primary`, `--primary-hover`, `--primary-contrast`
- `--success`, `--warning`, `--danger`, `--info`
- `--focus-ring`
- `--shadow-1`, `--shadow-2`
- `--radius-1`, `--radius-2`, `--radius-3`
- `--space-1` … `--space-10`

### Typography hierarchy
- Display: 40/48, 32/40
- H1: 28/36
- H2: 22/30
- H3: 18/26
- Body: 16/24
- Small: 14/20
- Caption: 12/16
- Use **max 2 fonts**: one UI font + one optional brand accent.

### Color system (light/dark)
- Use semantic tokens and swap values via `[data-theme="dark"]`.
- Avoid pure black/white; prefer near-black and warm/cool neutrals.
- Ensure contrast ratios meet WCAG AA for text and interactive states.

### Spacing system
- 4px base scale: 4, 8, 12, 16, 24, 32, 40, 48, 64
- Page layout:
  - max width containers (e.g., 1200–1280)
  - consistent gutters (mobile 16, tablet 24, desktop 32)

### Component library (minimum enterprise set)
- Buttons (primary/secondary/ghost/destructive + loading)
- Inputs (text, select, combobox, textarea) + validation states
- AppHeader / AppSidebar / BottomNav
- Cards, Lists, Tables (sortable, filterable)
- Tabs, Accordions, Tooltips (accessible)
- Dialogs, Drawers (mobile-first)
- Toasts, Banners (system + inline alerts)
- Skeleton loaders
- Empty state panels
- Pagination / infinite scroll
- Badges and status pills

### Interaction patterns
- One primary action per page header.
- Inline validation + top error summary for forms.
- Preserve scroll and filters on back navigation.
- Motion: short, subtle, purposeful (150–250ms), reduced-motion support.

---

## 6) Responsive & Adaptive Behavior (Mobile-first)

### Breakpoints (recommended)
- `xs` ≤ 360 (small phones)
- `sm` 361–767 (phones)
- `md` 768–1023 (tablets)
- `lg` 1024–1439 (laptops/desktops)
- `xl` ≥ 1440 (wide)
- `2xl` ≥ 1920 (ultra-wide)

### Adaptive layout rules
- Discover results:
  - mobile: list + map button
  - desktop: split view toggle (list+map)
- Tables:
  - mobile: cardified rows or horizontal scroll with sticky first column
- Navigation:
  - mobile: bottom nav
  - desktop: sidebar + topbar

---

## 7) Accessibility (WCAG-focused)

### Non-negotiables
- Keyboard navigable everything (menus, dialogs, tabs, carousel).
- Visible focus ring (never remove outlines without replacement).
- `aria-live` for async status changes (toasts, loading complete, errors).
- Labels for inputs; no placeholder-only labeling.
- Color contrast AA for text, AAA where feasible for small text.
- “Reduced motion” support via `prefers-reduced-motion`.

---

## 8) SEO-friendly structure (Vite SPA constraints)

If staying SPA:
- Use semantic HTML (`main`, `nav`, `header`, `section`, `article`).
- Proper `<title>` and meta updates per route (e.g., `react-helmet-async`).
- Structured data for restaurants (JSON-LD) on details pages.

If enterprise-grade SEO is required:
- Consider SSR/SSG (e.g., migrate to Remix/Next) for Discover + Details pages.

---

## 9) Performance & Front-end Optimization

### Rendering performance
- Route-level code splitting for Admin/Owner dashboards.
- Skeletons instead of spinners; avoid layout shift by reserving space.
- Memoize expensive computations; avoid re-rendering large lists.

### Network
- Cache API responses; use stale-while-revalidate patterns.
- Compress images; responsive srcsets; lazy-load below the fold.

### Observability
- Add analytics events for funnel steps (search, filter, view, favorite, CTA click).
- Add performance metrics (LCP, CLS, INP) tracking.

---

## 10) Conversion & Retention Optimization (Practical)

### Conversion levers
- Clear primary CTA on Details; consistent placement.
- Social proof near CTA (ratings volume, verified reviews).
- Reduce cognitive load: top 3 filters; advanced filters in drawer.
- Trust signals: “updated X days ago”, “owner responds”, “safe payments” (if relevant).

### Retention loops
- Favorites as collections + reminders + “near you now” notifications (opt-in).
- Personalized home section: “Because you liked…”
- Onboarding: preferences (diet, budget, distance) + language/region.

---

## 11) Implementation Guidance (React)

### System architecture changes (recommended sequence)
1. Build an `AppShell` that wraps all routes (top bar, nav, content).
2. Introduce design tokens and a single global style entry.
3. Introduce component library primitives (`Button`, `Input`, `Card`, `Dialog`) with accessibility baked in.
4. Implement real localization (i18n) and preferences (language/region) with a provider.
5. Refactor pages gradually to the new layout patterns (do not big-bang).

### Localization implementation specifics
- Create `LocaleProvider`:
  - `locale`, `setLocale`, `region`, `formatters`
- Use `Intl.NumberFormat` / `Intl.DateTimeFormat` for formatting.
- Translation bundles:
  - JSON per namespace and language
  - lazy load via dynamic import

### Dark/light mode
- Set `data-theme` on `document.documentElement`.
- Persist user preference; respect OS default via `prefers-color-scheme`.
- Ensure images/illustrations work in both themes.

### Motion
- Use CSS transitions for simple UI changes.
- Use `framer-motion` selectively for page transitions and complex components.
- Always guard with reduced-motion settings.

---

## 12) Deliverable Checklist (What “done” looks like)

- A single App Shell drives all pages.
- Consistent design tokens used across all components.
- Language/region is a preference integrated into onboarding + profile + workspace settings.
- Machine translation (if used) is scoped, explicit, and labeled—not a global DOM hack.
- Fully responsive navigation (mobile bottom nav, desktop sidebar).
- Accessible components with keyboard + screen reader support.
- Meaningful loading/empty/error states across primary flows.
- Performance budgets enforced (LCP/CLS/INP targets).

