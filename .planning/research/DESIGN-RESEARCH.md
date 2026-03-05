# Design System Research: shadcn/ui + Lyra + Emerald Theme

**Date:** 2026-03-06
**Purpose:** Research findings for Validater design system decisions

---

## 1. Lyra Style Preset

### Overview

Lyra is one of five visual style presets introduced with `shadcn create` in December 2025. It is described as **"boxy and sharp, with zero border radius"** and pairs well with monospace fonts.

### All Five Style Presets

| Style | Description | Radius | Spacing | Best For |
|-------|-------------|--------|---------|----------|
| **Vega** | Classic shadcn/ui look (formerly "New York") | Medium (~0.625rem) | Balanced | General purpose |
| **Nova** | Reduced padding/margins | Small | Tight | Dashboards, admin panels |
| **Maia** | Soft and rounded | Large / fully rounded | Generous | Consumer products, landing pages |
| **Lyra** | Boxy, sharp, precise | **0** | Structured | Brutalist, technical, monospace UIs |
| **Mira** | Most compact option | Small | Minimal | Dense, information-heavy UIs |

### Lyra Characteristics

- **Border radius:** `0` on all components (buttons, cards, inputs, dialogs, popovers)
- **Typography pairing:** Monospace fonts recommended (JetBrains Mono, Fira Code, IBM Plex Mono)
- **Visual identity:** Geometric, precise, architectural
- **Component generation:** Lyra is not just a theme -- it rewrites component code at install time to match the boxy aesthetic

### Configuration

In `components.json`, the style is set as a compound of library + style:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-lyra"
}
```

For Base UI instead of Radix:

```json
{
  "style": "base-lyra"
}
```

All 10 combinations are supported: `{radix|base}-{vega|nova|maia|lyra|mira}`.

### CSS Variables for Lyra

```css
:root {
  --radius: 0rem;
}
```

Since Lyra uses zero radius, all components render with sharp 90-degree corners. This single variable controls the entire system.

---

## 2. shadcn + TanStack Start Template

### Quick Start

```bash
pnpm create @tanstack/start@latest --tailwind --add-ons shadcn
```

Or with full shadcn customization:

```bash
pnpm dlx shadcn@latest create
```

The `create` command supports Next.js, Vite, **TanStack Start**, and v0.

### What the Template Includes

- **TanStack Start** with file-based routing
- **TanStack Router** for type-safe routing
- **TanStack Query** for data fetching/caching
- **Tailwind CSS v4** pre-configured
- **shadcn/ui** component system ready
- **React 19** with React Compiler support

### Adding Components

```bash
# Individual component
pnpm dlx shadcn@latest add button

# All components at once
pnpm dlx shadcn@latest add --all
```

### Community Starter Templates

For more opinionated setups:

- **React TanStarter** (github.com/dotnize/react-tanstarter): Adds Better Auth + Drizzle ORM + PostgreSQL
- **TanStack Start Dashboard** (github.com/Kiranism/tanstack-start-dashboard): Dashboard starter with charts, data tables, auth

### File Structure (Typical TanStack Start + shadcn)

```
project/
  app/
    routes/
      __root.tsx        # Root layout
      index.tsx         # Home route
    client.tsx          # Client entry
    router.tsx          # Router configuration
    ssr.tsx             # SSR entry
  components/
    ui/                 # shadcn components installed here
      button.tsx
      card.tsx
      ...
  lib/
    utils.ts            # cn() utility
  styles/
    globals.css         # Tailwind + CSS variables
  components.json       # shadcn configuration
  app.config.ts         # TanStack Start config
  tailwind.config.ts    # (optional in v4)
