import { StyleSheet } from 'react-native';

export const lightColors = {
  primary: '#153328',
  onPrimary: '#ffffff',
  primaryContainer: '#2c4a3e',
  onPrimaryContainer: '#98b9a9',
  primaryFixed: '#c8eada',
  primaryFixedDim: '#adcebe',
  onPrimaryFixed: '#012016',
  onPrimaryFixedVariant: '#2f4d41',
  inversePrimary: '#adcebe',

  secondary: '#5d5f5d',
  onSecondary: '#ffffff',
  secondaryContainer: '#dfe0dd',
  onSecondaryContainer: '#616361',
  secondaryFixed: '#e2e3e0',
  secondaryFixedDim: '#c5c7c4',
  onSecondaryFixed: '#191c1b',
  onSecondaryFixedVariant: '#454745',

  tertiary: '#2c2f2a',
  onTertiary: '#ffffff',
  tertiaryContainer: '#424540',
  onTertiaryContainer: '#b0b2ac',
  tertiaryFixed: '#e1e3dc',
  tertiaryFixedDim: '#c5c7c1',
  onTertiaryFixed: '#191c18',
  onTertiaryFixedVariant: '#454843',

  error: '#ba1a1a',
  onError: '#ffffff',
  errorContainer: '#ffdad6',
  onErrorContainer: '#93000a',

  background: '#fcf9f8',
  onBackground: '#1c1b1b',
  surface: '#fcf9f8',
  onSurface: '#1c1b1b',
  surfaceVariant: '#e5e2e1',
  onSurfaceVariant: '#414845',
  surfaceDim: '#dcd9d9',
  surfaceBright: '#fcf9f8',
  surfaceContainerLowest: '#ffffff',
  surfaceContainerLow: '#f6f3f2',
  surfaceContainer: '#f0eded',
  surfaceContainerHigh: '#eae7e7',
  surfaceContainerHighest: '#e5e2e1',
  inverseSurface: '#313030',
  inverseOnSurface: '#f3f0ef',

  outline: '#727974',
  outlineVariant: '#c1c8c3',
  surfaceTint: '#466558',

  headerBg: '#F4F5F2',
  white: '#ffffff',
};

export const darkColors = {
  // Green accent preserved, all backgrounds/surfaces pure neutral black
  primary: '#adcebe',
  onPrimary: '#012016',
  primaryContainer: '#1f4a35',
  onPrimaryContainer: '#adcebe',
  primaryFixed: '#0d2018',
  primaryFixedDim: '#153328',
  onPrimaryFixed: '#adcebe',
  onPrimaryFixedVariant: '#7ab89a',
  inversePrimary: '#153328',

  secondary: '#cccccc',
  onSecondary: '#1a1a1a',
  secondaryContainer: '#2a2a2a',
  onSecondaryContainer: '#dddddd',
  secondaryFixed: '#e0e0e0',
  secondaryFixedDim: '#bbbbbb',
  onSecondaryFixed: '#111111',
  onSecondaryFixedVariant: '#888888',

  tertiary: '#bbbbbb',
  onTertiary: '#1a1a1a',
  tertiaryContainer: '#252525',
  onTertiaryContainer: '#dddddd',
  tertiaryFixed: '#222222',
  tertiaryFixedDim: '#2d2d2d',
  onTertiaryFixed: '#dddddd',
  onTertiaryFixedVariant: '#aaaaaa',

  error: '#ffb4ab',
  onError: '#690005',
  errorContainer: '#6e1010',
  onErrorContainer: '#ffdad6',

  background: '#000000',
  onBackground: '#ffffff',
  surface: '#000000',
  onSurface: '#ffffff',
  surfaceVariant: '#2a2a2a',
  onSurfaceVariant: '#aaaaaa',
  surfaceDim: '#000000',
  surfaceBright: '#2a2a2a',
  surfaceContainerLowest: '#000000',
  surfaceContainerLow: '#111111',
  surfaceContainer: '#1a1a1a',
  surfaceContainerHigh: '#222222',
  surfaceContainerHighest: '#2d2d2d',
  inverseSurface: '#f0f0f0',
  inverseOnSurface: '#1a1a1a',

  outline: '#666666',
  outlineVariant: '#333333',
  surfaceTint: '#adcebe',

  headerBg: '#111111',
  white: '#ffffff',
};

export const colors = lightColors;

export const typography = {
  h1: {
    fontFamily: 'Inter_600SemiBold' as const,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.64,
  },
  h2: {
    fontFamily: 'Inter_600SemiBold' as const,
    fontSize: 24,
    lineHeight: 31,
    letterSpacing: -0.24,
  },
  bodyLg: {
    fontFamily: 'Inter_400Regular' as const,
    fontSize: 18,
    lineHeight: 29,
    letterSpacing: 0,
  },
  bodyMd: {
    fontFamily: 'Inter_400Regular' as const,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  labelCaps: {
    fontFamily: 'Inter_700Bold' as const,
    fontSize: 12,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: 'Inter_600SemiBold' as const,
    fontSize: 17,
    lineHeight: 17,
    letterSpacing: 0,
  },
};

export const spacing = {
  unit: 8,
  marginPage: 24,
  gutter: 16,
  stackSm: 8,
  stackMd: 16,
  stackLg: 32,
  sectionGap: 48,
};

export const radius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const shadow = {
  ambient: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 24,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
};
