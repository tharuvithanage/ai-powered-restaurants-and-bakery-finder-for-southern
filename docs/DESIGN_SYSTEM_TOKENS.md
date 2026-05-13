# Design System Tokens (CSS-first, themeable)

Use tokens as the single source of truth for colors, typography, spacing, radius, elevation, and motion. Components consume **semantic tokens** (role-based), not raw hex values.

## Token structure

### 1) Foundation tokens (rarely referenced directly)
- Neutral ramps, brand ramps, spacing, radii, font families.

### 2) Semantic tokens (what components use)
- Background, surface, text, border, primary, danger, focus ring, shadows.

---

## Recommended baseline tokens (example)

### Light theme
```css
:root {
  /* Typography */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

  /* Type scale (px) */
  --text-xs: 12;
  --text-sm: 14;
  --text-md: 16;
  --text-lg: 18;
  --text-xl: 22;
  --text-2xl: 28;
  --text-3xl: 32;
  --text-4xl: 40;

  /* Line heights */
  --lh-tight: 1.2;
  --lh-normal: 1.5;
  --lh-relaxed: 1.65;

  /* Spacing (4px scale) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 40px;
  --space-8: 48px;
  --space-9: 64px;

  /* Radius */
  --radius-1: 8px;
  --radius-2: 12px;
  --radius-3: 16px;
  --radius-pill: 999px;

  /* Elevation */
  --shadow-1: 0 1px 2px rgba(16, 24, 40, 0.08), 0 1px 1px rgba(16, 24, 40, 0.06);
  --shadow-2: 0 8px 24px rgba(16, 24, 40, 0.12);

  /* Semantic colors */
  --bg: #f6f8fb;
  --surface-1: #ffffff;
  --surface-2: #f1f5fa;

  --text-1: #0f172a;
  --text-2: rgba(15, 23, 42, 0.72);
  --text-3: rgba(15, 23, 42, 0.56);
  --text-inverse: #ffffff;

  --border-1: rgba(15, 23, 42, 0.12);
  --border-2: rgba(15, 23, 42, 0.18);

  --primary: #2563eb;
  --primary-hover: #1d4ed8;
  --primary-contrast: #ffffff;

  --success: #16a34a;
  --warning: #f59e0b;
  --danger: #dc2626;
  --info: #0ea5e9;

  --focus-ring: rgba(37, 99, 235, 0.35);

  /* App layout */
  --app-header-h: 64px;
  --container-max: 1280px;
}
```

### Dark theme
```css
html[data-theme="dark"] {
  --bg: #0b1220;
  --surface-1: #0f1a2e;
  --surface-2: #111f36;

  --text-1: rgba(255, 255, 255, 0.92);
  --text-2: rgba(255, 255, 255, 0.72);
  --text-3: rgba(255, 255, 255, 0.56);
  --text-inverse: #0b1220;

  --border-1: rgba(255, 255, 255, 0.12);
  --border-2: rgba(255, 255, 255, 0.18);

  --primary: #60a5fa;
  --primary-hover: #3b82f6;
  --primary-contrast: #0b1220;

  --focus-ring: rgba(96, 165, 250, 0.35);
}
```

---

## Component consumption rules
- Components must use semantic tokens: `color: var(--text-1)`, `background: var(--surface-1)`.
- Do not hardcode hex colors inside components (except in token definitions).
- Ensure focus states are visible: `outline: 3px solid var(--focus-ring)`.

---

## Responsive conventions
- Container padding:
  - mobile: `var(--space-4)`
  - tablet: `var(--space-5)`
  - desktop: `var(--space-6)`
- Limit text measure for readability: `max-width: 65ch` for long copy blocks.

