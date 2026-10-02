import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { EditScaffold, FineTune, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { FieldLabel, OptionChips, PalettePicker, SingleChips, TextTagInput, styles } from '../../components/profile/fields';
import { COLOR_CONTRAST_OPTIONS, COLOR_UNDERTONE_OPTIONS, METAL_OPTIONS } from '../../lib/profileOptions';
import { useProfileEditor } from './useProfileEditor';

export function EditColorScreen() {
  const { form, details, addDetailTag, removeDetailTag, save } = useProfileEditor();
  const [newFavorite, setNewFavorite] = useState('');
  const [newAvoided, setNewAvoided] = useState('');
  const analysis = details.colorAnalysis;
  const analysisCount = (analysis.undertone ? 1 : 0) + (analysis.contrast ? 1 : 0) + analysis.metalPreference.length;

  const setAnalysis = (key: 'undertone' | 'contrast', value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      colorAnalysis: { ...current.colorAnalysis, [key]: value || null },
    }));
  };

  return (
    <EditScaffold
      title="Color"
      lede="Palettes guide every look. Specific colors sharpen it."
      dirty={form.isDirty}
      saving={form.isSaving}
      onSave={save}
    >
      <Group title="Palette">
        <GroupBlock>
          <PalettePicker values={form.colorPalette} onChange={form.setColorPalette} />
        </GroupBlock>
      </Group>

      <Group title="Specific colors" footer="Avoided colors are filtered out of shopping results, not just mentioned to your stylist.">
        <GroupBlock>
          <TextTagInput
            label="Colors I love"
            placeholder="e.g. oxblood"
            value={newFavorite}
            onChangeText={setNewFavorite}
            tags={details.favoriteColors}
            onAdd={(value) => { addDetailTag('favoriteColors', value); setNewFavorite(''); }}
            onRemove={(value) => removeDetailTag('favoriteColors', value)}
          />
          <TextTagInput
            label="Colors to avoid"
            placeholder="e.g. neon yellow"
            value={newAvoided}
            onChangeText={setNewAvoided}
            tags={details.avoidedColors}
            onAdd={(value) => { addDetailTag('avoidedColors', value); setNewAvoided(''); }}
            onRemove={(value) => removeDetailTag('avoidedColors', value)}
          />
        </GroupBlock>
      </Group>

      <FineTune title="Color analysis" count={analysisCount}>
        <Text style={styles.hint}>Optional signals for jewelry, contrast, and color temperature.</Text>
        <View style={styles.chipSubgroup}>
          <Text style={styles.chipSubgroupLabel}>Temperature</Text>
          <SingleChips options={COLOR_UNDERTONE_OPTIONS} value={analysis.undertone ?? ''} onChange={(value) => setAnalysis('undertone', value)} />
        </View>
        <View style={styles.chipSubgroup}>
          <Text style={styles.chipSubgroupLabel}>Contrast</Text>
          <SingleChips options={COLOR_CONTRAST_OPTIONS} value={analysis.contrast ?? ''} onChange={(value) => setAnalysis('contrast', value)} />
        </View>
        <View style={styles.chipSubgroup}>
          <FieldLabel>Metals</FieldLabel>
          <OptionChips
            options={METAL_OPTIONS}
            values={analysis.metalPreference}
            onChange={(values) => form.updateStyleProfileDetails((current) => ({
              ...current,
              colorAnalysis: { ...current.colorAnalysis, metalPreference: values },
            }))}
          />
        </View>
      </FineTune>
    </EditScaffold>
  );
}
