# Design Guidelines: Validater

**Created:** 2026-03-06
**Aesthetic:** Clean Sharp (Linear/Vercel-inspired) with emerald accent
**Identity:** Professional, precise, data-dense, keyboard-first

---

## 1. Design Philosophy

Validater's design language is **Clean Sharp** -- professional and distinctive without being distracting. Inspired by Linear, Vercel, and Raycast.

**Core Principles:**
- **Square is intentional.** Sharp corners convey precision and authority -- fitting for a testing/validation tool.
- **Density over whitespace.** Developers prefer information-dense UIs. Show data, not decoration.
- **Dark-first, light-supported.** Design for dark mode first, ensure light mode works too.
- **Emerald as accent, not wallpaper.** One brand color used sparingly for maximum impact.
- **Keyboard-first.** Every action has a shortcut. Show shortcuts in the UI.
- **Motion is functional.** Transitions serve navigation, not delight.

---

## 2. Color System

### Primary: Emerald

```
Light Mode:                    Dark Mode:
Primary:     emerald-600       Primary:     emerald-500
Hover:       emerald-700       Hover:       emerald-400
Active:      emerald-800       Active:      emerald-600
Subtle BG:   emerald-50        Subtle BG:   emerald-950/8%
Text:        emerald-700       Text:        emerald-400
```

### Surfaces

```
Light Mode:                    Dark Mode:
Base:        #f8fafc            Base:        #0a0a0f
Surface 1:   #ffffff            Surface 1:   #111118
Surface 2:   #f1f5f9            Surface 2:   #1a1a24
Surface 3:   #e2e8f0            Surface 3:   #24242f
Surface 4:   #cbd5e1            Surface 4:   #2e2e3a
```