```

---

## 3. Square/Sharp Corner Design Patterns

### Setting Radius to 0 -- Making It Intentional

The key to sharp corners looking polished rather than broken is **consistency and supporting design decisions**.

#### Core CSS

```css
:root {
  --radius: 0rem;
}
```

Every shadcn component derives its border radius from this variable:
- `rounded-lg` = `calc(var(--radius))` -- becomes 0
- `rounded-md` = `calc(var(--radius) - 2px)` -- becomes 0 (clamped)
- `rounded-sm` = `calc(var(--radius) - 4px)` -- becomes 0 (clamped)

#### Best Practices for Sharp Corner Design

1. **Use visible borders.** Without rounded corners to soften edges, borders become critical visual separators. Use 1px or 2px solid borders.

   ```css
   --border: oklch(0.80 0 0);  /* Light mode: visible but not heavy */
   --border: oklch(0.30 0 0);  /* Dark mode */
   ```

2. **Increase contrast between surfaces.** Cards on backgrounds need more distinction when edges are sharp.

3. **Lean into the grid.** Sharp corners naturally align to grids. Use consistent spacing (4px/8px/16px/24px/32px).

4. **Bold typography.** Sharp corners pair with strong, geometric type. Inter works well at heavier weights (500-700).

5. **Deliberate color accents.** A single accent color (like emerald) on sharp elements reads as intentional, not accidental.

6. **Shadow alternatives.** Consider using borders or background color differences instead of soft shadows. If using shadows, use hard/offset shadows:

   ```css
   /* Neobrutalist shadow */
   box-shadow: 4px 4px 0px 0px oklch(0.205 0 0);

   /* Subtle sharp shadow */
   box-shadow: 2px 2px 0px 0px oklch(0.80 0 0);
   ```

7. **Monospace or geometric sans-serif fonts.** These reinforce the sharp aesthetic.

#### Neobrutalism vs. Clean Sharp

| Approach | Borders | Colors | Shadows | Personality |
|----------|---------|--------|---------|-------------|
| Neobrutalist | Thick (2-3px), black | Vibrant, saturated | Hard offset | Playful, bold |
| Clean Sharp | Thin (1px), subtle | Neutral + 1 accent | None or minimal | Professional, technical |
| Brutalist | Variable | Monochrome | None | Raw, architectural |

For SaaS dashboards, **Clean Sharp** is typically the best approach -- professional and distinctive without being distracting.

#### Real-World Examples

- **Linear** -- sharp corners, minimal borders, clean dark UI
- **Vercel** -- sharp/minimal radius, monochrome + accent
- **Gumroad** -- full neobrutalism with sharp corners and bold colors

---

## 4. Emerald Color Theme

### Tailwind Emerald Scale (OKLCH)

These are the official Tailwind CSS v4 emerald values:

```css
/* Tailwind Emerald Palette - OKLCH */
--emerald-50:  oklch(97.9% .021 166.113);
--emerald-100: oklch(95.0% .052 163.051);
--emerald-200: oklch(90.5% .093 164.150);
--emerald-300: oklch(84.5% .143 164.978);
--emerald-400: oklch(76.5% .177 163.223);
--emerald-500: oklch(69.6% .170 162.480);
--emerald-600: oklch(59.6% .145 163.225);
--emerald-700: oklch(50.8% .118 165.612);
--emerald-800: oklch(43.2% .095 166.913);
--emerald-900: oklch(37.8% .077 168.940);
--emerald-950: oklch(26.2% .051 172.552);
```

### Mapping Emerald to shadcn CSS Variables

For an emerald-themed shadcn project, map the palette to semantic variables:

```css
@layer base {
  :root {
    /* Base */
    --background: oklch(0.985 0.002 166);
    --foreground: oklch(0.205 0.015 168);

    /* Card */
    --card: oklch(0.995 0.001 166);
    --card-foreground: oklch(0.205 0.015 168);

    /* Popover */
    --popover: oklch(0.995 0.001 166);
    --popover-foreground: oklch(0.205 0.015 168);

    /* Primary -- emerald-600 base */
    --primary: oklch(0.596 0.145 163.225);
    --primary-foreground: oklch(0.985 0.005 166);

    /* Secondary */
    --secondary: oklch(0.950 0.052 163.051);
    --secondary-foreground: oklch(0.378 0.077 168.940);

    /* Muted */
    --muted: oklch(0.950 0.020 166);
    --muted-foreground: oklch(0.508 0.040 166);

    /* Accent */
    --accent: oklch(0.905 0.093 164.150);
    --accent-foreground: oklch(0.262 0.051 172.552);

    /* Destructive */
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0.005 27);

    /* Border / Input / Ring */
    --border: oklch(0.905 0.030 164);
    --input: oklch(0.905 0.030 164);
    --ring: oklch(0.596 0.145 163.225);

    /* Radius */
    --radius: 0rem;

    /* Chart colors */
    --chart-1: oklch(0.696 0.170 162.480);  /* emerald-500 */
    --chart-2: oklch(0.596 0.145 163.225);  /* emerald-600 */
    --chart-3: oklch(0.765 0.177 163.223);  /* emerald-400 */
    --chart-4: oklch(0.508 0.118 165.612);  /* emerald-700 */
    --chart-5: oklch(0.845 0.143 164.978);  /* emerald-300 */

    /* Sidebar */
    --sidebar: oklch(0.970 0.015 166);
    --sidebar-foreground: oklch(0.262 0.051 172.552);
    --sidebar-primary: oklch(0.596 0.145 163.225);
    --sidebar-primary-foreground: oklch(0.985 0.005 166);
    --sidebar-accent: oklch(0.905 0.093 164.150);
    --sidebar-accent-foreground: oklch(0.378 0.077 168.940);
    --sidebar-border: oklch(0.905 0.030 164);
    --sidebar-ring: oklch(0.596 0.145 163.225);
  }

  .dark {
    /* Base */
    --background: oklch(0.145 0.015 168);
    --foreground: oklch(0.950 0.020 166);

    /* Card */
    --card: oklch(0.180 0.018 168);
    --card-foreground: oklch(0.950 0.020 166);

    /* Popover */
    --popover: oklch(0.180 0.018 168);
    --popover-foreground: oklch(0.950 0.020 166);

    /* Primary -- emerald-500 for dark mode (brighter) */
    --primary: oklch(0.696 0.170 162.480);
    --primary-foreground: oklch(0.145 0.015 168);

    /* Secondary */
    --secondary: oklch(0.262 0.051 172.552);
    --secondary-foreground: oklch(0.905 0.050 164);

    /* Muted */
    --muted: oklch(0.262 0.030 168);
    --muted-foreground: oklch(0.696 0.040 164);

    /* Accent */
    --accent: oklch(0.262 0.051 172.552);
    --accent-foreground: oklch(0.905 0.093 164.150);

    /* Destructive */
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0.005 27);

    /* Border / Input / Ring */
    --border: oklch(0.300 0.030 168);
    --input: oklch(0.300 0.030 168);
    --ring: oklch(0.696 0.170 162.480);

    /* Chart colors */
    --chart-1: oklch(0.696 0.170 162.480);
    --chart-2: oklch(0.765 0.177 163.223);
    --chart-3: oklch(0.596 0.145 163.225);
    --chart-4: oklch(0.845 0.143 164.978);
    --chart-5: oklch(0.508 0.118 165.612);

    /* Sidebar */
    --sidebar: oklch(0.180 0.018 168);
    --sidebar-foreground: oklch(0.950 0.020 166);
    --sidebar-primary: oklch(0.696 0.170 162.480);
    --sidebar-primary-foreground: oklch(0.145 0.015 168);
    --sidebar-accent: oklch(0.262 0.051 172.552);
    --sidebar-accent-foreground: oklch(0.905 0.050 164);
    --sidebar-border: oklch(0.300 0.030 168);
    --sidebar-ring: oklch(0.696 0.170 162.480);
  }
}
```

### Making Colors Available in Tailwind v4

Use the `@theme` directive to register custom colors:

```css
@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  /* ... etc */
}
```

---

## 5. Remix Icon Library

### Installation

```bash
npm install @remixicon/react
# or
pnpm add @remixicon/react
```

### Basic Usage

```tsx
import { RiDashboardLine, RiSettings3Line, RiUserLine } from '@remixicon/react'

