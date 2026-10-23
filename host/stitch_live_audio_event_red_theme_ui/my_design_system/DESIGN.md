---
name: My Design System
colors:
  surface: '#f9f9ff'
  surface-dim: '#d7dae3'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f3fc'
  surface-container: '#ebedf7'
  surface-container-high: '#e6e8f1'
  surface-container-highest: '#e0e2eb'
  on-surface: '#181c22'
  on-surface-variant: '#414753'
  inverse-surface: '#2d3037'
  inverse-on-surface: '#eef0fa'
  outline: '#717785'
  outline-variant: '#c1c6d5'
  surface-tint: '#005db8'
  primary: '#005cb8'
  on-primary: '#ffffff'
  primary-container: '#1275e2'
  on-primary-container: '#000512'
  inverse-primary: '#aac7ff'
  secondary: '#465f88'
  on-secondary: '#ffffff'
  secondary-container: '#b6d0ff'
  on-secondary-container: '#3f5881'
  tertiary: '#9a4600'
  on-tertiary: '#ffffff'
  tertiary-container: '#c05900'
  on-tertiary-container: '#0d0300'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d6e3ff'
  primary-fixed-dim: '#aac7ff'
  on-primary-fixed: '#001b3e'
  on-primary-fixed-variant: '#00458d'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#aec7f7'
  on-secondary-fixed: '#001b3d'
  on-secondary-fixed-variant: '#2d476f'
  tertiary-fixed: '#ffdbc9'
  tertiary-fixed-dim: '#ffb68c'
  on-tertiary-fixed: '#321200'
  on-tertiary-fixed-variant: '#763400'
  background: '#f9f9ff'
  on-background: '#181c22'
  surface-variant: '#e0e2eb'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

# Design System

## Brand & Style
The design system embraces a modern, reliable, and professional aesthetic centered around the **Inter** typeface family. The visual tone is structured and clean, utilizing a fidelity-driven approach to maintain absolute clarity across all interfaces. The color palette emphasizes dependable blues alongside slate and warm neutral undertones to foster trust and precision.

## Colors
The color system is organized around a semantic structure with a light color mode default. 
- **Primary (`#1275e2`)**: The anchor color used for primary actions, active states, and key interactive elements.
- **Secondary (`#5f78a3`)**: A muted slate-blue tone supporting secondary actions and structural highlights.
- **Tertiary (`#c55b00`)**: A vibrant accent used selectively for callouts, warnings, or focal points.
- **Neutral (`#74777f`)**: Used for text, backgrounds, and structural borders, ensuring high readability and balanced contrast.

## Typography
The typography utilizes **Inter** across all headline, body, and label roles to maintain clean legibility and modern geometric proportions. Scale transitions smoothly from large section titles to compact form labels.

## Layout & Spacing
A structured layout philosophy using standard gutters and consistent spacing scales (`space-xs` to `space-xl`). Elements align to predictable grid gaps to preserve visual rhythm across form factors.

## Elevation & Depth
Visual hierarchy is maintained through subtle tonal layering and low-contrast outlines rather than heavy drop shadows, aligning with the clean, professional character of the system.

## Shapes
The interface employs a **Rounded** shape language (`roundedness: 2`), featuring standard 0.5rem corner radii for interactive elements, which scale up for larger containers. This creates a friendly yet professional feel.

## Components
Components leverage the rounded shape language, Inter typography, and primary blue palette (`#1275e2`) to maintain cohesive functionality across buttons, inputs, cards, and navigation elements.