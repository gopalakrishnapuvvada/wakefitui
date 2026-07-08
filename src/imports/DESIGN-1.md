---
name: Unified Intelligence Interface
colors:
  surface: '#f9f9ff'
  surface-dim: '#d9d9e0'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f3f9'
  surface-container: '#ededf3'
  surface-container-high: '#e7e8ee'
  surface-container-highest: '#e2e2e8'
  on-surface: '#191c20'
  on-surface-variant: '#44474e'
  inverse-surface: '#2e3035'
  inverse-on-surface: '#f0f0f6'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#485f84'
  primary: '#031f41'
  on-primary: '#ffffff'
  primary-container: '#1d3557'
  on-primary-container: '#879ec6'
  inverse-primary: '#b0c7f1'
  secondary: '#2b6485'
  on-secondary: '#ffffff'
  secondary-container: '#a3d8fe'
  on-secondary-container: '#255f80'
  tertiary: '#480009'
  on-tertiary: '#ffffff'
  tertiary-container: '#700013'
  on-tertiary-container: '#ff6f71'
  error: '#E63946'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b0c7f1'
  on-primary-fixed: '#001b3c'
  on-primary-fixed-variant: '#30476a'
  secondary-fixed: '#c7e7ff'
  secondary-fixed-dim: '#98cdf2'
  on-secondary-fixed: '#001e2e'
  on-secondary-fixed-variant: '#064c6b'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#ffb3b1'
  on-tertiary-fixed: '#410007'
  on-tertiary-fixed-variant: '#92001c'
  background: '#f9f9ff'
  on-background: '#191c20'
  surface-variant: '#e2e2e8'
  surface-light: '#F7F9FC'
  success: '#2D6A4F'
  warning: '#FFB703'
  info: '#457B9D'
typography:
  headline-lg:
    fontFamily: Barlow Condensed
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: 0.02em
  headline-md:
    fontFamily: Barlow Condensed
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0.01em
  headline-sm:
    fontFamily: Barlow Condensed
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: DM Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: DM Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: DM Sans
    fontSize: 14px
    fontWeight: '700'
    lineHeight: 16px
  label-md:
    fontFamily: DM Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 14px
  code:
    fontFamily: DM Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1440px
  gutter: 16px
  margin-sm: 12px
  margin-md: 24px
  margin-lg: 48px
---

## Brand & Style
This design system embodies a **Corporate / Modern** aesthetic tailored for high-density AI and machine learning workflows. It draws heavy inspiration from systematic enterprise frameworks, prioritizing clarity, efficiency, and data-density. 

The brand personality is authoritative and technical, yet approachable through refined interactions. The visual style utilizes a "Surface-First" approach: clean layouts, purposeful contrast, and subtle depth to guide users through complex analytical tasks. The objective is to evoke a sense of "Reliable Intelligence"—where the UI disappears to let the data lead, while remaining robust enough to handle enterprise-scale operations in both light and dark environments.

## Colors
The palette is rooted in a deep "Aeronautical Navy" (`#1D3557`) which serves as the primary anchor for trust and stability. We utilize `#457B9D` as a secondary interactive color to provide a softer cognitive load for secondary actions. 

**Color Strategy:**
- **Primary:** Reserved for critical action buttons, active states, and primary navigation indicators.
- **Secondary:** Used for supporting UI elements, ghost buttons, and non-critical progress indicators.
- **Semantic Logic:** The brand red (`#E63946`) is strictly reserved for destructive actions and high-priority error states to maintain its semiotic impact. 
- **Adaptability:** For Dark Mode, the neutral background shifts from `#F7F9FC` to a tiered layering of `#07090D`, using increased opacity on overlays rather than pure black to maintain depth perception and reduce eye strain.

## Typography
The typography system follows a dual-font strategy to balance technical efficiency with readability. 

**Barlow Condensed** is employed for headlines and high-level data points. Its narrow architecture allows for more information density in dashboard headers without sacrificing impact.

**DM Sans** is the workhorse for body copy, inputs, and labels. It provides a geometric, modern feel that remains legible at smaller scales—essential for the dense property panels and tables typical of AI/ML tools. 

Vertical rhythm is maintained through a strict 4px baseline grid. Headlines should always use slightly tighter line-heights compared to body text to maintain visual cohesion in multi-line titles.

## Layout & Spacing
This design system utilizes an **8px Step Grid** system (with 4px sub-steps for micro-adjustments).

- **Grid Logic:** A 12-column fluid grid is used for main content areas, while sidebars (Navigation and Property Panels) use fixed widths (240px and 320px respectively) to ensure tool consistency.
- **Density:** In "Compact Mode" (ideal for data-heavy ML pipelines), padding is reduced by 25% across all components.
- **Breakpoints:**
  - **Desktop (1280px+):** Full visibility of sidebars and main stage.
  - **Tablet (768px - 1279px):** Navigation collapses to icons; margins reduce to 16px.
  - **Mobile (<767px):** Single column flow; Property panels become bottom-sheet drawers.

## Elevation & Depth
Depth is conveyed through **Tonal Layering** and **Subtle Ambient Shadows**. Following Ant Design principles, we avoid heavy drop shadows in favor of surface levels:

- **Level 0 (Base):** `#F7F9FC` (Light) or `#07090D` (Dark). Used for the main application background.
- **Level 1 (Card/Surface):** White (Light) or `#14171C` (Dark). Used for the primary content containers.
- **Level 2 (Overlay/Pop-over):** Uses a very soft, diffused shadow: `0 4px 12px rgba(0,0,0,0.08)`.
- **Interactions:** Hover states on interactive cards should lift the element slightly using a more pronounced shadow and a 1px border stroke using the Primary color at 20% opacity.

## Shapes
The shape language is **Soft and Precise**. A standard border-radius of `4px` (`0.25rem`) is applied to buttons, inputs, and small containers. This creates a professional, "tooled" look that feels more technical than rounded, consumer-facing apps.

- **Large Components:** Cards and Modals use `8px` (`0.5rem`) to soften the overall layout.
- **Special Elements:** Tags and Chips for AI status indicators may use a pill-shape (full radius) to distinguish them from actionable buttons.

## Components

### Buttons
- **Primary:** Solid `#1D3557` with white text. 4px radius. 
- **Secondary:** Bordered (1px) with `#457B9D`.
- **Action:** For "Run" or "Execute" AI commands, use a subtle gradient from Primary to Secondary to denote a "High Value" action.

### Input Fields
- Use a background of `#FFFFFF` in light mode and a subtle contrast-dark in dark mode. 
- Border color defaults to a light gray, shifting to Primary (`#1D3557`) on focus with a 2px outer "halo" at 15% opacity.

### Chips & Tags
- Used for ML model labels or status. 
- **Success:** Soft green background with dark green text.
- **Processing:** Soft blue (`#457B9D`) with a subtle pulse animation.

### Cards
- White background with a 1px border of `#E5E7EB`. 
- No shadow in their default state; shadow appears only on hover to indicate interactability.

### Data Tables
- Header background: `#F7F9FC`.
- Row borders: 1px horizontal lines only.
- Typography: Use `body-sm` for table content to maximize data visibility.