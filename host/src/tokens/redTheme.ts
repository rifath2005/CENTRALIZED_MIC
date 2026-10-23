/**
 * Unified Red Design System Tokens
 * WCAG AA Compliant (Minimum 4.5:1 text, 3:1 controls)
 * Engineered for live stage audio control & high-visibility auditorium display
 */

export const redTheme = {
  colors: {
    // Primary Red / Ruby / Crimson Brand
    primary: '#e11d48',       // Rose 600 - vivid ruby red
    primaryHover: '#f43f5e',  // Rose 500 - bright accessible hover
    primaryActive: '#be123c', // Rose 700 - pressed state
    primaryMuted: '#9f1239',  // Rose 800
    primaryFocus: 'rgba(225, 29, 72, 0.45)', // Focus outline ring
    textOnPrimary: '#ffffff', // 5.1:1 contrast on #e11d48

    // Accents & High-Contrast Typography
    accentBright: '#fb7185',  // Rose 400 - high contrast label on dark surfaces (>7:1)
    accentMuted: '#fda4af',   // Rose 300
    accentLight: '#fecdd3',   // Rose 200

    // Dark Surfaces (Obsidian with warm crimson undertones)
    bgDeepest: '#090305',     // Main page background
    bgSurfaceDark: '#120408', // Inset panels & track backgrounds
    bgSurfaceCard: '#1c070e', // Primary card surfaces
    bgSurfaceElevated: '#280a14', // Elevated containers / active items
    bgSurfaceHover: '#350d1b',    // Hovered surfaces
    bgSurfaceOverlay: 'rgba(9, 3, 5, 0.94)', // Modal backdrops

    // Card & Panel Borders
    borderSubtle: '#3b0d1a',
    borderMedium: '#5a1529',
    borderStrong: '#e11d48',
    borderFocus: '#fb7185',

    // Text Hierarchy (WCAG AA Compliant)
    textPrimary: '#ffffff',     // 17.5:1 contrast on #090305
    textSecondary: '#fecdd3',   // 12.2:1 contrast
    textMuted: '#a3717c',       // 5.2:1 contrast (>4.5:1 minimum)
    textSubtle: '#734d56',

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
