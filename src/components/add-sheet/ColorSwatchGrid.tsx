import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NORMALIZED_COLORS, type NormalizedColor } from '../../types/item';
import { NORMALIZED_COLOR_HEX, isColorLight, normalizedColorDisplayName } from '../../lib/colorUtils';

interface ColorSwatchGridProps {
  selected: NormalizedColor | null;
  onSelect: (color: NormalizedColor, displayName: string) => void;
  disabled: boolean;
}

export function ColorSwatchGrid({ selected, onSelect, disabled }: ColorSwatchGridProps) {
  return (
    <View style={styles.grid}>
      {NORMALIZED_COLORS.map((color) => {
        const hex = NORMALIZED_COLOR_HEX[color];
        const isSelected = selected === color;
        const light = isColorLight(hex);
        const selectedBorderColor = light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)';
        return (
          <TouchableOpacity
            key={color}
            style={[
              styles.swatch,
              { backgroundColor: hex, borderColor: isSelected ? selectedBorderColor : 'transparent' },
              isSelected && styles.swatchSelected,
            ]}
            onPress={() => onSelect(color, normalizedColorDisplayName(color))}
            disabled={disabled}
            activeOpacity={0.75}
          >
            {isSelected && (
              <Ionicons name="checkmark" size={14} color={light ? '#000000' : '#FFFFFF'} />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  swatchSelected: {
    transform: [{ scale: 1.05 }],
  },
});