Avoid pure black (#000) -- causes halation. Avoid pure white for dark mode text -- use slate-100 (#f1f5f9).

### Text

```
Light Mode:                    Dark Mode:
Primary:     slate-900          Primary:     slate-100
Secondary:   slate-600          Secondary:   slate-400
Tertiary:    slate-400          Tertiary:    slate-500
On Primary:  #ffffff            On Primary:  emerald-950
```

### Borders

```
Light Mode:                    Dark Mode:
Default:     slate-200          Default:     #1e293b
Subtle:      slate-100          Subtle:      #1a1a24
Strong:      slate-300          Strong:      #334155
Accent:      emerald-200        Accent:      emerald-800
```

### Status Colors (Solving Green-on-Green)

Primary brand uses emerald (hue ~160). Status pass uses pure green (hue ~142). Always pair with icons + text labels.

```
                Light Mode          Dark Mode
Pass:           #22c55e             #4ade80     (green-500/400, NOT emerald)
  Background:   #f0fdf4             rgba(34,197,94,0.1)
  Text:         #166534             #86efac
  Icon:         Filled checkmark circle

Fail:           #ef4444             #f87171     (red-500/400)
  Background:   #fef2f2             rgba(239,68,68,0.1)
  Text:         #991b1b             #fca5a5
  Icon:         Filled X circle

Pending:        #f59e0b             #fbbf24     (amber-500/400)
  Background:   #fffbeb             rgba(245,158,11,0.1)
  Text:         #92400e             #fcd34d
  Icon:         Outline clock circle

Running:        #3b82f6             #60a5fa     (blue-500/400)
  Background:   #eff6ff             rgba(59,130,246,0.1)
  Text:         #1e40af             #93c5fd
  Icon:         Animated spinner ring

Skipped:        #64748b             #94a3b8     (slate-500/400)
  Background:   #f1f5f9             rgba(100,116,139,0.1)
  Text:         #334155             #cbd5e1
  Icon:         Dash in outline circle
```

**Rule: Never use color alone.** Every status indicator must have icon + text label for accessibility.

### shadcn CSS Variables (OKLCH)

```css
@layer base {
  :root {
    --radius: 0rem;

    /* Emerald theme - light */
    --background: oklch(0.985 0.002 166);
    --foreground: oklch(0.205 0.015 168);
    --card: oklch(0.995 0.001 166);
    --card-foreground: oklch(0.205 0.015 168);
    --popover: oklch(0.995 0.001 166);
    --popover-foreground: oklch(0.205 0.015 168);
    --primary: oklch(0.596 0.145 163.225);
    --primary-foreground: oklch(0.985 0.005 166);
    --secondary: oklch(0.950 0.052 163.051);
    --secondary-foreground: oklch(0.378 0.077 168.940);
    --muted: oklch(0.950 0.020 166);
    --muted-foreground: oklch(0.508 0.040 166);
    --accent: oklch(0.905 0.093 164.150);
    --accent-foreground: oklch(0.262 0.051 172.552);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0.005 27);
    --border: oklch(0.905 0.030 164);
    --input: oklch(0.905 0.030 164);
    --ring: oklch(0.596 0.145 163.225);
    --chart-1: oklch(0.696 0.170 162.480);
    --chart-2: oklch(0.596 0.145 163.225);
    --chart-3: oklch(0.765 0.177 163.223);
    --chart-4: oklch(0.508 0.118 165.612);
    --chart-5: oklch(0.845 0.143 164.978);
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
    --background: oklch(0.145 0.015 168);
    --foreground: oklch(0.950 0.020 166);
    --card: oklch(0.180 0.018 168);
    --card-foreground: oklch(0.950 0.020 166);
    --popover: oklch(0.180 0.018 168);
    --popover-foreground: oklch(0.950 0.020 166);
    --primary: oklch(0.696 0.170 162.480);
    --primary-foreground: oklch(0.145 0.015 168);
    --secondary: oklch(0.262 0.051 172.552);
    --secondary-foreground: oklch(0.905 0.050 164);
    --muted: oklch(0.262 0.030 168);
    --muted-foreground: oklch(0.696 0.040 164);
    --accent: oklch(0.262 0.051 172.552);
    --accent-foreground: oklch(0.905 0.093 164.150);
    --destructive: oklch(0.577 0.245 27.325);
    --destructive-foreground: oklch(0.985 0.005 27);
    --border: oklch(0.300 0.030 168);
    --input: oklch(0.300 0.030 168);
    --ring: oklch(0.696 0.170 162.480);
    --chart-1: oklch(0.696 0.170 162.480);
    --chart-2: oklch(0.765 0.177 163.223);
    --chart-3: oklch(0.596 0.145 163.225);
    --chart-4: oklch(0.845 0.143 164.978);
    --chart-5: oklch(0.508 0.118 165.612);
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

---

## 3. Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;
```

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Usage |
|-------|------|--------|-------------|----------------|-------|
| `2xs` | 10px | 500 | 1.4 | +0.02em | Micro labels, timestamps |
| `xs` | 11px | 400-500 | 1.45 | +0.01em | Table cells compact, badges |
| `sm` | 12px | 400-500 | 1.5 | +0.005em | Table cells, secondary text |
| `base` | 13px | 400 | 1.54 | 0 | **Body text, descriptions** |
| `md` | 14px | 400-500 | 1.57 | 0 | Form labels, nav items |
| `lg` | 16px | 500-600 | 1.5 | -0.005em | Section headers, card titles |
| `xl` | 18px | 600 | 1.44 | -0.01em | Page section titles |
| `2xl` | 20px | 600 | 1.4 | -0.015em | Page titles |
| `3xl` | 24px | 700 | 1.33 | -0.02em | Dashboard KPI numbers |
| `4xl` | 30px | 700 | 1.2 | -0.025em | Hero metrics |

**Key rules:**
- **13px base** for dashboard body text (Inter's large x-height makes this very readable)
- **14px** for form labels and nav items
- **Negative letter-spacing** on headings (24px+): tighten by -0.02em to -0.03em
- **Positive letter-spacing** on small text (< 12px): widen by +0.01em
- **ALL CAPS text**: always +0.05em to +0.1em letter-spacing
- **Tabular numbers** on all data: `font-variant-numeric: tabular-nums`

### Font Weights

| Weight | Usage |
|--------|-------|
| 400 Regular | Body text, descriptions, table cells |
| 500 Medium | Labels, nav items, table headers, badges |
| 600 SemiBold | Card titles, section headers, buttons |
| 700 Bold | Page titles, KPI numbers, emphasis |

### Code Font

```
JetBrains Mono at:
- 11px for inline code
- 12px for code blocks
- 13px for editor views
Line height: 1.6
```

---

## 4. Shape & Spacing

### Border Radius: Square Design

Lyra preset sets `--radius: 0rem`. All shadcn components render with sharp 90-degree corners.

**Where true 0px:** Tables, badges, progress bars, navigation tabs, toolbar buttons, dividers
**Where 2px softening allowed:** Standalone buttons, inputs, dropdowns, toasts (prevents pixel aliasing on non-retina)
**Maximum 4px:** Cards, modals, popovers (only if needed for visual polish)

### Depth Strategy: Borders Over Shadows

- **Prefer 1px borders** for separation (cards, panels, inputs, table cells)
- **Shadows only for floating elements** (dropdowns, modals, popovers)
- **Dark mode:** Elevation through lightness (lighter = closer), not shadows

### Visual Interest Without Curves

1. **Accent lines** -- 3px emerald top-border on cards, left-border for active states
2. **Color blocks** -- Solid background segments for section differentiation
3. **Strong typography hierarchy** -- Bold weights and size contrast
4. **Geometric grid** -- Bento-box card arrangements, consistent grid alignment
5. **Negative space** -- Let whitespace breathe between dense data sections

### Spacing Scale (4px grid)

```
0: 0px    1: 4px    2: 8px    3: 12px   4: 16px
5: 20px   6: 24px   8: 32px   10: 40px  12: 48px
16: 64px  20: 80px  24: 96px
```

### Density Modes

| Token | Comfortable (default) | Compact |
|-------|-----------------------|---------|
| Page padding | 24px | 16px |
| Section gap | 24px | 16px |
| Card padding | 20px | 12px |
| Card gap | 16px | 12px |
| Table cell Y | 12px | 6px |
| Table cell X | 16px | 12px |
| Input Y | 8px | 4px |
| Button Y | 8px | 4px |
| List item Y | 10px | 6px |
| Stack gap | 12px | 8px |

---

## 5. Layout Architecture

### Global Layout

```
+--------+----------------------------------------+
|  Logo  |                                        |
|--------|        Main Content Area               |
| [icon] Tests                                    |
| [icon] Runs        (cards, tables, or          |
| [icon] Analytics    detail views)               |
| [icon] Settings                                 |
|        |                                        |
|--------|                                        |
| [avatar]                                        |
| Settings                                        |
+--------+----------------------------------------+
```

- **Sidebar:** 240px, collapsible to 48px icon-only mode
- **Active state:** Emerald left-border (3px) + tinted background
- **Content area:** Max 1440px centered, full-bleed for data tables
- **Header:** 56px comfortable / 48px compact

### Keyboard Navigation

- `Cmd+K` -- Command palette (search, navigate, actions)
- `G T` -- Go to Tests
- `G R` -- Go to Runs
- `G S` -- Go to Settings
- Show shortcuts next to nav items and in tooltips

---

## 6. Page-Specific Layouts

### Test Creation (Progressive Disclosure)

**Level 1 -- Minimal (default):**
```
+----------------------------------------------------+
|  Enter your website URL                             |
|  [https://                                    ] [Go]|
+----------------------------------------------------+
```

**Level 2 -- After URL entered:**
```
+----------------------------------------------------+
|  URL: https://example.com                    [edit] |
|                                                    |
|  What should we test?                              |
|  +------------------------------------------------+|
|  | Test the login flow with valid credentials     ||
|  +------------------------------------------------+|
|                                                    |
|  [Run Test]                                        |
+----------------------------------------------------+
```

**Level 3 -- Advanced (expandable):**
```
  v Advanced Options
  Viewports: [x] Desktop  [x] Tablet  [ ] Mobile
  Tags:      [ smoke, login ]
```

### Live Execution View (Split Pane)

```
+---------------------------+------------------+
|                           |  Step Log        |
|   Browser Viewport        |  1. Navigate [v] |
|   (CDP screencast)        |  2. Click    [v] |
|   65% width               |  3. Fill     [>] |
|                           |  4. Assert   [ ] |
+---------------------------+------------------+
|        Timeline / Progress Bar               |
+----------------------------------------------+
```

- Browser viewport: 65% width
- Command log: 35% width
- Resizable divider between panels
- Step highlighting synced with browser actions
- Action indicator on browser (red dot at click location)

### Test Results (Hybrid List + Accordion)

```
+-----------------------------------------------+
| Timeline: --[1]--[2]--[3]--[4!]--[5]--       |
+-----------------------------------------------+
| [v] Step 1: Navigate to /login       0.5s     |
| [v] Step 2: Click "Login" button     0.3s     |
| [v] Step 3: Enter email              0.2s     |
| [X] Step 4: Assert "Welcome"         1.2s  <- |
|     > Screenshot: [thumbnail]                  |
|     > Expected: "Welcome" visible              |
|     > Actual: Element not found                |
| [-] Step 5: Click "Dashboard"        skipped  |
+-----------------------------------------------+
| [Jump to failure]                              |
+-----------------------------------------------+
```

- Default: compact list with status icons + duration
- Click to expand: screenshot, element details, network calls
- Timeline bar at top for macro-level view
- Sticky "Jump to failure" button

### Multi-Viewport Results (Grid View)

```
+-------------------+-------------------+
|  Desktop          |  Tablet           |
|  [v] 12/12 pass   |  [v] 12/12 pass   |
|  [screenshot]     |  [screenshot]     |
+-------------------+-------------------+
|  Mobile           |  Summary          |
|  [X] 8/12 pass    |  2/3 viewports ok |
|  [screenshot]     |  1 failure: mobile|
+-------------------+-------------------+
```

- Grid overview with summary cards per viewport
- Click to drill into full step-by-step results
- Viewport-specific failure badges in test overview

### Video Player

```
+------------------------------------------------+
|            Video Viewport (16:9)               |
+------------------------------------------------+
| [<<] [play] [>>]  00:12/00:45  [1x v] [full]  |
| ---[1]---[2]---[3]---[4!]---[5]--------------- |
+------------------------------------------------+
|  Steps (synced with video):                    |
|  [v] 1. Navigate to homepage      00:00        |
|  [v] 2. Click login               00:05        |
|  [>] 3. Enter credentials         00:10  <--   |
+------------------------------------------------+
```

- Step markers on timeline (red for failures)
- Thumbnail preview on timeline hover
- Auto-pause on failure
- Speed: 0.5x, 1x, 1.5x, 2x
- Step list synced with video playback

---

## 7. Component Conventions

### Icons (Remix Icon)

```tsx
import { RiDashboardLine, RiPlayLine } from '@remixicon/react'
```

| Context | Size |
|---------|------|
| Inline with body text | 16px |
| Navigation items | 18-20px |
| Card headers | 20px |
| Empty states | 24-48px |
| Icon-only buttons | 16-18px |

**Rules:**
- Use `Line` variants for navigation and UI chrome
- Use `Fill` variants for active/selected states
- Always set `color="currentColor"` for theme compatibility
- Pair icons with text labels (icon-only acceptable only for well-known actions: play, pause, close)

### Buttons

| Variant | Background | Border | Text | Use For |
|---------|------------|--------|------|---------|
| Primary | emerald-600 | emerald-600 | white | Main CTAs: "Run Test", "Save" |
| Secondary | transparent | slate-300 | primary text | Secondary actions: "Cancel", "Export" |
| Ghost | transparent | none | secondary text | Tertiary actions, icon buttons |
| Destructive | red-500 | red-500 | white | Delete, remove actions |

### Cards

- 1px border, surface-2 background
- Accent variant: 3px emerald top-border
- Status variant: 3px colored left-border (pass=green, fail=red)
- Interactive: border-color darkens on hover

### Tables

- 0px border-radius on all table elements
- Uppercase table headers at 11px, 500 weight, +0.05em spacing
- Row hover: surface-3 background
- Failed rows: subtle red background tint
- Tabular numbers on all numeric columns

### Badges

- 0px border-radius (sharp rectangular badges)
- 1px border matching text color
- Status icon + text label always
- 11px, 500 weight

### Inputs

- 2px border-radius (prevent aliasing)
- Surface-3 background
- Emerald ring on focus
- 13px text size

---

## 8. Motion & Animation

### Timing

| Token | Duration | Usage |
|-------|----------|-------|
| instant | 50ms | Focus rings, toggles |
| fast | 100ms | Button hover, color changes |
| normal | 150ms | Dropdowns, popovers |
| moderate | 200ms | Panels, accordions |
| slow | 300ms | Modals, page transitions |

### Easing

- **Default:** `cubic-bezier(0.4, 0, 0.2, 1)` for most transitions
- **Enter:** `cubic-bezier(0, 0, 0.2, 1)` for elements appearing
- **Exit:** `cubic-bezier(0.4, 0, 1, 1)` for elements leaving
- **No bounce/spring** -- precision, not playfulness

### Test-Specific Animations

- **Running indicator:** Pulsing blue dot (1.5s ease-in-out loop)
- **Step completion:** Fade + slide from left (150ms)
- **Staggered results:** Each row delays 30ms after previous
- **Progress bar:** Smooth width transition (300ms)
- **Skeleton loading:** Pulse opacity 0.4 -> 0.1 -> 0.4 (2s loop)

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  .spinner { animation: spin 2s linear infinite; }  /* Keep functional */
}
```

---

## 9. Accessibility

### Contrast Requirements

| Element | Light Mode Min | Dark Mode Min |
|---------|---------------|---------------|
| Body text on background | emerald-700 on white (5.1:1 AA) | emerald-400 on #111118 (7.8:1 AAA) |
| Primary button text | white on emerald-600 (~4.5:1 AA) | emerald-950 on emerald-500 |
| Links | emerald-700 + underline | emerald-400 + underline |

### Focus Indicators

```css
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  border-radius: 0px;  /* Square focus rings */
}
```

### Color-Blind Safety

- Pass (green) and Fail (red) are ALWAYS differentiated by icon shape + text label
- Never rely on color alone for any status
- Test all status combinations in deuteranopia simulator

### Semantic HTML Requirements

- `<nav>`, `<main>`, `<aside>`, `<header>` for landmarks
- `aria-label` on all status indicators
- `aria-live="polite"` on live test results
- `role="progressbar"` with `aria-valuenow` on progress indicators
- Skip-to-content link at page top

---

## 10. shadcn Configuration Reference

### components.json

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "base-lyra",
  "tailwind": {
    "config": "",
    "css": "app/styles/globals.css",
    "baseColor": "gray",
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

### Scaffolding Command

```bash
bunx --bun shadcn@latest create --rtl \
  --preset "https://ui.shadcn.com/init?base=base&style=lyra&baseColor=gray&theme=emerald&iconLibrary=remixicon&font=inter&menuAccent=subtle&menuColor=default&radius=default&template=start&rtl=true" \
  --template start