// Default size is 24px (matches the 24x24 grid)
<RiDashboardLine />

// Custom size and color
<RiDashboardLine size={20} color="currentColor" className="text-muted-foreground" />
```

### Key Facts

- **2,800+ icons** in both line and filled variants
- **24x24 grid** -- all icons designed on this grid
- **Naming convention:** `Ri` prefix + name + `Line` or `Fill` suffix
- **Tree-shakeable:** Only imports the icons you use

### Integration with shadcn

#### Icon Sizing Conventions

| Context | Size | Usage |
|---------|------|-------|
| Inline with text (body) | 16px | Buttons, labels |
| Navigation items | 18-20px | Sidebar, tabs |
| Card headers / actions | 20px | Section indicators |
| Empty states / heroes | 24-48px | Illustrations |
| Button with icon only | 16-18px | Icon buttons |

#### Pattern: Icon Button

```tsx
import { RiFilterLine } from '@remixicon/react'
import { Button } from '@/components/ui/button'

<Button variant="outline" size="icon">
  <RiFilterLine size={16} />
</Button>
```

#### Pattern: Nav Item

```tsx
import { RiDashboardLine } from '@remixicon/react'

<SidebarMenuButton>
  <RiDashboardLine size={18} />
  <span>Dashboard</span>
</SidebarMenuButton>
```

#### When to Use Icons vs Text

- **Use icons:** Repeated actions, navigation, status indicators, toolbars, space-constrained UIs
- **Use text:** Primary CTAs, onboarding flows, complex actions, accessibility-critical contexts
- **Use both:** Navigation items, form labels, dashboard cards -- icon reinforces meaning, text provides clarity

### shadcn Icon Library Configuration

In `components.json`, you can configure a default icon library:

```json
{
  "iconLibrary": "remixicon"
}
```

Available options: `lucide` (default), `remixicon`, and others.

---

## 6. RTL Support

### Overview

As of January 2026, shadcn/ui has first-class RTL support. The CLI transforms physical CSS classes to logical equivalents at install time.

### Enabling RTL

**New projects:**
```bash
pnpm dlx shadcn@latest init --rtl
# or
pnpm dlx shadcn@latest create --rtl
```

**Existing projects (migration):**
```bash
pnpm dlx shadcn@latest migrate rtl
```

This transforms all components in the `ui` directory.

### What Gets Transformed

| Physical (LTR) | Logical (RTL-compatible) |
|-----------------|--------------------------|
| `ml-4` | `ms-4` |
| `mr-4` | `me-4` |
| `pl-4` | `ps-4` |
| `pr-4` | `pe-4` |
| `left-2` | `start-2` |
| `right-2` | `end-2` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `rounded-l-*` | `rounded-s-*` |
| `rounded-r-*` | `rounded-e-*` |
| `border-l-*` | `border-s-*` |
| `border-r-*` | `border-e-*` |
| `slide-in-from-left` | `slide-in-from-start` |
| `slide-in-from-right` | `slide-in-from-end` |

### Additional RTL Behaviors

- **Icons:** Directional icons receive `rtl:rotate-180` automatically
- **Animations:** Slide and directional animations are converted
- **Sidebar:** Layout flips automatically
- **Sheets:** Side sheets open from the correct direction

### HTML Setup

```html
<html dir="rtl" lang="ar">
```

### Supported Languages

Arabic, Hebrew, Persian, Urdu, and other RTL scripts.

---

## 7. Inter Font

### Why Inter for Dashboard UIs

- Designed specifically for computer screens and UI
- Tall x-height for readability at small sizes
- Open apertures for clarity
- Available as a variable font (100-900 weight axis + optical size axis)
- Free and open source

### Recommended Typographic Scale for Dashboards

```css
/* Font family setup */
@import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap');

