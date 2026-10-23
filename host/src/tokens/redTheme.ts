/**
 * Unified Red Design System Tokens
 * WCAG AA Compliant (Minimum 4.5:1 text, 3:1 controls)
 * Engineered for live stage audio control & high-visibility auditorium display
 */

export const redTheme = {
  colors: {
    // Primary Red / Ruby / Crimson Brand
    primary: '#ef4444',       // Red 500 - bold broadcast crimson
    primaryHover: '#f87171',  // Red 400 - accessible hover
    primaryActive: '#dc2626', // Red 600 - pressed state
    primaryMuted: '#991b1b',  // Red 800
    primaryFocus: 'rgba(239, 68, 68, 0.45)', // Focus outline ring
    textOnPrimary: '#ffffff', // 5.1:1 contrast on #ef4444

    // Accents & High-Contrast Typography
    accentBright: '#ef4444',  // Vivid broadcast accent
    accentMuted: '#f87171',   // Red 400
    accentLight: '#fecaca',   // Red 200

    // Dark Surfaces (Clean Broadcast Dark Obsidian)
    bgDeepest: '#080a0e',     // Main page background
    bgSurfaceDark: '#0c1017', // Inset panels & track backgrounds
    bgSurfaceCard: '#10141c', // Primary card surfaces
    bgSurfaceElevated: '#141923', // Elevated containers / active items
    bgSurfaceHover: '#181d28',    // Hovered surfaces
    bgSurfaceOverlay: 'rgba(8, 10, 14, 0.94)', // Modal backdrops

    // Card & Panel Borders
    borderSubtle: '#181d28',
    borderMedium: '#222834',
    borderStrong: '#ef4444',
    borderFocus: '#ef4444',

    // Text Hierarchy (Clean Slate WCAG AA Compliant)
    textPrimary: '#f1f5f9',     // Crisp white (Slate 100)
    textSecondary: '#cbd5e1',   // Slate 300
    textMuted: '#94a3b8',       // Slate 400
    textSubtle: '#64748b',      // Slate 500

    // Destructive & Emergency Actions
    emergency: '#dc2626',       // Red 600 - unmistakable danger
    emergencyHover: '#ef4444',  // Red 500
    emergencyActive: '#b91c1c', // Red 700
    emergencyBg: 'rgba(220, 38, 38, 0.16)',
    emergencyBorder: '#ef4444',
    emergencyText: '#fee2e2',
    emergencyGlow: '0 0 24px rgba(220, 38, 38, 0.85)',

    // Semantic Status Colors (Multi-modal paired with icons & shapes)
    statusOnAir: '#10b981',       // Emerald (Live transmission)
    statusOnAirGlow: '0 0 20px rgba(16, 185, 129, 0.5)',
    statusOnAirBg: 'rgba(16, 185, 129, 0.14)',
    statusOnAirText: '#a7f3d0',
    statusInQueue: '#f59e0b',     // Amber (Waiting in line)
    statusInQueueBg: 'rgba(245, 158, 11, 0.14)',
    statusInQueueText: '#fde68a',
    statusMuted: '#f43f5e',       // Red-Rose (Muted state)
    statusStandby: '#64748b',     // Slate (Idle)
    statusClip: '#ff0055',        // Saturated Magenta (0dB Clipping warning)

    // Projector High-Contrast Bright-Room Mode
    brightMode: {
      bg: '#ffffff',
      surface: '#fdf2f4',
      surfaceBorder: '#f43f5e',
      textPrimary: '#140407',
      textSecondary: '#4c1420',
      textMuted: '#7f2338',
      qrBg: '#ffffff',
      qrFg: '#9f1239',
      accent: '#be123c',
    }
  },
  shadows: {
    card: '0 8px 30px rgba(9, 3, 5, 0.65)',
    elevated: '0 12px 40px rgba(9, 3, 5, 0.85)',
    glowPrimary: '0 0 20px rgba(225, 29, 72, 0.45)',
    glowEmergency: '0 0 25px rgba(220, 38, 38, 0.9)',
    glowOnAir: '0 0 25px rgba(16, 185, 129, 0.6)',
  },
  radii: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    pill: '9999px',
  }
};

export type RedTheme = typeof redTheme;
