---
name: Acoustic Stage
colors:
  surface: '#0e131e'
  surface-dim: '#0e131e'
  surface-bright: '#343945'
  surface-container-lowest: '#090e19'
  surface-container-low: '#171b27'
  surface-container: '#1b202b'
  surface-container-high: '#252a36'
  surface-container-highest: '#303541'
  on-surface: '#dee2f2'
  on-surface-variant: '#d8c3ad'
  inverse-surface: '#dee2f2'
  inverse-on-surface: '#2b303c'
  outline: '#a08e7a'
  outline-variant: '#534434'
  surface-tint: '#ffb95f'
  primary: '#ffc174'
  on-primary: '#472a00'
  primary-container: '#f59e0b'
  on-primary-container: '#613b00'
  inverse-primary: '#855300'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#ffbcb7'
  on-tertiary: '#68000a'
  tertiary-container: '#ff938c'
  on-tertiary-container: '#8d0012'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#ffddb8'
  primary-fixed-dim: '#ffb95f'
  on-primary-fixed: '#2a1700'
  on-primary-fixed-variant: '#653e00'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3ad'
  on-tertiary-fixed: '#410004'
  on-tertiary-fixed-variant: '#930013'
  background: '#0e131e'
  on-background: '#dee2f2'
  surface-variant: '#303541'
typography:
  headline-xl:
    fontFamily: Space Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
  headline-xl-mobile:
    fontFamily: Space Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-lg: 1.5rem
  margin: 1rem
  margin-md: 1.5rem
  margin-lg: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is engineered for professional live audio broadcasting, stage monitoring, and mission-critical acoustic routing. It balances the rigor of physical studio hardware with the speed and ergonomics of a modern digital audio workstation.

The aesthetic blends **Dark Precision Minimalist** and **Tactile Hardware Instrumentation**:
- **Environment**: Deep carbon stage UI designed for dim studio booths, live venues, and nighttime field recording.
- **Tone**: Focused, authoritative, low-eye-strain, and hyper-responsive.
- **Visual Signature**: Fine low-contrast dividers, luminescent signal metering, and tactile active states that mimic analog switchboards and broadcast consoles.

## Colors

The palette directly models real-world broadcast signals:
- **Primary (`#F59E0B` Broadcast Gold)**: Represents master engagement, active faders, primary controls, and on-air staging. Dark gold (`#D97706`) functions as pressed and active border states.
- **Secondary (`#10B981` Stage Live Emerald)**: Signal health, safe headroom metering (-42dB to -6dB), connected inputs, and active stream transmission.
- **Tertiary (`#EF4444` Urgent Red)**: True peak saturation (0dB+ clipping), hot mic ("ON AIR"), dropped-frame alerts, and emergency kill switches.
- **Neutral Surface Hierarchy**:
  - `Canvas`: `#0A0D14` (Deep void floor for zero ambient glare).
  - `Surface 1 (Racks/Cards)`: `#121722` (Base container tone).
  - `Surface 2 (Fader wells/Modules)`: `#1A202E` (Recessed interactive wells).
  - `Surface High (Overlays/Popovers)`: `#242C3E`.
  - `Borders & Outlines`: `#263044` with active boundaries shifting to `#F59E0B` or `#10B981`.
- **Text Hierarchy**:
  - `High-Emphasis`: `#F9FAFB`
  - `Medium-Emphasis`: `#9CA3AF`
  - `Muted / Grid Markings`: `#4B5563`

## Typography

Typography prioritizes fast cognitive parsing under pressure:
- **Headlines (`Space Grotesk`)**: Geometric, technical, and precise. Used for station titles, channel names, and stage modules.
- **Body (`Hanken Grotesk`)**: Clean, contemporary grotesque with open counters and high legibility at micro sizes on OLED screens.
- **Technical Readouts (`JetBrains Mono`)**: Strict monospacing for timecodes, decibel readouts, bitrates, sample rates (e.g., `48kHz / 24-bit`), and audio routing matrix indicators to ensure non-jumping tabular data.

## Layout & Spacing

