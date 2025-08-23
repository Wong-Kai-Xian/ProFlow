// Professional Design System for ProFlow
// Consistent colors, typography, and spacing across all pages

export const DESIGN_SYSTEM = {
  // Professional Office Color Palette
  colors: {
    // Primary colors - Professional blues and grays
    primary: {
      50: '#f0f9ff',
      100: '#e0f2fe', 
      200: '#bae6fd',
      300: '#7dd3fc',
      400: '#38bdf8',
      500: '#0ea5e9', // Main brand blue
      600: '#0284c7',
      700: '#0369a1',
      800: '#075985',
      900: '#0c4a6e'
    },
    
    // Secondary colors - Warm grays
    secondary: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b',
      900: '#0f172a'
    },
    
    // Accent colors
    accent: {
      green: '#059669',
      orange: '#ea580c',
      purple: '#7c3aed',
      red: '#dc2626',
      yellow: '#d97706',
      linkedin: '#0077b5', // Standard LinkedIn blue
      twitter: '#1DA1F2',  // Standard Twitter blue
    },
    
    // Functional colors
    success: '#059669',
    warning: '#d97706',
    error: '#dc2626',
    info: '#0ea5e9',
    
    // Background variations
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      dark: '#0f172a'
    },
    
    // Text colors
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      tertiary: '#64748b',
      light: '#94a3b8',
      inverse: '#ffffff'
    }
  },

  // Typography scale
  typography: {
    fontFamily: {
      primary: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif",
      mono: "'JetBrains Mono', 'Fira Code', monospace"
    },
    fontSize: {
      xs: '12px',
      sm: '14px',
      base: '16px',
      lg: '18px',
      xl: '20px',
      '2xl': '24px',
      '3xl': '30px',
      '4xl': '36px'
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700
    }
  },

  // Spacing scale
  spacing: {
    xs: '4px',
    sm: '8px',
    base: '16px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px'
  },

  // Border radius
  borderRadius: {
    sm: '4px',
    base: '8px',
    lg: '12px',
    xl: '16px',
    full: '50%'
  },

  // Shadows
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  },

  // Page-specific themes while maintaining consistency
  pageThemes: {
    home: {
      accent: '#0ea5e9', // Primary blue
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
      cardGradient: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)'
    },
    projects: {
      accent: '#059669', // Green for productivity
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      cardGradient: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)'
    },
    forums: {
      accent: '#7c3aed', // Purple for communication
      gradient: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      cardGradient: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)'
    },
    customers: {
      accent: '#ea580c', // Orange for business
      gradient: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
      cardGradient: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)'
    },
    profile: {
      accent: '#0ea5e9', // Using primary blue for profile actions directly
      gradient: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)',
      cardGradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
    },
    neutral: { // New neutral theme
      accent: '#64748b', // Secondary gray 500
      gradient: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
      cardGradient: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
    },
    error: { // New error theme
      accent: '#dc2626', // Red for error actions
      gradient: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)',
      cardGradient: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
    }
  }
};

// Helper functions for consistent styling
export const getCardStyle = (theme = 'home') => ({
  background: DESIGN_SYSTEM.colors.background.primary,
  borderRadius: DESIGN_SYSTEM.borderRadius.lg,
  boxShadow: DESIGN_SYSTEM.shadows.md,
  border: `1px solid ${DESIGN_SYSTEM.colors.secondary[200]}`,
  overflow: 'hidden'
});

export const getHeaderStyle = (theme = 'home') => ({
  background: DESIGN_SYSTEM.pageThemes[theme].gradient,
  color: DESIGN_SYSTEM.colors.text.inverse,
  padding: `${DESIGN_SYSTEM.spacing.lg} ${DESIGN_SYSTEM.spacing.xl}`,
  borderRadius: `${DESIGN_SYSTEM.borderRadius.lg} ${DESIGN_SYSTEM.borderRadius.lg} 0 0`
});

export const getButtonStyle = (variant = 'primary', theme = 'home') => {
  const baseStyle = {
    fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
    fontSize: DESIGN_SYSTEM.typography.fontSize.sm,
    fontWeight: DESIGN_SYSTEM.typography.fontWeight.medium,
    padding: `${DESIGN_SYSTEM.spacing.sm} ${DESIGN_SYSTEM.spacing.base}`,
    borderRadius: DESIGN_SYSTEM.borderRadius.base,
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DESIGN_SYSTEM.spacing.xs
  };

  switch (variant) {
    case 'primary':
      return {
        ...baseStyle,
        background: DESIGN_SYSTEM.pageThemes[theme].accent,
        color: DESIGN_SYSTEM.colors.text.inverse,
        boxShadow: DESIGN_SYSTEM.shadows.sm
      };
    case 'secondary':
      return {
        ...baseStyle,
        background: DESIGN_SYSTEM.colors.secondary[100],
        color: DESIGN_SYSTEM.colors.text.primary,
        border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`
      };
    case 'ghost':
      return {
        ...baseStyle,
        background: 'transparent',
        color: DESIGN_SYSTEM.colors.text.secondary,
        border: `1px solid ${DESIGN_SYSTEM.colors.secondary[300]}`
      };
    default:
      return baseStyle;
  }
};

export const getPageContainerStyle = () => ({
  fontFamily: DESIGN_SYSTEM.typography.fontFamily.primary,
  background: DESIGN_SYSTEM.colors.background.secondary,
  minHeight: '100vh',
  color: DESIGN_SYSTEM.colors.text.primary
});

export const getPageHeaderStyle = (theme = 'home') => ({
  background: DESIGN_SYSTEM.pageThemes[theme].gradient,
  color: DESIGN_SYSTEM.colors.text.inverse,
  padding: `${DESIGN_SYSTEM.spacing.lg} 0`,
  marginBottom: DESIGN_SYSTEM.spacing.xl,
  boxShadow: DESIGN_SYSTEM.shadows.md
});

export const getContentContainerStyle = () => ({
  maxWidth: '1400px',
  margin: '0 auto',
  padding: `0 ${DESIGN_SYSTEM.spacing.xl}`,
  paddingBottom: DESIGN_SYSTEM.spacing['3xl']
});
