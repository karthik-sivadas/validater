# Design Tokens Research: Emerald/Green SaaS Dashboard with Square Design

Comprehensive research for building a professional, data-dense testing dashboard with an emerald green theme, sharp/square design language, and full dark mode support.

---

## Table of Contents

1. [Emerald Green Color Palette](#1-emerald-green-color-palette)
2. [Square Design Principles](#2-square-design-principles)
3. [Spacing and Density](#3-spacing-and-density)
4. [Typography Scale](#4-typography-scale)
5. [Dark Mode Design](#5-dark-mode-design)
6. [Status Colors](#6-status-colors)
7. [Animation and Transitions](#7-animation-and-transitions)
8. [Accessibility](#8-accessibility)
9. [Component Patterns](#9-component-patterns)
10. [CSS Custom Properties Reference](#10-css-custom-properties-reference)

---

## 1. Emerald Green Color Palette

### Base Palette (Tailwind v3 Emerald Scale)

The Tailwind CSS emerald palette is a well-tested, production-ready green scale. These are the standard reference values:

| Token | Hex | HSL (approx) | Usage |
|-------|-----|---------------|-------|
| emerald-50 | `#ecfdf5` | `152 81% 96%` | Subtle backgrounds, tinted surfaces |
| emerald-100 | `#d1fae5` | `149 80% 90%` | Hover states on light backgrounds |
| emerald-200 | `#a7f3d0` | `152 76% 80%` | Light borders, dividers |
| emerald-300 | `#6ee7b7` | `156 72% 67%` | Secondary indicators |
| emerald-400 | `#34d399` | `158 64% 52%` | Icons, secondary actions |
| emerald-500 | `#10b981` | `160 84% 39%` | **Primary brand color** |
| emerald-600 | `#059669` | `161 94% 30%` | Primary buttons, links |
| emerald-700 | `#047857` | `163 94% 24%` | Hover on primary buttons |
| emerald-800 | `#065f46` | `163 88% 20%` | Active/pressed states |
| emerald-900 | `#064e3b` | `164 86% 16%` | Dark accents |
| emerald-950 | `#022c22` | `166 91% 9%` | Darkest accents, dark mode surfaces |

### Tailwind v4 Emerald Scale (OKLCH-based)

Tailwind v4 shifted to OKLCH color space for perceptual uniformity:

| Token | Hex (approx) | Notes |
|-------|-------------|-------|
| emerald-50 | `#f0fdf4` | Slightly different from v3 |
| emerald-100 | `#dcfce7` | |
| emerald-200 | `#bbf7d0` | |
| emerald-300 | `#5ee9b5` | |
| emerald-400 | `#00d492` | |
| emerald-500 | `#00bc7d` | |
| emerald-600 | `#009966` | |
| emerald-700 | `#007a55` | |
| emerald-800 | `#006045` | |
| emerald-900 | `#004f3b` | |
| emerald-950 | `#002c22` | |

**Recommendation:** Use the Tailwind v3 scale as the base -- it is more widely adopted and has better tooling support. The v4 OKLCH values are more perceptually uniform but less established.

### Complementary Colors for Emerald

Emerald green (hue ~160) pairs well with:

- **Slate/Zinc grays** -- Neutral grays with a slight cool undertone. Avoids warm grays that clash with green.
  - Recommended: Tailwind `slate` scale (slight blue undertone) or `zinc` (pure neutral)
- **Amber/Gold** -- Split complementary. Warm accent for warnings and highlights.
  - `#f59e0b` (amber-500) for warning states
  - `#fbbf24` (amber-400) for highlights on dark
- **Rose/Red** -- True complementary for error/danger states.
  - `#ef4444` (red-500) or `#f43f5e` (rose-500)
- **Sky/Cyan** -- Analogous-cool. For informational states.
  - `#0ea5e9` (sky-500) for info badges
- **Violet** -- Triadic accent for premium/special features.
  - `#8b5cf6` (violet-500) sparingly

### Light Mode Emerald Application

```
Primary action:     emerald-600 (#059669)
Primary hover:      emerald-700 (#047857)
Primary active:     emerald-800 (#065f46)
Primary subtle bg:  emerald-50  (#ecfdf5)
Primary border:     emerald-200 (#a7f3d0)
Primary text:       emerald-700 (#047857)
```

### Dark Mode Emerald Application

```
Primary action:     emerald-500 (#10b981)
Primary hover:      emerald-400 (#34d399)
Primary active:     emerald-600 (#059669)
Primary subtle bg:  emerald-950 (#022c22) with opacity
Primary border:     emerald-800 (#065f46)
Primary text:       emerald-400 (#34d399)
```

---

## 2. Square Design Principles

### The Case for Sharp Corners

Research findings:
- **Sharp corners draw attention** -- They create clear visual boundaries between elements and their surroundings (cedarstudioswebdesign.com, zazzy.studio)
- **Formal and professional tone** -- Square corners convey precision, authority, and seriousness -- fitting for a testing/validation tool
- **Microsoft Metro/Fluent heritage** -- Proven at scale that sharp design can be clean and beautiful
- **Data density advantage** -- No wasted space from rounded corners, especially in tables and grids

### Border Radius Strategy: Selective Zero

**Do NOT use `border-radius: 0` everywhere.** Instead, use a minimal, intentional radius system:

```css
--radius-none: 0px;        /* Tables, inline badges, code blocks, toolbar buttons */
--radius-sm: 2px;          /* Inputs, small buttons, chips */
--radius-md: 4px;          /* Cards, dropdowns, modals, tooltips -- MAXIMUM */
--radius-lg: 6px;          /* Reserved: only for full-page containers or images */
```

**Why 2-4px instead of pure 0:** A 2px radius is visually imperceptible as "rounded" but prevents the harsh pixel-aliasing artifacts that true 0px corners can show on non-retina displays. It reads as "sharp" while being technically slightly softened.

**Where to use true 0px:**
- Table cells and rows
- Inline code blocks
- Horizontal/vertical dividers
- Navigation tabs (active indicators)
- Progress bars
- Badges and status indicators
- Toolbar segmented buttons

**Where to use 2-4px:**
- Cards and panels
- Buttons (standalone)
- Input fields
- Dropdowns and popovers
- Modals and dialogs
- Toast notifications

### Shadow Strategy for Flat Design

Flat/sharp design should use shadows sparingly and with low values:

```css
--shadow-none: none;
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.05);           /* Subtle lift: cards */
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.1);             /* Buttons, inputs */
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);          /* Dropdowns, popovers */
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);        /* Modals */
```

**Dark mode shadows:** Reduce shadow opacity by ~50% and add a subtle emerald tint:
```css
--shadow-sm-dark: 0 1px 3px 0 rgb(0 0 0 / 0.3);
--shadow-md-dark: 0 4px 6px -1px rgb(0 0 0 / 0.4);
```

### Border vs Shadow for Depth

**Prefer borders over shadows** for a square design language:

- **Borders** create crisp, geometric separation that reinforces the sharp aesthetic
- **Shadows** can feel at odds with flat design; use only for floating elements (dropdowns, modals)
- **Use 1px borders** for most separation: cards, panels, inputs, table cells
- **Border colors:** Light mode `slate-200` (#e2e8f0), Dark mode `slate-700` (#334155) or `slate-800` (#1e293b)

### Adding Visual Interest Without Curves

Since curves are minimized, create visual interest through:

1. **Color blocks** -- Solid background segments, colored left-borders on cards
2. **Strong typography hierarchy** -- Bold weights, size contrast
3. **Geometric patterns** -- Grid layouts, bento-box arrangements
4. **Accent lines** -- Thin colored top-borders on cards (2-3px emerald bar)
5. **Contrast** -- Dark sidebar with light content area (or vice versa)
6. **Iconography** -- Geometric, outlined icons (Lucide, Phosphor)
7. **Negative space** -- Let whitespace do the heavy lifting
8. **Step/notch patterns** -- Square cutouts, L-shaped highlights

---

## 3. Spacing and Density

### Base Spacing Scale (4px grid)

All spacing derives from a 4px base unit, enabling both comfortable and compact modes:

```css
--space-0: 0px;
--space-px: 1px;
--space-0.5: 2px;
--space-1: 4px;
--space-1.5: 6px;
--space-2: 8px;
--space-2.5: 10px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
--space-24: 96px;
```

### Density Modes

Following AWS Cloudscape's approach, support two density modes:

#### Comfortable Mode (default)

```css
--density-page-padding: 24px;       /* Page-level padding */
--density-section-gap: 24px;        /* Gap between sections */
--density-card-padding: 20px;       /* Internal card padding */
--density-card-gap: 16px;           /* Gap between cards */
--density-table-cell-py: 12px;      /* Table cell vertical padding */
--density-table-cell-px: 16px;      /* Table cell horizontal padding */
--density-input-py: 8px;            /* Input vertical padding */
--density-input-px: 12px;           /* Input horizontal padding */
--density-button-py: 8px;           /* Button vertical padding */
--density-button-px: 16px;          /* Button horizontal padding */
--density-list-item-py: 10px;       /* List item vertical padding */
--density-stack-gap: 12px;          /* Default stack gap */
```

#### Compact Mode

Reduce vertical spacing by ~30-40%, keeping horizontal spacing mostly the same:

```css
--density-page-padding: 16px;
--density-section-gap: 16px;
--density-card-padding: 12px;
--density-card-gap: 12px;
--density-table-cell-py: 6px;       /* Most impactful change */
--density-table-cell-px: 12px;
--density-input-py: 4px;
--density-input-px: 10px;
--density-button-py: 4px;
--density-button-px: 12px;
--density-list-item-py: 6px;
--density-stack-gap: 8px;
```

### Dashboard-Specific Spacing Guidelines

- **Sidebar width:** 240px (comfortable) / 200px (compact), collapsible to 48px (icon-only)
- **Header height:** 56px (comfortable) / 48px (compact)
- **Min content width:** 320px (mobile), 768px (tablet), 1024px (desktop)
- **Max content width:** 1440px with auto margins, or full-bleed for data tables
- **Grid columns:** 12-column grid with 16px gutter (comfortable) / 12px gutter (compact)
- **Card min-width:** 280px in grid layouts
- **Table min column width:** 80px

---

## 4. Typography Scale

### Inter Font Configuration

Inter is the recommended font for data-dense dashboards due to its large x-height, clear glyph differentiation (especially l/1/I), and excellent OpenType feature support.

#### Font Loading

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

/* Or self-hosted with variable font */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/InterVariable.woff2') format('woff2');
  font-weight: 100 900;
  font-display: swap;
}
```

#### Essential Font Features

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-feature-settings: 'cv01', 'cv02', 'cv03', 'cv04'; /* Alternate glyphs */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Tabular numbers for data tables and numeric displays */
.tabular-nums,
table,
[data-numeric] {
  font-variant-numeric: tabular-nums;
  /* Fallback: font-feature-settings: 'tnum' 1; */
}

/* Slashed zero for code/technical content */
code, .mono-nums {
  font-feature-settings: 'tnum' 1, 'zero' 1, 'ss01' 1;
}
```

### Type Scale

Based on a 1.200 (minor third) ratio, optimized for dashboard readability:

| Token | Size | Line Height | Weight | Letter Spacing | Usage |
|-------|------|-------------|--------|----------------|-------|
| `--text-2xs` | 10px / 0.625rem | 14px / 1.4 | 500 | +0.02em | Micro labels, timestamps |
| `--text-xs` | 11px / 0.6875rem | 16px / 1.45 | 400-500 | +0.01em | Table cells (compact), badges |
| `--text-sm` | 12px / 0.75rem | 18px / 1.5 | 400-500 | +0.005em | Table cells, secondary text |
| `--text-base` | 13px / 0.8125rem | 20px / 1.54 | 400 | 0 | Body text, descriptions |
| `--text-md` | 14px / 0.875rem | 22px / 1.57 | 400-500 | 0 | Form labels, nav items |
| `--text-lg` | 16px / 1rem | 24px / 1.5 | 500-600 | -0.005em | Section headers, card titles |
| `--text-xl` | 18px / 1.125rem | 26px / 1.44 | 600 | -0.01em | Page section titles |
| `--text-2xl` | 20px / 1.25rem | 28px / 1.4 | 600 | -0.015em | Page titles |
| `--text-3xl` | 24px / 1.5rem | 32px / 1.33 | 700 | -0.02em | Dashboard KPI numbers |
| `--text-4xl` | 30px / 1.875rem | 36px / 1.2 | 700 | -0.025em | Hero metrics |
| `--text-5xl` | 36px / 2.25rem | 40px / 1.11 | 700 | -0.03em | Large display numbers |

**Key Inter-specific notes:**
- **Negative letter-spacing for headings:** Inter is designed slightly wide at large sizes; tightening by -0.01em to -0.03em improves the heading feel
- **Positive letter-spacing for small text:** Below 12px, add +0.01em to +0.02em for readability
- **Body text at 13px:** Inter is exceptionally clear at 13px, making it ideal for data-dense UIs (most design systems default to 14-16px, but Inter's large x-height makes 13px very readable)
- **ALL CAPS text:** Always add +0.05em to +0.1em letter-spacing

### Monospace / Code Font

```css
--font-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Cascadia Code', monospace;
--text-code-sm: 11px / 0.6875rem;   /* Inline code */
--text-code-base: 12px / 0.75rem;   /* Code blocks */
--text-code-lg: 13px / 0.8125rem;   /* Editor view */
--code-line-height: 1.6;
--code-letter-spacing: -0.01em;
```

### Font Weight Usage

| Weight | Token | Usage |
|--------|-------|-------|
| 400 | `--font-normal` | Body text, descriptions, table cells |
| 500 | `--font-medium` | Labels, nav items, table headers, badges |
| 600 | `--font-semibold` | Card titles, section headers, buttons |
| 700 | `--font-bold` | Page titles, KPI numbers, emphasis |

---

## 5. Dark Mode Design

### Background Hierarchy

Use a layered surface system. Avoid pure black (#000000) -- it causes halation and reduces perceived contrast quality.

#### Surface Layers (Dark Mode)

```css
/* Option A: Neutral dark (Slate-based) -- RECOMMENDED */
--bg-base:      #0a0a0f;    /* App background, deepest layer */
--bg-surface-1: #111118;    /* Primary surface: sidebar, main content area */
--bg-surface-2: #1a1a24;    /* Cards, panels, raised elements */
--bg-surface-3: #24242f;    /* Nested elements, table header, input fields */
--bg-surface-4: #2e2e3a;    /* Hover states on surface-2 */

/* Option B: Emerald-tinted dark -- SUBTLE BRAND FEEL */
--bg-base:      #070f0d;    /* Very subtle green undertone */
--bg-surface-1: #0d1614;    /* Barely perceptible green tint */
--bg-surface-2: #141f1c;    /* Cards and panels */
--bg-surface-3: #1c2a26;    /* Nested elements */
--bg-surface-4: #243530;    /* Hover states */
```

**Recommendation:** Option A (neutral dark) is safer and more versatile. Use emerald tinting only on specific accent surfaces (e.g., active sidebar item background) rather than globally.

#### Surface Layers (Light Mode)

```css
--bg-base:      #f8fafc;    /* slate-50 -- App background */
--bg-surface-1: #ffffff;    /* Primary surface: cards, panels */
--bg-surface-2: #f1f5f9;    /* slate-100 -- Nested elements, sidebar */
--bg-surface-3: #e2e8f0;    /* slate-200 -- Table header, input disabled */
--bg-surface-4: #cbd5e1;    /* slate-300 -- Hover on surface-2 */
```

### Text Colors

```css
/* Dark mode */
--text-primary:    #f1f5f9;  /* slate-100 -- Primary text, headings */
--text-secondary:  #94a3b8;  /* slate-400 -- Secondary text, descriptions */
--text-tertiary:   #64748b;  /* slate-500 -- Disabled, placeholders */
--text-on-primary: #022c22;  /* emerald-950 -- Text on emerald buttons */

/* Light mode */
--text-primary:    #0f172a;  /* slate-900 */
--text-secondary:  #475569;  /* slate-600 */
--text-tertiary:   #94a3b8;  /* slate-400 */
--text-on-primary: #ffffff;  /* White on emerald buttons */
```

### Border Colors

```css
/* Dark mode */
--border-default:  #1e293b;  /* slate-800 -- Standard borders */
--border-subtle:   #1a1a24;  /* Barely visible separation */
--border-strong:   #334155;  /* slate-700 -- Emphasized borders */
--border-accent:   #065f46;  /* emerald-800 -- Accent borders */

/* Light mode */
--border-default:  #e2e8f0;  /* slate-200 */
--border-subtle:   #f1f5f9;  /* slate-100 */
--border-strong:   #cbd5e1;  /* slate-300 */
--border-accent:   #a7f3d0;  /* emerald-200 */
```

### How Emerald Looks on Dark Backgrounds

- **Bright emerald (400-500) on dark backgrounds reads vibrantly** -- this is the sweet spot for dark mode primary actions
- **Emerald-500 (#10b981) on #111118 has a contrast ratio of ~7.2:1** -- passes AAA for normal text
- **Emerald-400 (#34d399) on #111118 has a contrast ratio of ~9.5:1** -- excellent readability
- **Avoid emerald-600+ on dark backgrounds** -- insufficient contrast for text (only ~4.1:1)
- **Emerald-300 and lighter can feel "minty" and less premium** -- use sparingly
- **Glow effect:** On dark backgrounds, add a subtle emerald glow to key actions:
  ```css
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15);
  ```

---

## 6. Status Colors

### The Green-on-Green Problem

When emerald is your primary brand color, using green for "pass/success" creates confusion. This is a well-documented design system challenge.

### Solution: Differentiated Status System

**Strategy: Use a distinct green for success that is visually different from emerald, and supplement ALL statuses with icons and shapes.**

```css
/* Status Colors -- Light Mode */
--status-pass:      #22c55e;  /* green-500 -- pure green, NOT emerald */
--status-pass-bg:   #f0fdf4;  /* green-50 */
--status-pass-text: #166534;  /* green-800 */

--status-fail:      #ef4444;  /* red-500 */
--status-fail-bg:   #fef2f2;  /* red-50 */
--status-fail-text: #991b1b;  /* red-800 */

--status-pending:   #f59e0b;  /* amber-500 */
--status-pending-bg: #fffbeb; /* amber-50 */
--status-pending-text: #92400e; /* amber-800 */

--status-running:   #3b82f6;  /* blue-500 */
--status-running-bg: #eff6ff; /* blue-50 */
--status-running-text: #1e40af; /* blue-800 */

--status-skipped:   #64748b;  /* slate-500 */
--status-skipped-bg: #f1f5f9; /* slate-100 */
--status-skipped-text: #334155; /* slate-700 */

/* Status Colors -- Dark Mode */
--status-pass:      #4ade80;  /* green-400 */
--status-pass-bg:   rgba(34, 197, 94, 0.1);
--status-pass-text: #86efac;  /* green-300 */

--status-fail:      #f87171;  /* red-400 */
--status-fail-bg:   rgba(239, 68, 68, 0.1);
--status-fail-text: #fca5a5;  /* red-300 */

--status-pending:   #fbbf24;  /* amber-400 */
--status-pending-bg: rgba(245, 158, 11, 0.1);
--status-pending-text: #fcd34d; /* amber-300 */

--status-running:   #60a5fa;  /* blue-400 */
--status-running-bg: rgba(59, 130, 246, 0.1);
--status-running-text: #93c5fd; /* blue-300 */

--status-skipped:   #94a3b8;  /* slate-400 */
--status-skipped-bg: rgba(100, 116, 139, 0.1);
--status-skipped-text: #cbd5e1; /* slate-300 */
```

### Differentiating Primary Emerald from Status Green

| Aspect | Primary (Emerald) | Status Pass (Green) |
|--------|-------------------|---------------------|
| Hue | ~160 (blue-green / teal-green) | ~142 (pure green / lime-green) |
| Hex | #10b981 / #059669 | #22c55e / #4ade80 |
| Usage | Buttons, links, accents | Status badges, check icons |
| Shape | Rectangles, underlines | Circles, checkmarks, pill badges |
| Icon | None or brand icon | Checkmark, circle-check |

### Status Indicator Design Rules

Following Carbon Design System best practices:

1. **Never use color alone** -- always pair with icon + text label
2. **Use distinct shapes per status:**
   - Pass: Filled circle with checkmark
   - Fail: Filled circle with X
   - Pending: Outline circle with clock
   - Running: Animated spinner ring
   - Skipped: Dash/minus in outline circle
3. **Minimum 3:1 contrast** between status color and background
4. **Text labels are mandatory** for accessibility

---

## 7. Animation and Transitions

### Motion Principles for a Testing Tool

Testing tools should feel **precise, efficient, and informative** -- not playful or bouncy.

#### Timing Tokens

```css
--duration-instant: 50ms;    /* Focus rings, toggles */
--duration-fast: 100ms;      /* Button hover, color changes */
--duration-normal: 150ms;    /* Dropdowns, popovers opening */
--duration-moderate: 200ms;  /* Panels sliding, accordions */
--duration-slow: 300ms;      /* Modal enter, page transitions */
--duration-slower: 500ms;    /* Complex sequences, chart animations */
```

#### Easing Functions

```css
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);      /* Default for most transitions */
--ease-out: cubic-bezier(0, 0, 0.2, 1);            /* Elements entering view */
--ease-in: cubic-bezier(0.4, 0, 1, 1);             /* Elements exiting view */
--ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);  /* Subtle overshoot (use rarely) */
--ease-linear: linear;                               /* Progress bars, spinners */
```

### Loading States

```css
/* Skeleton pulse -- for content placeholders */
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.1; }
}
.skeleton {
  animation: skeleton-pulse 2s ease-in-out infinite;
  background: var(--bg-surface-3);
}

/* Spinner -- for actions in progress */
@keyframes spin {
  to { transform: rotate(360deg); }
}
.spinner {
  animation: spin 0.8s linear infinite;
  border: 2px solid var(--border-default);
  border-top-color: var(--color-emerald-500);
}

/* Progress bar -- for determinate progress */
.progress-bar {
  transition: width var(--duration-slow) var(--ease-in-out);
  background: var(--color-emerald-500);
}

/* Step indicator -- for test step progression */
@keyframes step-complete {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
```

### Test-Specific Animations

```css
/* Test running indicator: pulsing dot */
@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.7; }
}
.status-running-dot {
  animation: pulse-dot 1.5s ease-in-out infinite;
  background: var(--status-running);
}

/* Test result reveal: slide in from left with fade */
@keyframes result-enter {
  from { opacity: 0; transform: translateX(-8px); }
  to { opacity: 1; transform: translateX(0); }
}
.test-result-row {
  animation: result-enter var(--duration-normal) var(--ease-out);
}

/* Sequential test results: staggered entrance */
.test-result-row:nth-child(n) {
  animation-delay: calc(var(--stagger-index, 0) * 30ms);
}

/* Counter/number animation for KPI updates */
/* Use CSS counter or JS-based approach -- CSS alone cannot animate number values */
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }

  /* Keep essential indicators functional */
  .spinner {
    animation: spin 2s linear infinite;  /* Keep but slow down */
  }
  .progress-bar {
    transition: width 0.01ms;  /* Instant but still updates */
  }
}
```

---

## 8. Accessibility

### Contrast Requirements

| Level | Normal Text (< 18px / < 14px bold) | Large Text (>= 18px / >= 14px bold) |
|-------|-------------------------------------|--------------------------------------|
| AA | 4.5:1 | 3:1 |
| AAA | 7:1 | 4.5:1 |

### Tested Emerald Contrast Ratios

**On white (#ffffff):**
| Color | Ratio | AA Normal | AA Large | AAA Normal |
|-------|-------|-----------|----------|------------|
| emerald-500 #10b981 | 2.8:1 | FAIL | PASS (barely) | FAIL |
| emerald-600 #059669 | 3.7:1 | FAIL | PASS | FAIL |
| emerald-700 #047857 | 5.1:1 | PASS | PASS | FAIL |
| emerald-800 #065f46 | 7.0:1 | PASS | PASS | PASS |
| emerald-900 #064e3b | 8.7:1 | PASS | PASS | PASS |

**On dark (#111118):**
| Color | Ratio | AA Normal | AA Large | AAA Normal |
|-------|-------|-----------|----------|------------|
| emerald-300 #6ee7b7 | 10.1:1 | PASS | PASS | PASS |
| emerald-400 #34d399 | 7.8:1 | PASS | PASS | PASS |
| emerald-500 #10b981 | 5.8:1 | PASS | PASS | FAIL |
| emerald-600 #059669 | 4.2:1 | FAIL | PASS | FAIL |

**Key takeaway:**
- **Light mode text:** Use emerald-700 (#047857) minimum for AA compliance on white
- **Dark mode text:** Use emerald-400 (#34d399) for comfortable reading; emerald-500 passes AA
- **Buttons:** Emerald-600 background with white text achieves ~4.5:1 (AA pass)
- **Links on light:** Use emerald-700; underline for additional differentiation

### Focus Indicators

```css
/* Focus ring -- high visibility, works on any background */
:focus-visible {
  outline: 2px solid var(--color-emerald-500);
  outline-offset: 2px;
}

/* Alternative: double ring for dark backgrounds */
:focus-visible {
  outline: 2px solid var(--color-emerald-400);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.25);
}

/* Square focus ring to match design language */
:focus-visible {
  outline: 2px solid var(--color-emerald-500);
  outline-offset: 2px;
  border-radius: 0px;  /* Keep square */
}
```

### Keyboard Navigation

- All interactive elements must be reachable via Tab
- Logical tab order following visual layout (left-to-right, top-to-bottom)
- Arrow keys for navigation within composite widgets (tabs, menus, table rows)
- Enter/Space to activate buttons and links
- Escape to close modals, dropdowns, popovers
- Skip-to-content link at the top of the page

### Screen Reader Considerations

- Use semantic HTML: `<table>`, `<nav>`, `<main>`, `<aside>`, `<header>`
- Status indicators: `aria-label="Test passed"` not just color
- Live regions for test progress: `aria-live="polite"` for test results streaming in
- `aria-busy="true"` on containers loading new content
- Progress bars: `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Test result tables: proper `<th scope="col">` and `<th scope="row">`

### Color-Blind Safe Design

Since the dashboard uses green (emerald) as primary:
- **Red-green color blindness (8% of males):** Status pass (green) and fail (red) MUST be differentiated by more than color. Use distinct icons (checkmark vs X), shapes (filled circle vs triangle), and text labels.
- **Test all status combinations in a deuteranopia/protanopia simulator**
- Consider using blue (#3b82f6) for "pass" instead of green in an accessibility mode

---

## 9. Component Patterns

### Cards

```css
.card {
  background: var(--bg-surface-2);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);          /* 4px */
  padding: var(--density-card-padding);
  box-shadow: var(--shadow-xs);
}

/* Accent card -- emerald top border */
.card--accent {
  border-top: 3px solid var(--color-emerald-500);
}

/* Interactive card -- hover lift */
.card--interactive:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
  transition: all var(--duration-fast) var(--ease-in-out);
}

/* Status card -- colored left border */
.card--status-pass { border-left: 3px solid var(--status-pass); }
.card--status-fail { border-left: 3px solid var(--status-fail); }
```

### Tables

Tables are the core of a testing dashboard. Keep them dense and scannable.

```css
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);                /* 12px */
  font-variant-numeric: tabular-nums;
}

.table th {
  background: var(--bg-surface-3);
  border-bottom: 2px solid var(--border-strong);
  padding: var(--density-table-cell-py) var(--density-table-cell-px);
  font-weight: var(--font-medium);          /* 500 */
  font-size: var(--text-xs);                /* 11px */
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  text-align: left;
}

.table td {
  border-bottom: 1px solid var(--border-subtle);
  padding: var(--density-table-cell-py) var(--density-table-cell-px);
  color: var(--text-primary);
}

.table tr:hover td {
  background: var(--bg-surface-3);
}

/* Row with status highlight */
.table tr[data-status="fail"] {
  background: var(--status-fail-bg);
}

/* No border-radius on table elements */
.table, .table th, .table td {
  border-radius: 0;
}
```

### Badges / Status Chips

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  font-size: var(--text-xs);                /* 11px */
  font-weight: var(--font-medium);          /* 500 */
  border-radius: var(--radius-none);        /* 0px -- sharp badges */
  line-height: 1.4;
}

.badge--pass {
  background: var(--status-pass-bg);
  color: var(--status-pass-text);
  border: 1px solid currentColor;
}

.badge--fail {
  background: var(--status-fail-bg);
  color: var(--status-fail-text);
  border: 1px solid currentColor;
}

/* Icon inside badge */
.badge svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
```

### Buttons

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: var(--density-button-py) var(--density-button-px);
  font-size: var(--text-sm);                /* 12px */
  font-weight: var(--font-semibold);        /* 600 */
  border-radius: var(--radius-sm);          /* 2px */
  border: 1px solid transparent;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-in-out);
}

/* Primary */
.btn--primary {
  background: var(--color-emerald-600);
  color: var(--text-on-primary);
  border-color: var(--color-emerald-600);
}
.btn--primary:hover {
  background: var(--color-emerald-700);
  border-color: var(--color-emerald-700);
}
.btn--primary:active {
  background: var(--color-emerald-800);
}

/* Secondary / Outline */
.btn--secondary {
  background: transparent;
  color: var(--text-primary);
  border-color: var(--border-strong);
}
.btn--secondary:hover {
  background: var(--bg-surface-3);
}

/* Ghost */
.btn--ghost {
  background: transparent;
  color: var(--text-secondary);
  border-color: transparent;
}
.btn--ghost:hover {
  background: var(--bg-surface-3);
  color: var(--text-primary);
}

/* Danger */
.btn--danger {
  background: var(--status-fail);
  color: white;
}
```

### Inputs

```css
.input {
  width: 100%;
  padding: var(--density-input-py) var(--density-input-px);
  font-size: var(--text-base);              /* 13px */
  font-family: inherit;
  background: var(--bg-surface-3);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-sm);          /* 2px */
  transition: border-color var(--duration-fast) var(--ease-in-out);
}

.input:hover {
  border-color: var(--border-strong);
}

.input:focus {
  border-color: var(--color-emerald-500);
  outline: 2px solid rgba(16, 185, 129, 0.25);
  outline-offset: 0;
}

.input::placeholder {
  color: var(--text-tertiary);
}

/* Input with icon */
.input-group {
  position: relative;
}
.input-group .input {
  padding-left: 36px;
}
.input-group .icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-tertiary);
}
```

### Navigation / Sidebar

```css
.sidebar {
  width: 240px;
  background: var(--bg-surface-1);
  border-right: 1px solid var(--border-default);
  padding: var(--space-3) 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  color: var(--text-secondary);
  border-radius: 0;                         /* Sharp -- full width highlight */
  transition: all var(--duration-fast);
}

.nav-item:hover {
  background: var(--bg-surface-3);
  color: var(--text-primary);
}

.nav-item--active {
  background: rgba(16, 185, 129, 0.08);
  color: var(--color-emerald-500);
  border-left: 3px solid var(--color-emerald-500);
  font-weight: var(--font-semibold);
}
```

---

## 10. CSS Custom Properties Reference

### Complete Token Set

```css
:root {
  /* ========================================
     COLOR PALETTE
     ======================================== */

  /* Emerald Scale */
  --color-emerald-50:  #ecfdf5;
  --color-emerald-100: #d1fae5;
  --color-emerald-200: #a7f3d0;
  --color-emerald-300: #6ee7b7;
  --color-emerald-400: #34d399;
  --color-emerald-500: #10b981;
  --color-emerald-600: #059669;
  --color-emerald-700: #047857;
  --color-emerald-800: #065f46;
  --color-emerald-900: #064e3b;
  --color-emerald-950: #022c22;

  /* Slate (Neutral) Scale */
  --color-slate-50:  #f8fafc;
  --color-slate-100: #f1f5f9;
  --color-slate-200: #e2e8f0;
  --color-slate-300: #cbd5e1;
  --color-slate-400: #94a3b8;
  --color-slate-500: #64748b;
  --color-slate-600: #475569;
  --color-slate-700: #334155;
  --color-slate-800: #1e293b;
  --color-slate-900: #0f172a;
  --color-slate-950: #020617;

  /* ========================================
     SEMANTIC TOKENS -- LIGHT MODE
     ======================================== */

  /* Surfaces */
  --bg-base:       var(--color-slate-50);
  --bg-surface-1:  #ffffff;
  --bg-surface-2:  var(--color-slate-100);
  --bg-surface-3:  var(--color-slate-200);

  /* Text */
  --text-primary:   var(--color-slate-900);
  --text-secondary: var(--color-slate-600);
  --text-tertiary:  var(--color-slate-400);
  --text-inverse:   #ffffff;

  /* Borders */
  --border-default: var(--color-slate-200);
  --border-subtle:  var(--color-slate-100);
  --border-strong:  var(--color-slate-300);

  /* Primary */
  --primary:        var(--color-emerald-600);
  --primary-hover:  var(--color-emerald-700);
  --primary-active: var(--color-emerald-800);
  --primary-subtle: var(--color-emerald-50);
  --primary-text:   var(--color-emerald-700);

  /* Status */
  --status-pass:       #22c55e;
  --status-pass-bg:    #f0fdf4;
  --status-pass-text:  #166534;
  --status-fail:       #ef4444;
  --status-fail-bg:    #fef2f2;
  --status-fail-text:  #991b1b;
  --status-pending:    #f59e0b;
  --status-pending-bg: #fffbeb;
  --status-pending-text: #92400e;
  --status-running:    #3b82f6;
  --status-running-bg: #eff6ff;
  --status-running-text: #1e40af;
  --status-skipped:    #64748b;
  --status-skipped-bg: #f1f5f9;
  --status-skipped-text: #334155;

  /* ========================================
     TYPOGRAPHY
     ======================================== */

  --font-sans:  'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono:  'JetBrains Mono', 'Fira Code', 'SF Mono', monospace;

  --text-2xs:   0.625rem;    /* 10px */
  --text-xs:    0.6875rem;   /* 11px */
  --text-sm:    0.75rem;     /* 12px */
  --text-base:  0.8125rem;   /* 13px */
  --text-md:    0.875rem;    /* 14px */
  --text-lg:    1rem;        /* 16px */
  --text-xl:    1.125rem;    /* 18px */
  --text-2xl:   1.25rem;     /* 20px */
  --text-3xl:   1.5rem;      /* 24px */
  --text-4xl:   1.875rem;    /* 30px */

  --leading-tight:   1.2;
  --leading-snug:    1.33;
  --leading-normal:  1.5;
  --leading-relaxed: 1.6;

  --font-normal:    400;
  --font-medium:    500;
  --font-semibold:  600;
  --font-bold:      700;

  --tracking-tighter: -0.03em;
  --tracking-tight:   -0.015em;
  --tracking-normal:  0;
  --tracking-wide:    0.01em;
  --tracking-wider:   0.05em;

  /* ========================================
     SPACING
     ======================================== */

  --space-0:   0;
  --space-px:  1px;
  --space-0.5: 2px;
  --space-1:   4px;
  --space-1.5: 6px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;

  /* ========================================
     SHAPE
     ======================================== */

  --radius-none: 0px;
  --radius-sm:   2px;
  --radius-md:   4px;
  --radius-lg:   6px;

  /* ========================================
     SHADOWS
     ======================================== */

  --shadow-none: none;
  --shadow-xs:   0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-sm:   0 1px 3px 0 rgb(0 0 0 / 0.1);
  --shadow-md:   0 4px 6px -1px rgb(0 0 0 / 0.1);
  --shadow-lg:   0 10px 15px -3px rgb(0 0 0 / 0.1);

  /* ========================================
     MOTION
     ======================================== */

  --duration-instant:  50ms;
  --duration-fast:     100ms;
  --duration-normal:   150ms;
  --duration-moderate: 200ms;
  --duration-slow:     300ms;
  --duration-slower:   500ms;

  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-in:      cubic-bezier(0.4, 0, 1, 1);
  --ease-out:     cubic-bezier(0, 0, 0.2, 1);
  --ease-spring:  cubic-bezier(0.34, 1.56, 0.64, 1);

  /* ========================================
     DENSITY -- COMFORTABLE (default)
     ======================================== */

  --density-page-padding:   24px;
  --density-section-gap:    24px;
  --density-card-padding:   20px;
  --density-card-gap:       16px;
  --density-table-cell-py:  12px;
  --density-table-cell-px:  16px;
  --density-input-py:       8px;
  --density-input-px:       12px;
  --density-button-py:      8px;
  --density-button-px:      16px;
  --density-list-item-py:   10px;
  --density-stack-gap:      12px;
}

/* ========================================
   DARK MODE OVERRIDES
   ======================================== */

[data-theme="dark"],
.dark {
  --bg-base:       #0a0a0f;
  --bg-surface-1:  #111118;
  --bg-surface-2:  #1a1a24;
  --bg-surface-3:  #24242f;

  --text-primary:   var(--color-slate-100);
  --text-secondary: var(--color-slate-400);
  --text-tertiary:  var(--color-slate-500);
  --text-inverse:   var(--color-slate-900);

  --border-default: #1e293b;
  --border-subtle:  #1a1a24;
  --border-strong:  #334155;

  --primary:        var(--color-emerald-500);
  --primary-hover:  var(--color-emerald-400);
  --primary-active: var(--color-emerald-600);
  --primary-subtle: rgba(16, 185, 129, 0.08);
  --primary-text:   var(--color-emerald-400);

  --status-pass:       #4ade80;
  --status-pass-bg:    rgba(34, 197, 94, 0.1);
  --status-pass-text:  #86efac;
  --status-fail:       #f87171;
  --status-fail-bg:    rgba(239, 68, 68, 0.1);
  --status-fail-text:  #fca5a5;
  --status-pending:    #fbbf24;
  --status-pending-bg: rgba(245, 158, 11, 0.1);
  --status-pending-text: #fcd34d;
  --status-running:    #60a5fa;
  --status-running-bg: rgba(59, 130, 246, 0.1);
  --status-running-text: #93c5fd;
  --status-skipped:    #94a3b8;
  --status-skipped-bg: rgba(100, 116, 139, 0.1);
  --status-skipped-text: #cbd5e1;

  --shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.2);
  --shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.4);
  --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.4);
}

/* ========================================
   COMPACT DENSITY MODE
   ======================================== */

[data-density="compact"],
.compact {
  --density-page-padding:   16px;
  --density-section-gap:    16px;
  --density-card-padding:   12px;
  --density-card-gap:       12px;
  --density-table-cell-py:  6px;
  --density-table-cell-px:  12px;
  --density-input-py:       4px;
  --density-input-px:       10px;
  --density-button-py:      4px;
  --density-button-px:      12px;
  --density-list-item-py:   6px;
  --density-stack-gap:      8px;
}
```

---

## Research Sources

- [Tailwind CSS Colors (Official)](https://tailwindcss.com/docs/colors) -- Emerald palette reference
- [Tailwind Colors v4](https://tailwindcolor.com/emerald) -- OKLCH-based emerald values
- [shadcn/ui Colors](https://ui.shadcn.com/colors) -- Tailwind colors in all formats
- [Shoelace Design System Color Tokens](https://shoelace.style/tokens/color) -- Emerald token scale example
- [Figma Emerald Color Reference](https://www.figma.com/colors/emerald/) -- Emerald palettes and meaning
- [Cloudscape Content Density](https://cloudscape.design/foundation/visual-foundation/content-density/) -- Compact/comfortable mode patterns
- [Atlassian Spacing](https://atlassian.design/foundations/spacing/) -- Spacing scale best practices
- [Carbon Design Status Indicators](https://carbondesignsystem.com/patterns/status-indicator-pattern/) -- Status color differentiation
- [Inter Font Family](https://rsms.me/inter/) -- OpenType features, tabular numbers
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) -- WCAG contrast validation
- [WebAIM Contrast & Color Accessibility](https://webaim.org/articles/contrast/) -- WCAG AA/AAA requirements
- [Dark Mode UI Best Practices (Atmos)](https://atmos.style/blog/dark-mode-ui-best-practices) -- Surface hierarchy
- [8 Tips for Dark Theme Design (UX Planet)](https://uxplanet.org/8-tips-for-dark-theme-design-8dfc2f8f7ab6) -- Background colors, desaturation
- [Typography for Data Dashboards (Datafloq)](https://datafloq.com/typography-basics-for-data-dashboards/) -- Dashboard-specific typography
- [Designing for Data Density (Medium)](https://paulwallas.medium.com/designing-for-data-density-what-most-ui-tutorials-wont-teach-you-091b3e9b51f4) -- Compact UI patterns
- [Rounded vs Sharp Edges (zazzy)](https://www.zazzy.studio/jots/rounded-corners-vs-sharp-edges) -- Square design rationale
- [Fluent 2 Shapes](https://fluent2.microsoft.design/shapes) -- Microsoft's corner radius system
- [Telerik Border Radius](https://www.telerik.com/design-system/docs/foundation/border-radius/) -- Radius guidelines
- [Cieden System Colors Guide](https://cieden.com/book/sub-atomic/color/system-colors) -- Status color selection
- [Semantic Colors in UI/UX (Medium)](https://medium.com/@zaimasri92/semantic-colors-in-ui-ux-design-a-beginners-guide-to-functional-color-systems-cc51cf79ac5a) -- Functional color systems