The layout employs an adaptable hardware rack architecture:
- **Desktop/Console (1024px+)**: 12-column modular grid with `gutter-lg` (1.5rem) and `margin-lg` (2rem). Supports multi-strip channel views, master bus sidebars, and persistent VU meters.
- **Tablet (768px - 1023px)**: 8-column layout with `gutter` (1rem) and `margin-md` (1.5rem). Channel strips collapse into stacked rack units.
- **Mobile (<768px)**: 4-column fluid stack with `gutter` (1rem) and `margin` (1rem). Touch targets maintain an absolute minimum height of 48px to prevent accidental muting or level shifts during live sessions.
- **Module Spacing**: Component internals adhere strictly to 4px and 8px rhythmic increments (`space-xs` through `space-xl`) to preserve clean alignment alongside hardware fader grooves.

## Elevation & Depth

Visual hierarchy relies on hardware layering and localized illumination rather than traditional ambient drop shadows:
- **Base Canvas**: Flat `#0A0D14`.
- **Level 1 (Channel Racks & Panels)**: Raised with a hairline border (`1px solid #263044`) and subtle linear gradient (180deg, `#161D2A` to `#121722`).
- **Level 2 (Active Controls & Sliders)**: Recessed interior shadows (`inset 0 2px 4px rgba(0, 0, 0, 0.6)`) for fader tracks and meter wells to create physical depth.
- **Level 3 (Overlays & Context Modals)**: Floating layer with `0 12px 32px rgba(0, 0, 0, 0.75)` and `1px solid rgba(245, 158, 11, 0.2)`.
- **Glow & Signal Radiation**: Active states emit localized luminescent back-glows:
  - Live state: `0 0 16px rgba(16, 185, 129, 0.35)`.
  - Master Gold state: `0 0 16px rgba(245, 158, 11, 0.35)`.
  - Clip/Peak state: `0 0 20px rgba(239, 68, 68, 0.45)`.

## Shapes

The interface balances sharp instrument panel edges with accessible handheld comfort:
- **Cards & Enclosures**: Exactly `1rem` (16px) radius, delivering the requested soft rack-mount profile.
- **Buttons, Toggles & Chips**: Consistent `0.5rem` (8px) radius to distinguish individual touch points inside 16px modular cards.
- **Status Indicators & Fader Knobs**: Fully circular pills or rounded hardware grips.

## Components

### Cards & Channel Strips
- **Container**: Border radius of 16px (`rounded-lg`), background `#121722`, border `1px solid #263044`.
- **Header**: Top-level station metadata, channel number (`label-sm`), and signal health indicator.
- **Inner Wells**: Inset boxes (`#0E131C`) for fader channels, meter bars, and equalizer knobs.

### Buttons & Interactive Controls
- **Primary Broadcast Action**: Background `#F59E0B`, text `#0A0D14` (bold), 8px radius. Hover shifts to `#D97706` with `0 0 12px rgba(245, 158, 11, 0.4)`.
- **Live / On-Air Button**: Dual-state latch. Off-state `#1A202E` with muted emerald border. On-state `#10B981` solid with white text and heartbeat pulse animation.
- **Mute / Kill Button**: Muted charcoal in default; active engaged state fills `#EF4444` with high-contrast text.

### Audio VU & Peak Meters
- **Segmentation**: Segmented LED blocks separated by 2px vertical gaps.
  - Safe zone (-∞ to -6dB): Segment color `#10B981`.
  - Headroom warning (-6dB to -1dB): Segment color `#F59E0B`.
  - Peak / Clip (0dB and above): Segment color `#EF4444`.
- **Peak Hold**: Single 1px line retaining the highest registered peak for 1200ms using monospace numerical readouts above the bar.

### Input Fields & Knobs
- **Numeric & Parametric Inputs**: Surface `#1A202E`, border `1px solid #263044`, text `#F9FAFB`, typography `JetBrains Mono`. Focus ring transitions to `#F59E0B` with no outline offset.
- **Rotary Gain Knobs**: Circular track with `#263044` background rail and dynamic `#F59E0B` stroke fill; central value displayed in `label-sm`.

### Chips & Badges
- **Status Chips**: Monospaced tags (`JetBrains Mono`, 10px), 6px radius, uppercase.
  - "ON AIR": `#EF4444` background with white text.
  - "READY": `rgba(16, 185, 129, 0.15)` fill with `#10B981` text and border.
  - "STANDBY": `rgba(245, 158, 11, 0.15)` fill with `#F59E0B` text.

### Checkboxes, Radios & Switches
- **Switches**: Physical toggle aesthetic with a sliding illuminated thumb. Green or Gold glow represents active bus routing.