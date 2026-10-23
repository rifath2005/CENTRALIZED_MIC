/**
 * Acoustic Stage Design System Tokens
 * Source: mobile/stitch_airmic_mobile_stage_flow/acoustic_stage/DESIGN.md
 * Studio Dark Precision Minimalist & Tactile Hardware Instrumentation
 */

export const acousticTheme = {
  colors: {
    // Canvas & Containers (Obsidian & Carbon hierarchy)
    surface: '#0e131e',
    surfaceDim: '#0e131e',
    surfaceBright: '#343945',
    surfaceLowest: '#090e19',
    surfaceLow: '#171b27',
    surfaceContainer: '#1b202b',
    surfaceHigh: '#252a36',
    surfaceHighest: '#303541',
    surfaceVariant: '#303541',

    // CamelCase aliases matching Tailwind / CSS vars
    surfaceContainerLowest: '#090e19',
    surfaceContainerLow: '#171b27',
    surfaceContainerHigh: '#252a36',
    surfaceContainerHighest: '#303541',

    // Typography & Content
    onSurface: '#dee2f2',
    onSurfaceVariant: '#d8c3ad',
    inverseSurface: '#dee2f2',
    inverseOnSurface: '#2b303c',
    outline: '#a08e7a',
    outlineVariant: '#534434',

    // Broadcast Gold / Master Engagement (Primary)
    primary: '#ffc174',
    primaryContainer: '#f59e0b',
    onPrimary: '#472a00',
    onPrimaryContainer: '#613b00',
    primaryDark: '#d97706',

    // Stage Live Emerald / Healthy Headroom (Secondary)
    secondary: '#4edea3',
    secondaryContainer: '#00a572',
    onSecondary: '#003824',
    onSecondaryContainer: '#00311f',

    // Stage Hot / True Peak / Clip Alert (Tertiary & Error)
    tertiary: '#ffbcb7',
    tertiaryContainer: '#ff938c',
    onTertiary: '#68000a',
    error: '#ffb4ab',
    errorContainer: '#93000a',
    onError: '#690005',
    onErrorContainer: '#ffdad6',
  },
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
  },
};

export type AcousticTheme = typeof acousticTheme;
