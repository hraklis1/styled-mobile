import Svg, { Circle, G, Rect, Text as SvgText, type SvgProps } from 'react-native-svg';

const LETTERS = ['S', 'T', 'Y', 'L', 'E', 'D'] as const;
const FILLED_LETTER_INDICES = new Set([0, 3]);

type StyledWordmarkProps = SvgProps & {
  showBackdrop?: boolean;
};

export function StyledWordmark({ showBackdrop = true, ...props }: StyledWordmarkProps) {
  const startX = 22;
  const step = 28;
  const baselineY = 44;

  return (
    <Svg
      viewBox="0 0 220 64"
      accessible
      accessibilityLabel="Styled"
      {...props}
    >
      {showBackdrop && (
        <Rect
          x={0}
          y={0}
          width={220}
          height={64}
          rx={16}
          fill="#EDE7DC"
        />
      )}
      <G fontFamily="System" fontWeight="800" fontSize={42}>
        {LETTERS.map((letter, index) => {
          const isFilled = FILLED_LETTER_INDICES.has(index);

          return (
            <SvgText
              key={`${letter}-${index}`}
              x={startX + index * step}
              y={baselineY}
              textAnchor="middle"
              fill={isFilled ? '#74553E' : 'none'}
              stroke="#74553E"
              strokeWidth={isFilled ? 0 : 2.2}
              strokeLinejoin="round"
            >
              {letter}
            </SvgText>
          );
        })}
        <Circle
          cx={startX + LETTERS.length * step - 6}
          cy={baselineY - 4}
          r={3.8}
          fill="#74553E"
        />
      </G>
    </Svg>
  );
}
