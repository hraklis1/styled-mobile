import React, { useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, spacing, typography, radii } from '../../theme';
import {
  getSizeProfileType,
  getBottomDefaultMode,
  ALPHA_SIZES,
  HAT_ALPHA_SIZES,
  SHOE_REGIONS,
  RING_REGIONS,
  footwearSizesForRegion,
  ringSizesForRegion,
  type SizeProfile,
  type AlphaSizeValue,
  type InCm,
  type ShoeRegion,
  type RingRegion,
  type HatAlpha,
} from '../../lib/sizes';

interface SizeProfileInputProps {
  category: string | null | undefined;
  subcategory?: string | null;
  style?: string | null;
  formalityStyles?: string[] | null;
  value: SizeProfile | null | undefined;
  onChange: (profile: SizeProfile | null) => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SizeProfileInput({
  category,
  subcategory,
  style,
  formalityStyles,
  value,
  onChange,
  containerStyle,
}: SizeProfileInputProps) {
  const variant = getSizeProfileType(category, subcategory, style, formalityStyles);

  // Reset when the variant changes (e.g. user switches category)
  useEffect(() => {
    if (!value) return;
    if (value.type !== variant) onChange(null);
  }, [variant]);

  if (!variant) return null;

  const showNeckSleeve = category === 'top' || category === 'outerwear';

  return (
    <View style={[s.container, containerStyle]}>
      {variant === 'alpha' && (
        <AlphaSection
          value={value?.type === 'alpha' ? value : null}
          showNeckSleeve={showNeckSleeve}
          onChange={onChange}
        />
      )}
      {variant === 'outerwear_formal' && (
        <OuterwearFormalSection
          value={value?.type === 'outerwear_formal' ? value : null}
          onChange={onChange}
        />
      )}
      {variant === 'bottom' && (
        <BottomSection
          value={value?.type === 'bottom' ? value : null}
          subcategory={subcategory}
          onChange={onChange}
        />
      )}
      {variant === 'footwear' && (
        <FootwearSection
          value={value?.type === 'footwear' ? value : null}
          onChange={onChange}
        />
      )}
      {variant === 'watch' && (
        <WatchSection value={value?.type === 'watch' ? value : null} onChange={onChange} />
      )}
      {variant === 'eyewear' && (
        <EyewearSection value={value?.type === 'eyewear' ? value : null} onChange={onChange} />
      )}
      {variant === 'belt' && (
        <BeltSection value={value?.type === 'belt' ? value : null} onChange={onChange} />
      )}
      {variant === 'hat' && (
        <HatSection value={value?.type === 'hat' ? value : null} onChange={onChange} />
      )}
      {variant === 'chain' && (
        <ChainSection value={value?.type === 'chain' ? value : null} onChange={onChange} />
      )}
      {variant === 'ring' && (
        <RingSection value={value?.type === 'ring' ? value : null} onChange={onChange} />
      )}
    </View>
  );
}

// ─── Section components ───────────────────────────────────────────────────────

function AlphaSection({
  value,
  showNeckSleeve,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'alpha' }> | null;
  showNeckSleeve: boolean;
  onChange: (p: SizeProfile | null) => void;
}) {
  return (
    <View style={s.section}>
      <FieldLabel>Size</FieldLabel>
      <AlphaPills
        selected={value?.alpha ?? null}
        onSelect={(alpha) =>
          onChange({
            type: 'alpha',
            alpha,
            neck: value?.neck ?? null,
            neckUnit: value?.neckUnit ?? 'in',
            sleeve: value?.sleeve ?? null,
            sleeveUnit: value?.sleeveUnit ?? 'in',
          })
        }
      />
      {showNeckSleeve && value?.alpha && (
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Neck (opt.)</FieldLabel>
            <View style={s.row}>
              <TextInput
                style={[s.numInput, { flex: 1 }]}
                value={value.neck != null ? String(value.neck) : ''}
                onChangeText={(t) => {
                  const neck = t === '' ? null : parseFloat(t);
                  onChange({ type: 'alpha', alpha: value.alpha, neck, neckUnit: value.neckUnit ?? 'in', sleeve: value.sleeve ?? null, sleeveUnit: value.sleeveUnit ?? 'in' });
                }}
                placeholder="15.5"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <UnitToggle
                value={value.neckUnit ?? 'in'}
                onChange={(u) => onChange({ type: 'alpha', alpha: value.alpha, neck: value.neck ?? null, neckUnit: u, sleeve: value.sleeve ?? null, sleeveUnit: value.sleeveUnit ?? 'in' })}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>Sleeve (opt.)</FieldLabel>
            <View style={s.row}>
              <TextInput
                style={[s.numInput, { flex: 1 }]}
                value={value.sleeve != null ? String(value.sleeve) : ''}
                onChangeText={(t) => {
                  const sleeve = t === '' ? null : parseFloat(t);
                  onChange({ type: 'alpha', alpha: value.alpha, neck: value.neck ?? null, neckUnit: value.neckUnit ?? 'in', sleeve, sleeveUnit: value.sleeveUnit ?? 'in' });
                }}
                placeholder="33"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <UnitToggle
                value={value.sleeveUnit ?? 'in'}
                onChange={(u) => onChange({ type: 'alpha', alpha: value.alpha, neck: value.neck ?? null, neckUnit: value.neckUnit ?? 'in', sleeve: value.sleeve ?? null, sleeveUnit: u })}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function OuterwearFormalSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'outerwear_formal' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  const mode = value?.mode ?? 'alpha';
  return (
    <View style={s.section}>
      <ModeToggle
        options={[
          { label: 'Alpha (XS–XXL)', value: 'alpha' },
          { label: 'Chest measurement', value: 'numeric' },
        ]}
        selected={mode}
        onSelect={(m) => {
          if (m === 'alpha') onChange({ type: 'outerwear_formal', mode: 'alpha', alpha: value?.alpha });
          else onChange({ type: 'outerwear_formal', mode: 'numeric', chest: value?.chest ?? null, unit: value?.unit ?? 'in' });
        }}
      />
      {mode === 'alpha' ? (
        <>
          <FieldLabel>Size</FieldLabel>
          <AlphaPills
            selected={value?.alpha ?? null}
            onSelect={(alpha) => onChange({ type: 'outerwear_formal', mode: 'alpha', alpha })}
          />
        </>
      ) : (
        <>
          <FieldLabel>Chest</FieldLabel>
          <View style={s.row}>
            <TextInput
              style={[s.numInput, { flex: 1 }]}
              value={value?.chest != null ? String(value.chest) : ''}
              onChangeText={(t) => {
                const chest = t === '' ? null : parseFloat(t);
                onChange({ type: 'outerwear_formal', mode: 'numeric', chest, unit: value?.unit ?? 'in' });
              }}
              placeholder="40"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <UnitToggle
              value={value?.unit ?? 'in'}
              onChange={(unit) => onChange({ type: 'outerwear_formal', mode: 'numeric', chest: value?.chest ?? null, unit })}
            />
          </View>
        </>
      )}
    </View>
  );
}

function BottomSection({
  value,
  subcategory,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'bottom' }> | null;
  subcategory?: string | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  let mode: 'alpha' | 'numeric';
  if (value) {
    if (value.mode) mode = value.mode;
    else if (value.waist != null || value.inseam != null) mode = 'numeric';
    else if (value.alpha) mode = 'alpha';
    else mode = getBottomDefaultMode(subcategory);
  } else {
    mode = getBottomDefaultMode(subcategory);
  }

  const waistUnit: InCm = value?.waistUnit ?? 'in';
  const inseamUnit: InCm = value?.inseamUnit ?? 'in';

  return (
    <View style={s.section}>
      <ModeToggle
        options={[
          { label: 'Alpha (S/M/L)', value: 'alpha' },
          { label: 'Waist / Inseam', value: 'numeric' },
        ]}
        selected={mode}
        onSelect={(m) => {
          if (m === 'alpha') onChange({ type: 'bottom', mode: 'alpha' });
          else onChange({ type: 'bottom', mode: 'numeric' });
        }}
      />
      {mode === 'alpha' ? (
        <>
          <FieldLabel>Size</FieldLabel>
          <AlphaPills
            selected={value?.alpha ?? null}
            onSelect={(alpha) => onChange({ type: 'bottom', mode: 'alpha', alpha })}
          />
        </>
      ) : (
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <FieldLabel>Waist</FieldLabel>
            <View style={s.row}>
              <TextInput
                style={[s.numInput, { flex: 1 }]}
                value={value?.waist != null ? String(value.waist) : ''}
                onChangeText={(t) => {
                  const waist = t === '' ? undefined : parseInt(t);
                  onChange({ type: 'bottom', mode: 'numeric', waist, waistUnit, inseam: value?.inseam, inseamUnit });
                }}
                placeholder="32"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              <UnitToggle
                value={waistUnit}
                onChange={(u) => onChange({ type: 'bottom', mode: 'numeric', waist: value?.waist, waistUnit: u, inseam: value?.inseam, inseamUnit })}
              />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel>Inseam</FieldLabel>
            <View style={s.row}>
              <TextInput
                style={[s.numInput, { flex: 1 }]}
                value={value?.inseam != null ? String(value.inseam) : ''}
                onChangeText={(t) => {
                  const inseam = t === '' ? undefined : parseInt(t);
                  onChange({ type: 'bottom', mode: 'numeric', waist: value?.waist, waistUnit, inseam, inseamUnit });
                }}
                placeholder="30"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
              <UnitToggle
                value={inseamUnit}
                onChange={(u) => onChange({ type: 'bottom', mode: 'numeric', waist: value?.waist, waistUnit, inseam: value?.inseam, inseamUnit: u })}
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

function FootwearSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'footwear' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  const region: ShoeRegion = value?.region ?? 'US';
  const sizeOptions = footwearSizesForRegion(region);
  return (
    <View style={s.section}>
      <FieldLabel>Region</FieldLabel>
      <ModeToggle
        options={SHOE_REGIONS.map((r) => ({ label: r, value: r }))}
        selected={region}
        onSelect={(r) => onChange({ type: 'footwear', numericSize: value?.numericSize ?? 9, region: r as ShoeRegion })}
      />
      <FieldLabel>{`Size (${region})`}</FieldLabel>
      <TextInput
        style={s.numInput}
        value={value?.numericSize != null ? String(value.numericSize) : ''}
        onChangeText={(t) => {
          if (t === '') { onChange(null); return; }
          onChange({ type: 'footwear', numericSize: parseFloat(t), region });
        }}
        placeholder={region === 'EU' ? '42' : '9.5'}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
      />
      <Text style={s.hint}>Options: {sizeOptions.slice(0, 4).join(', ')}…{sizeOptions[sizeOptions.length - 1]}</Text>
    </View>
  );
}

function WatchSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'watch' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  return (
    <View style={s.section}>
      <FieldLabel>Case diameter (mm)</FieldLabel>
      <TextInput
        style={s.numInput}
        value={value?.caseDiameter != null ? String(value.caseDiameter) : ''}
        onChangeText={(t) => {
          if (t === '') { onChange(null); return; }
          onChange({ type: 'watch', caseDiameter: parseFloat(t), unit: 'mm' });
        }}
        placeholder="40"
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
      />
    </View>
  );
}

function EyewearSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'eyewear' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  const update = (key: 'lens' | 'bridge' | 'temple', t: string) => {
    if (t === '') { onChange(null); return; }
    const val = parseFloat(t);
    onChange({
      type: 'eyewear',
      lens: key === 'lens' ? val : (value?.lens ?? val),
      bridge: key === 'bridge' ? val : (value?.bridge ?? val),
      temple: key === 'temple' ? val : (value?.temple ?? val),
      unit: 'mm',
    });
  };
  return (
    <View style={s.section}>
      <Text style={s.hint}>Lens – Bridge – Temple (mm) e.g. 52-19-145</Text>
      <View style={s.threeCol}>
        {(['lens', 'bridge', 'temple'] as const).map((key) => (
          <View key={key} style={{ flex: 1 }}>
            <FieldLabel>{key.charAt(0).toUpperCase() + key.slice(1)}</FieldLabel>
            <TextInput
              style={s.numInput}
              value={value?.[key] != null ? String(value[key]) : ''}
              onChangeText={(t) => update(key, t)}
              placeholder={key === 'lens' ? '52' : key === 'bridge' ? '19' : '145'}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function BeltSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'belt' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  return (
    <View style={s.section}>
      <FieldLabel>Belt length</FieldLabel>
      <View style={s.row}>
        <TextInput
          style={[s.numInput, { flex: 1 }]}
          value={value?.length != null ? String(value.length) : ''}
          onChangeText={(t) => {
            if (t === '') { onChange(null); return; }
            onChange({ type: 'belt', length: parseFloat(t), unit: value?.unit ?? 'in' });
          }}
          placeholder="34"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
        <UnitToggle
          value={value?.unit ?? 'in'}
          onChange={(unit) => { if (value?.length != null) onChange({ type: 'belt', length: value.length, unit }); }}
        />
      </View>
    </View>
  );
}

function HatSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'hat' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  const mode: 'alpha' | 'circumference' = value?.mode ?? 'alpha';
  return (
    <View style={s.section}>
      <ModeToggle
        options={[
          { label: 'S/M/L/XL', value: 'alpha' },
          { label: 'Circumference', value: 'circumference' },
        ]}
        selected={mode}
        onSelect={(m) => {
          if (m === 'alpha') onChange({ type: 'hat', mode: 'alpha', alpha: value?.mode === 'alpha' ? value.alpha : undefined });
          else onChange({ type: 'hat', mode: 'circumference', circumference: null, unit: value?.unit ?? 'in' });
        }}
      />
      {mode === 'alpha' ? (
        <>
          <FieldLabel>Size</FieldLabel>
          <HatAlphaPills
            selected={(value?.mode === 'alpha' ? value.alpha : undefined) ?? null}
            onSelect={(alpha) => onChange({ type: 'hat', mode: 'alpha', alpha })}
          />
        </>
      ) : (
        <>
          <FieldLabel>Head circumference</FieldLabel>
          <View style={s.row}>
            <TextInput
              style={[s.numInput, { flex: 1 }]}
              value={value?.mode === 'circumference' && value.circumference != null ? String(value.circumference) : ''}
              onChangeText={(t) => {
                const circumference = t === '' ? null : parseFloat(t);
                onChange({ type: 'hat', mode: 'circumference', circumference, unit: value?.unit ?? 'in' });
              }}
              placeholder="22"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="decimal-pad"
            />
            <UnitToggle
              value={value?.unit ?? 'in'}
              onChange={(unit) => onChange({ type: 'hat', mode: 'circumference', circumference: value?.mode === 'circumference' ? value.circumference : null, unit })}
            />
          </View>
        </>
      )}
    </View>
  );
}

function ChainSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'chain' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  return (
    <View style={s.section}>
      <FieldLabel>Length</FieldLabel>
      <View style={s.row}>
        <TextInput
          style={[s.numInput, { flex: 1 }]}
          value={value?.length != null ? String(value.length) : ''}
          onChangeText={(t) => {
            if (t === '') { onChange(null); return; }
            onChange({ type: 'chain', length: parseFloat(t), unit: value?.unit ?? 'in' });
          }}
          placeholder="18"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
        <UnitToggle
          value={value?.unit ?? 'in'}
          onChange={(unit) => { if (value?.length != null) onChange({ type: 'chain', length: value.length, unit }); }}
        />
      </View>
    </View>
  );
}

function RingSection({
  value,
  onChange,
}: {
  value: Extract<SizeProfile, { type: 'ring' }> | null;
  onChange: (p: SizeProfile | null) => void;
}) {
  const region: RingRegion = value?.region ?? 'US';
  const sizeOptions = ringSizesForRegion(region);
  return (
    <View style={s.section}>
      <FieldLabel>Region</FieldLabel>
      <ModeToggle
        options={RING_REGIONS.map((r) => ({ label: r, value: r }))}
        selected={region}
        onSelect={(r) => onChange({ type: 'ring', ringSize: value?.ringSize ?? '', region: r as RingRegion })}
      />
      <FieldLabel>{`Ring size (${region})`}</FieldLabel>
      <TextInput
        style={s.numInput}
        value={value?.ringSize != null ? String(value.ringSize) : ''}
        onChangeText={(t) => {
          if (t === '') { onChange(null); return; }
          onChange({ type: 'ring', ringSize: t, region });
        }}
        placeholder={region === 'EU' ? '52' : '7'}
        placeholderTextColor={colors.mutedForeground}
        keyboardType="decimal-pad"
      />
      <Text style={s.hint}>Options: {sizeOptions.slice(0, 4).join(', ')}…{sizeOptions[sizeOptions.length - 1]}</Text>
    </View>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: string }) {
  return <Text style={s.fieldLabel}>{children}</Text>;
}

function AlphaPills({
  selected,
  onSelect,
}: {
  selected: AlphaSizeValue | null;
  onSelect: (v: AlphaSizeValue) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.pillScroll}>
      <View style={s.pillRow}>
        {ALPHA_SIZES.map((size) => {
          const active = selected === size;
          return (
            <TouchableOpacity
              key={size}
              style={[s.pill, active && s.pillActive]}
              onPress={() => onSelect(size)}
              activeOpacity={0.7}
            >
              <Text style={[s.pillText, active && s.pillTextActive]}>{size}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </ScrollView>
  );
}

function HatAlphaPills({
  selected,
  onSelect,
}: {
  selected: HatAlpha | null;
  onSelect: (v: HatAlpha) => void;
}) {
  return (
    <View style={s.pillRow}>
      {HAT_ALPHA_SIZES.map((size) => {
        const active = selected === size;
        return (
          <TouchableOpacity
            key={size}
            style={[s.pill, active && s.pillActive]}
            onPress={() => onSelect(size)}
            activeOpacity={0.7}
          >
            <Text style={[s.pillText, active && s.pillTextActive]}>{size}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ModeToggle({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; value: string }[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={s.modeRow}>
      {options.map(({ label, value }) => {
        const active = selected === value;
        return (
          <TouchableOpacity
            key={value}
            style={[s.modeBtn, active && s.modeBtnActive]}
            onPress={() => onSelect(value)}
            activeOpacity={0.7}
          >
            <Text style={[s.modeBtnText, active && s.modeBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function UnitToggle({
  value,
  onChange,
}: {
  value: InCm;
  onChange: (v: InCm) => void;
}) {
  return (
    <View style={s.unitRow}>
      {(['in', 'cm'] as const).map((u) => (
        <TouchableOpacity
          key={u}
          style={[s.unitBtn, value === u && s.unitBtnActive]}
          onPress={() => onChange(u)}
          activeOpacity={0.7}
        >
          <Text style={[s.unitText, value === u && s.unitTextActive]}>{u}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { gap: spacing.md },
  section: { gap: spacing.sm },
  fieldLabel: {
    fontSize: typography.size.xs,
    fontWeight: typography.weight.semibold,
    color: colors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  hint: { fontSize: typography.size.xs, color: colors.mutedForeground },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  twoCol: { flexDirection: 'row', gap: spacing.md },
  threeCol: { flexDirection: 'row', gap: spacing.sm },
  numInput: {
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    fontSize: typography.size.md,
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  pillScroll: { flexGrow: 0 },
  pillRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'nowrap' },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.full,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  pillTextActive: { color: colors.primaryForeground },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  modeBtnText: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.medium,
    color: colors.foreground,
  },
  modeBtnTextActive: { color: colors.primaryForeground },
  unitRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  unitBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.muted,
    minWidth: 32,
    alignItems: 'center',
  },
  unitBtnActive: { backgroundColor: colors.primary },
  unitText: { fontSize: typography.size.xs, fontWeight: typography.weight.medium, color: colors.foreground },
  unitTextActive: { color: colors.primaryForeground },
});
