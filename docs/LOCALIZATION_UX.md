# Localization UX (Context-aware, enterprise-ready)

This replaces “Translate” controls with a preference-based, context-aware localization system.

## Preference hierarchy
1. Tenant/org default (Admin setting)
2. User preference (Profile → Language & Region)
3. Browser language (first visit)
4. Fallback (`en`)

## Onboarding flow (smart, low-friction)
**Trigger**: first visit OR `localStorage.locale` missing.

1. Welcome screen: “Choose language” (6 languages + search)
2. Region/timezone: optional (or auto-detected with confirmation)
3. Personalization: dietary + budget + distance (optional)
4. Confirmation: “You can change this anytime in Profile”

**UX rules**
- One decision per step.
- Always allow “Skip” (use browser defaults).
- Show real preview strings (not flags-only).

## Language switching patterns

### A) Primary (preferred): Profile & Settings
- Profile menu → “Language & Region”
- Full settings page:
  - Language
  - Region (affects currency, units, formatting)
  - Timezone
  - Content translation preferences:
    - Auto-translate user-generated content: Off by default
    - Show “Machine translated” labels: On

### B) Secondary (power users): Header quick switcher
- Lives in top bar near profile
- Behaves like a preference (applies globally)
- Shows current language name (e.g., “English”) and keyboard search

### C) Contextual translation (content-level)
Use for user-generated content blocks:
- Reviews, menu descriptions, messages
- Button per block: “Translate” / “Show original”
- Label after translation: “Machine translated”

## Route behavior and persistence
- Changing language updates:
  - UI string bundle (i18n)
  - `document.documentElement.lang`
  - `localStorage` (anonymous)
  - user profile (authenticated) async background update
- Route changes do not reset language.

## Accessibility & trust
- No flags as the only identifier (use language names).
- Announce changes to screen readers:
  - toast/aria-live: “Language set to French”
- Never translate form input values automatically.

## Implementation notes (React)
- Provide a `LocaleProvider` with:
  - `locale`, `setLocale`
  - `region`, `setRegion`
  - `formatters` (Intl instances)
- UI strings via `react-i18next`.
- Content translation via explicit user action (server call or external service), not DOM mutation.

