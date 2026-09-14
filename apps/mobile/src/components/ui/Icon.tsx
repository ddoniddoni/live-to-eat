import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/components/tokens';
export type IconName =
  | 'map'
  | 'compass'
  | 'person'
  | 'plus'
  | 'search'
  | 'chevron'
  | 'back'
  | 'close'
  | 'check'
  | 'heart'
  | 'pin'
  | 'lock'
  | 'share'
  | 'folder'
  | 'globe'
  | 'list'
  | 'sliders'
  | 'more'
  | 'arrow'
  | 'download'
  | 'shield'
  | 'help'
  | 'logout'
  | 'edit'
  | 'trash'
  | 'clock'
  | 'link'
  | 'coffee'
  | 'utensils';
const paths: Record<IconName, string> = {
  map: 'm9 18-6 3V6l6-3 6 3 6-3v15l-6 3-6-3V3m6 3v15',
  compass: 'm16 8-3 5-5 3 3-5 5-3',
  person: 'M20 21v-2a7 7 0 0 0-14 0v2M17 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  plus: 'M12 5v14M5 12h14',
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  chevron: 'm9 5 7 7-7 7',
  back: 'm15 5-7 7 7 7',
  close: 'm6 6 12 12M6 18 18 6',
  check: 'm5 12 4 4L19 6',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8',
  pin: 'M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0M15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M12 15v3',
  share: 'M12 16V2m-5 5 5-5 5 5M5 11H3v10h18V11h-2',
  folder: 'M3 6V4h6l2 3h10v14H3V6',
  globe: 'M2 12h20M12 2c6 6 6 14 0 20-6-6-6-14 0-20',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1',
  sliders: 'M4 7h5m4 0h7M4 17h9m4 0h3M9 4v6m4 4v6',
  more: 'M5 12h.1M12 12h.1M19 12h.1',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  shield: 'M12 2 3 6v6c0 6 9 10 9 10s9-4 9-10V6l-9-4m-4 10 3 3 5-6',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4h.1',
  logout: 'M9 3H3v18h6m6-14 5 5-5 5M8 12h12',
  edit: 'm14 4 6 6M3 21l5-1L21 7l-5-5L3 15v6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7',
  clock: 'M12 6v6l4 2',
  link: 'm10 13 4-4M9 7l3-3a5 5 0 0 1 7 7l-3 3M15 17l-3 3a5 5 0 0 1-7-7l3-3',
  coffee: 'M3 8h14v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8m14 0h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3',
  utensils: 'M4 3v6a3 3 0 0 0 6 0V3M7 3v19M18 22V3c-4 2-5 7 0 9',
};
export function Icon({
  name,
  size = 22,
  color = colors.ink,
  filled = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden={true}
      accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {['compass', 'globe', 'help', 'clock'].includes(name) ? (
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="1.7" />
      ) : null}
      {name === 'lock' ? (
        <Rect x="4" y="11" width="16" height="11" rx="2" stroke={color} strokeWidth="1.7" />
      ) : null}
      <Path
        d={paths[name]}
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}
