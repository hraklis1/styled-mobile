import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EditScaffold, FineTune, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { FieldLabel, OptionChips, SingleChips, styles, type SizeExtraKey } from '../../components/profile/fields';
import { CustomProfileChips } from '../../components/profile/CustomProfileChips';
import { SelectRow } from '../../components/profile/SelectRow';
import { ProfilePickerModal } from '../../components/profile/ProfilePickerModal';
import {
  BODY_TYPE_OPTIONS,
  COMFORT_OPTIONS,
  COVERAGE_OPTIONS,
  FIT_PREFERENCE_OPTIONS,
  SENSITIVE_PROPORTION_OPTIONS,
  SIZING_REGION_OPTIONS,
  TOP_SIZES,
  optionsForCut,
} from '../../lib/profileOptions';
import { JACKET_LENGTH_OPTIONS } from '../../hooks/useProfileForm';
import { colors } from '../../theme';
import { useProfileEditor } from './useProfileEditor';

const SIZE_EXTRAS: [SizeExtraKey, string][] = [
  ['neck', 'Neck'],
  ['sleeve', 'Sleeve'],
  ['shoeWidth', 'Shoe width'],
  ['heelComfort', 'Heel comfort'],
  ['braSize', 'Bra size'],
  ['hat', 'Hat'],
  ['belt', 'Belt'],
  ['ring', 'Ring'],
  ['eyewear', 'Eyewear'],
  ['watch', 'Watch'],
];

