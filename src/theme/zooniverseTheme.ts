/**
 * Zooniverse Design System Theme
 * Based on official Zooniverse brand colors and typography
 */

export const colors = {
  // Primary colors
  primary: '#00979d', // Teal
  primaryLight: '#addde0', // Light teal

  // Secondary colors
  secondary: '#0F191E', // Dark navy

  // Neutral grays
  neutral: {
    white: '#FFFFFF',
    light: '#DEE3E9',
    medium: '#A8B0B8',
    dark: '#667788',
    darker: '#0F191E',
    black: '#000000',
  },

  // Status colors
  success: '#1ED359', // Green
  error: '#E45950', // Red
  warning: '#CC9200', // Orange
  info: '#009B9B', // Teal

  // Accent colors
  accent: {
    gold: '#f6d885',
    mint: '#B8E986',
    pink: '#FFB6AA',
  },

  // Semantic colors
  text: {
    primary: '#0F191E',
    secondary: '#667788',
    light: '#A8B0B8',
    inverse: '#FFFFFF',
  },

  // Background
  background: {
    default: '#F5F7FA',
    surface: '#FFFFFF',
    elevated: '#F5F7FA',
  },

  // Border
  border: '#DEE3E9',
};

export const typography = {
  fontFamily: '"Karla", Arial, sans-serif',
  fontFamilyCode: '"Courier New", monospace',

  fontWeight: {
    regular: 400,
    medium: 500,
    bold: 700,
  },

  // Size scale in pixels
  size: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '36px',
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },

  // Letter spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0em',
    wide: '0.02em',
  },

  // Heading styles
  heading: {
    h1: {
      fontSize: '36px',
      fontWeight: 500,
      lineHeight: 1.2,
      letterSpacing: '0.01em',
    },
    h2: {
      fontSize: '28px',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h3: {
      fontSize: '24px',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h4: {
      fontSize: '20px',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h5: {
      fontSize: '18px',
      fontWeight: 500,
      lineHeight: 1.2,
    },
    h6: {
      fontSize: '16px',
      fontWeight: 500,
      lineHeight: 1.2,
    },
  },
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '48px',
};

export const borders = {
  radius: {
    none: '0px',
    sm: '4px',
    base: '6px',
    lg: '8px',
    full: '9999px',
  },

  width: {
    thin: '1px',
    base: '2px',
    thick: '3px',
  },
};

export const shadows = {
  none: 'none',
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
};

export const transitions = {
  fast: '150ms ease-in-out',
  base: '250ms ease-in-out',
  slow: '350ms ease-in-out',
};

// Combined theme object
export const theme = {
  colors,
  typography,
  spacing,
  borders,
  shadows,
  transitions,
};

export type Theme = typeof theme;