:root {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
}
```

#### Type Scale

| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display` | 36px (2.25rem) | 700 | 1.1 | Page heroes, marketing |
| `h1` | 30px (1.875rem) | 700 | 1.2 | Page titles |
| `h2` | 24px (1.5rem) | 600 | 1.25 | Section titles |
| `h3` | 20px (1.25rem) | 600 | 1.3 | Card titles, subsections |
| `h4` | 16px (1rem) | 600 | 1.4 | Widget titles |
| `body` | 14px (0.875rem) | 400 | 1.5 | Default body text |
| `body-sm` | 13px (0.8125rem) | 400 | 1.5 | Secondary text, descriptions |
| `caption` | 12px (0.75rem) | 500 | 1.4 | Labels, metadata, timestamps |
| `overline` | 11px (0.6875rem) | 600 | 1.4 | Badges, category labels (uppercase) |
| `code` | 13px (0.8125rem) | 400 | 1.5 | Monospace / code blocks |

#### Optimal Weight Usage

| Weight | Name | Usage |
|--------|------|-------|
| 400 (Regular) | Body text, descriptions, form inputs |  |
| 500 (Medium) | Labels, table headers, captions, nav items |  |
| 600 (SemiBold) | Headings (h2-h4), emphasis, buttons |  |
| 700 (Bold) | Page titles (h1), key metrics, CTAs |  |

