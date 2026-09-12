import { Platform } from 'react-native';

export const colors = {
  canvas: '#FAFBF9',
  ink: '#252C29',
  muted: '#717772',
  paper: '#FFFFFF',
  panelMuted: '#DDE4DD',
  rule: '#E7EAE5',
  tomato: '#C84032',
  wasabi: '#DFEDCD',
  blush: '#FBECE6',
  sage: '#E9EFE4',
  lavender: '#EFEBF5',
  blue: '#E8EFF4',
  success: '#427048',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  page: 24,
} as const;

export const radii = {
  panel: 22,
  pill: 999,
} as const;

export const type = {
  body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'system-ui' }),
  display: Platform.select({ ios: 'Avenir Next Condensed', android: 'sans-serif-condensed', default: 'system-ui' }),
  utility: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;
