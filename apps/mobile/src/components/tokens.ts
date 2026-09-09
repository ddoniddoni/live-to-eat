import { Platform } from 'react-native';

export const colors = {
  canvas: '#F3F5EF',
  ink: '#182028',
  muted: '#657078',
  paper: '#FFFFFF',
  panelMuted: '#B7C0C5',
  rule: '#354049',
  tomato: '#FF5B45',
  wasabi: '#C7EE55',
} as const;

export const spacing = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  page: 24,
} as const;

export const radii = {
  panel: 28,
  pill: 999,
} as const;

export const type = {
  body: Platform.select({ ios: 'Avenir Next', android: 'sans-serif', default: 'system-ui' }),
  display: Platform.select({ ios: 'Avenir Next Condensed', android: 'sans-serif-condensed', default: 'system-ui' }),
  utility: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
} as const;
