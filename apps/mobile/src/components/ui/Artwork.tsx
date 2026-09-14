import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import { View } from 'react-native';
import { colors } from '@/components/tokens';
export function FoodArtwork({ kind = 0, size = 82 }: { kind?: number; size?: number }) {
  const palette = [colors.blush, colors.sage, colors.lavender, colors.blue];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: palette[kind % 4],
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 100 100" aria-hidden={true}
        accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {kind % 4 === 1 ? (
          <G>
            <Ellipse cx="50" cy="77" rx="31" ry="7" fill="#B7C9AB" />
            <Path d="M28 37h40v23c0 24-40 24-40 0Z" fill="#FAFBF9" />
            <Path d="M68 42h6c16 0 12 22-6 19" stroke="#FAFBF9" strokeWidth="7" fill="none" />
            <Ellipse cx="48" cy="38" rx="20" ry="7" fill="#6D5140" />
            <Path d="M40 28c-8-8 8-9 0-17m15 17c-8-8 8-9 0-17" stroke="#8BA07C" strokeWidth="2" fill="none" />
          </G>
        ) : kind % 4 === 2 ? (
          <G transform="rotate(-20 50 50)">
            <Ellipse cx="50" cy="64" rx="34" ry="21" fill="#DDD5E8" />
            <Path d="M19 55c1-35 58-40 65-2-9 27-53 29-65 2Z" fill="#BE793B" />
            <Path
              d="m35 35 5 14m9-18 5 16m9-11 4 13"
              stroke="#F8DCA3"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </G>
        ) : (
          <G>
            <Circle cx="50" cy="53" r="34" fill="#FFFFFF" />
            <Circle
              cx="50"
              cy="53"
              r="26"
              stroke={kind % 4 === 0 ? '#E8C8B7' : '#CDDFE8'}
              strokeWidth="1.5"
              fill="none"
            />
            <Path
              d="M31 47c4-14 29-16 37-3 6 9-4 24-17 25-18 2-29-13-16-20 12-8 29 7 19 12-9 5-16-9-8-17"
              stroke={kind % 4 === 0 ? '#DDA448' : '#BDB483'}
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />
            <Circle cx="62" cy="43" r="5" fill={colors.tomato} />
            <Circle cx="37" cy="60" r="4" fill={colors.tomato} />
            <Path d="M43 31c14-5 17 7 5 11-1-5-7-5-5-11m14 29c13-1 11 10 1 12-1-5-6-7-1-12" fill="#638265" />
          </G>
        )}
      </Svg>
    </View>
  );
}
export function MapArtwork() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 360 190"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden={true}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Rect width="360" height="190" fill="#E9EEE5" />
      <Path d="m-20 166 400-51" stroke="#D0E2E9" strokeWidth="30" />
      <Path
        d="M55-10 85 210M165-10l25 210M290-10l-14 220M-10 34l400 33M-10 91l400-9M-10 176l400-27"
        stroke="#FAFBF8"
        strokeWidth="13"
      />
      <Rect x="106" y="9" width="45" height="25" rx="8" fill="#D4DFC9" />
      <Rect x="213" y="91" width="48" height="31" rx="9" fill="#D4DFC9" />
      <Path
        d="m110 126 33-47 88-8 47 35"
        stroke="#B7C1B0"
        strokeWidth="2"
        strokeDasharray="4 5"
        fill="none"
      />
      {[
        { x: 110, y: 126 },
        { x: 143, y: 79 },
        { x: 231, y: 71 },
        { x: 278, y: 106 },
      ].map((p, i) => (
        <G key={p.x} transform={`translate(${p.x} ${p.y})`}>
          <Ellipse cx="0" cy="12" rx="11" ry="4" fill="#ABB3A3" opacity=".35" />
          <Path
            d="M0 14S-15-1-15-9a15 15 0 1 1 30 0C15-1 0 14 0 14"
            fill={i === 1 ? colors.ink : colors.tomato}
          />
          <Circle cx="0" cy="-9" r="5" fill="white" />
        </G>
      ))}
    </Svg>
  );
}