export function EditFitScreen() {
  const { form, details, updateSensitive, setSizeExtra, save } = useProfileEditor();
  const unit = form.sizingRegion === 'EU' ? 'cm' : 'in';
  const fmt = (value: string) => (value ? (form.sizingRegion === 'EU' ? `${value} cm` : `${value}"`) : '');
  const activeCfg = form.activePicker ? form.pickerCfg[form.activePicker] : null;

  const measurementsCount = [form.sizeJacket, form.measurementChest, form.measurementWaistM, form.measurementHips]
    .filter(Boolean).length + Object.values(details.sizeExtras).filter(Boolean).length;
  const sensitive = details.sensitiveFit;
  const privateCount = sensitive.proportions.length + sensitive.coverage.length + sensitive.comfort.length
    + (sensitive.notes ? 1 : 0);

  return (
    <EditScaffold
      title="Fit & Sizes"
      lede="Private, and only used to make fit-sensitive picks. Fill in as much or as little as you like."
      dirty={form.isDirty}
      saving={form.isSaving}
      onSave={save}
      overlay={activeCfg && (
        <ProfilePickerModal
          visible
          title={activeCfg.title}
          options={activeCfg.options}
          value={activeCfg.value}
          onSelect={activeCfg.onSelect}
          onClose={() => form.setActivePicker(null)}
        />
      )}
    >
      <Group title="Cut & shape">
        <GroupBlock>
          <View style={styles.field}>
            <FieldLabel>Department I shop</FieldLabel>
            <SingleChips options={FIT_PREFERENCE_OPTIONS} value={form.fitPreference} onChange={form.setFitPreference} />
          </View>
          <View style={styles.field}>
            <FieldLabel hint="up to 3">Proportions</FieldLabel>
            <OptionChips options={BODY_TYPE_OPTIONS} values={form.bodyType} onChange={form.setBodyType} max={3} />
          </View>
        </GroupBlock>
      </Group>

      <Group title="Sizes">
        <GroupBlock>
          <View style={styles.field}>
            <FieldLabel>Sizing region</FieldLabel>
            <SingleChips options={SIZING_REGION_OPTIONS} value={form.sizingRegion} onChange={form.setSizingRegion} />
          </View>
          <View style={styles.field}>
            <FieldLabel>Top</FieldLabel>
            <View style={styles.pillRow}>
              {TOP_SIZES.map((size) => {
                const selected = form.sizeTop === size;
                return (
                  <TouchableOpacity
                    key={size}
                    style={[styles.pill, selected && styles.pillSel]}
                    onPress={() => form.setSizeTop(selected ? '' : size)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.pillText, selected && styles.pillTextSel]}>{size}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <SelectRow label="Shoe" value={form.sizeShoe} placeholder="Select size" onPress={() => form.setActivePicker('shoe')} />
          <View style={styles.twoCol}>
            <View style={{ flex: 1 }}>
              <SelectRow label={`Waist (${unit})`} value={fmt(form.sizeBottomWaist)} placeholder="Waist" onPress={() => form.setActivePicker('waist')} />
            </View>
            <View style={styles.twoColDivider} />
            <View style={{ flex: 1 }}>
              <SelectRow label={`Inseam (${unit})`} value={fmt(form.sizeBottomInseam)} placeholder="Inseam" onPress={() => form.setActivePicker('inseam')} />
            </View>
          </View>
          {(form.fitPreference === 'feminine_cut' || form.showDressSize) ? (
            <View style={styles.field}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Dress</Text>
                {form.fitPreference !== 'feminine_cut' && (
                  <TouchableOpacity onPress={() => { form.setShowDressSize(false); form.setSizeDress(''); }}>
                    <Text style={styles.removeLink}>Remove</Text>
                  </TouchableOpacity>
                )}
              </View>
              <SelectRow label="" value={form.sizeDress} placeholder="Select dress size" onPress={() => form.setActivePicker('dress')} />
            </View>
          ) : (
            <TouchableOpacity style={styles.addLink} onPress={() => form.setShowDressSize(true)} activeOpacity={0.7}>
              <Ionicons name="add" size={14} color={colors.mutedForeground} />
              <Text style={styles.addLinkText}>Add dress size</Text>
            </TouchableOpacity>
          )}
          <View style={styles.field}>
            <FieldLabel>Height</FieldLabel>
            {form.sizingRegion === 'EU' ? (
              <SelectRow label="" value={form.measurementHeight} placeholder="Select height" onPress={() => form.setActivePicker('heightCm')} />
            ) : (
              <View style={styles.twoCol}>
                <View style={{ flex: 1 }}>
                  <SelectRow label="Feet" value={form.measurementHeightFt ? `${form.measurementHeightFt} ft` : ''} placeholder="Ft" onPress={() => form.setActivePicker('heightFt')} />
                </View>
                <View style={styles.twoColDivider} />
                <View style={{ flex: 1 }}>
                  <SelectRow label="Inches" value={form.measurementHeightIn !== '' ? `${form.measurementHeightIn} in` : ''} placeholder="In" onPress={() => form.setActivePicker('heightIn')} />
                </View>
              </View>
            )}
          </View>
        </GroupBlock>
      </Group>

      <FineTune title="Measurements & accessories" count={measurementsCount}>
        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <SelectRow label="Jacket / blazer" value={form.sizeJacket} placeholder="Size" onPress={() => form.setActivePicker('jacket')} />
          </View>
          {form.fitPreference !== 'feminine_cut' && (
            <>
              <View style={styles.twoColDivider} />
              <View style={{ flex: 1 }}>
                <SelectRow
                  label="Length"
                  value={JACKET_LENGTH_OPTIONS.find((option) => option.value === form.sizeJacketLength)?.label ?? ''}
                  placeholder="Length"
                  onPress={() => form.setActivePicker('jacketLen')}
                />
              </View>
            </>
          )}
        </View>
        <SelectRow label={`Chest (${unit})`} value={form.measurementChest} placeholder="Chest" onPress={() => form.setActivePicker('chest')} />
        <SelectRow label={`Waist measure (${unit})`} value={form.measurementWaistM} placeholder="Waist" onPress={() => form.setActivePicker('waistM')} />
        <SelectRow label={`Hips (${unit})`} value={form.measurementHips} placeholder="Hips" onPress={() => form.setActivePicker('hips')} />
        <View style={styles.sizeExtrasGrid}>
          {SIZE_EXTRAS.map(([key, label]) => (
            <View key={key} style={styles.sizeExtraField}>
              <Text style={styles.sizeExtraLabel}>{label}</Text>
              <TextInput
                style={styles.input}
                value={details.sizeExtras[key] ?? ''}
                onChangeText={(value) => setSizeExtra(key, value)}
                placeholder="Optional"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          ))}
        </View>
      </FineTune>

      <FineTune title="Private fit notes" count={privateCount}>
        <Text style={styles.hint}>Only your stylist sees these. Add just what you want it to consider.</Text>
        <OptionChips
          options={optionsForCut(SENSITIVE_PROPORTION_OPTIONS, form.fitPreference, sensitive.proportions)}
          values={sensitive.proportions}
          onChange={(values) => updateSensitive('proportions', values)}
        />
        <CustomProfileChips
          label="coverage preference"
          options={optionsForCut(COVERAGE_OPTIONS, form.fitPreference, sensitive.coverage)}
          values={sensitive.coverage}
          onChange={(values) => updateSensitive('coverage', values)}
        />
        <CustomProfileChips
          label="comfort preference"
          options={COMFORT_OPTIONS}
          values={sensitive.comfort}
          onChange={(values) => updateSensitive('comfort', values)}
        />
        <TextInput
          style={[styles.input, styles.textarea]}
          value={sensitive.notes ?? ''}
          onChangeText={(value) => form.updateStyleProfileDetails((current) => ({
            ...current,
            sensitiveFit: { ...current.sensitiveFit, notes: value },
          }))}
          placeholder="Private fit details your stylist should keep in mind…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={240}
        />
      </FineTune>
    </EditScaffold>
  );
}
