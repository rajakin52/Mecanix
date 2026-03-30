export const colors = {
  // MECANIX Brand — Golden amber + dark charcoal
  primary: {
    50:  '#FEF9EE',
    100: '#FBF0D4',
    200: '#F7DDA8',
    300: '#F2C572',
    400: '#ECA83C',
    500: '#E5961F',
    600: '#D47A14',
    700: '#B05C13',
    800: '#8F4917',
    900: '#763D16',
    950: '#431E09',
  },
  secondary: {
    50:  '#F5F5F7',
    100: '#E5E5EA',
    200: '#C7C7CC',
    300: '#AEAEB2',
    400: '#8E8E93',
    500: '#636366',
    600: '#48484A',
    700: '#363638',
    800: '#2B2D33',
    900: '#1C1C1E',
    950: '#0A0A0C',
  },
  brand: {
    gold: '#D4992A',
    dark: '#2B2D33',
    amber: '#E5A82E',
  },
  success: '#00C853',
  warning: '#FFB300',
  error: '#FF3B30',
  info: '#2196F3',
  white: '#FFFFFF',
  black: '#0A0A0C',
  background: {
    light: '#FFFFFF',
    subtle: '#FAFAFA',
    dark: '#0A0A0C',
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 32,
    '4xl': 40,
  },
  fontWeight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
} as const;