```

### Key Preset Choices

| Setting | Value | Rationale |
|---------|-------|-----------|
| Style | Lyra | Sharp, boxy, 0 border-radius |
| Base Color | Gray | Neutral slate grays |
| Theme | Emerald | Distinctive, not-the-usual-blue |
| Icon Library | Remix Icon | 2800+ icons, tree-shakeable |
| Font | Inter | Best-in-class UI font |
| RTL | Enabled | Future-proof, logical CSS properties |
| Template | TanStack Start | Modern React, type-safe routing |

---

## 11. Anti-Patterns (Do NOT Do)

- **No rounded corners > 4px anywhere** -- breaks the sharp identity
- **No soft/blurry shadows on cards** -- use borders instead
- **No gradient backgrounds** -- flat solid colors only
- **No playful/bouncy animations** -- functional motion only
- **No color-only status indicators** -- always icon + text
- **No decorative illustrations** -- geometric, data-driven visuals
- **No > 16px body text** -- wastes space in a data-dense dashboard
- **No warm grays** -- use cool slate grays that complement emerald
- **No random emoji** -- professional iconography only
- **No inconsistent spacing** -- always 4px grid
- **No light mode as afterthought** -- both modes must be intentional

---

*This document is the authoritative design reference for all Validater UI work. All components, pages, and features must conform to these guidelines.*