**Avoid:** Weights below 400 for UI text (too thin on screens). Weight 300 is acceptable only for large display text (24px+).

#### Dashboard-Specific Tips

1. **14px base size** -- standard for data-dense dashboards (not 16px which wastes space)
2. **Use 500 weight for table headers** -- distinguishes from body without being too heavy
3. **Tabular numbers:** Enable `font-variant-numeric: tabular-nums` for data columns

```css
/* Enable tabular figures for data */
.data-table td,
.metric-value {
  font-variant-numeric: tabular-nums;
}
```

4. **Letter spacing:** Inter has good default spacing. Only adjust for:
   - Uppercase/overline text: `letter-spacing: 0.05em`
   - Large headings (24px+): `letter-spacing: -0.02em` (tighten slightly)

5. **Variable font optical sizing:** Inter's variable font includes an `opsz` axis that automatically optimizes letterforms for the rendered size.

### Inter + Lyra Pairing Note

While Lyra officially recommends monospace fonts, Inter works well with the sharp aesthetic when used at **medium-heavy weights (500-700)** with **tight letter-spacing on headings**. The geometric quality of Inter at heavier weights complements the boxy Lyra style. Alternatively, pair Inter for body text with a monospace font (JetBrains Mono, IBM Plex Mono) for headings and accents.

---

## 8. Putting It All Together: Recommended Configuration

### components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-lyra",
  "tailwind": {
    "config": "",
    "css": "styles/globals.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "rsc": false,
  "tsx": true,
  "aliases": {
    "utils": "@/lib/utils",
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "remixicon"
}
```

### Global CSS Structure

```css
@import "tailwindcss";

@layer base {
  :root {
    --radius: 0rem;

    /* Emerald theme - light */
    --background: oklch(0.985 0.002 166);
    --foreground: oklch(0.205 0.015 168);
    --primary: oklch(0.596 0.145 163.225);
    --primary-foreground: oklch(0.985 0.005 166);
    /* ... full variable set from Section 4 ... */
  }

  .dark {
    --background: oklch(0.145 0.015 168);
    --foreground: oklch(0.950 0.020 166);
    --primary: oklch(0.696 0.170 162.480);
    --primary-foreground: oklch(0.145 0.015 168);
    /* ... full dark mode set from Section 4 ... */
  }
}

@theme inline {
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
}
```

### Design System Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Style preset | Lyra | Sharp, boxy, professional -- distinctive SaaS identity |
| Framework | TanStack Start | Modern RSC-less React, type-safe routing |
| Border radius | 0rem | Lyra default; brutalist but clean |
| Color theme | Emerald | Distinctive, not-the-usual-blue, conveys trust/growth |
| Icons | Remix Icon | 2800+ icons, 24x24 grid, tree-shakeable |
| Font | Inter Variable | Best-in-class UI font, tabular numbers |
| RTL | Enabled | CLI transforms at install time, future-proof |
| Dark mode | CSS class strategy | `.dark` class toggle, full OKLCH variable set |

---

## Sources

- [shadcn/ui Create Command (Dec 2025)](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create)
- [shadcn/ui Theming Documentation](https://ui.shadcn.com/docs/theming)
- [shadcn/ui RTL Support (Jan 2026)](https://ui.shadcn.com/docs/changelog/2026-01-rtl)
- [shadcn/ui TanStack Start Installation](https://ui.shadcn.com/docs/installation/tanstack)
- [shadcn/ui Components.json Reference](https://ui.shadcn.com/docs/components-json)
- [shadcn/ui Color Palette](https://ui.shadcn.com/colors)
- [shadcn Component Styles: Vega, Nova, Maia, Lyra, Mira](https://www.shadcnblocks.com/blog/shadcn-component-styles-vega-nova-maia-lyra-mira)
- [Tailwind CSS v4 Emerald OKLCH Values](https://tailwindcolor.com/emerald)
- [@remixicon/react on npm](https://www.npmjs.com/package/@remixicon/react)
- [Remix Icon GitHub](https://github.com/Remix-Design/RemixIcon)
- [tweakcn Theme Editor](https://tweakcn.com/)
- [Inter Font Family](https://rsms.me/inter/)
- [shadcn RTL announcement](https://x.com/shadcn/status/2017287507881164816)
- [shadcn style presets announcement](https://x.com/shadcn/status/1999530419125981676)
