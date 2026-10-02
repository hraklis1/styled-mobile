import React, { useState } from 'react';
import { View } from 'react-native';
import { EditScaffold, FineTune, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { FieldLabel, SingleChips, TextTagInput, styles } from '../../components/profile/fields';
import { CustomProfileChips } from '../../components/profile/CustomProfileChips';
import { FIT_SILHOUETTE_OPTIONS, MATERIAL_OPTIONS, PATTERN_OPTIONS, STYLE_OPTIONS, normalizeStylePreference } from '../../lib/profileOptions';
import { useProfileEditor } from './useProfileEditor';

export function EditStyleScreen() {
  const { form, details, updateExclusive, addDetailTag, removeDetailTag, save } = useProfileEditor();
  const [newStyleAvoid, setNewStyleAvoid] = useState('');
  const fineTuneCount = details.materialLikes.length + details.materialAvoids.length
    + details.patternLikes.length + details.patternAvoids.length;

  return (
    <EditScaffold
      title="Style"
      lede="The aesthetic your stylist dresses you toward — and what it should steer clear of."
      dirty={form.isDirty}
      saving={form.isSaving}
      onSave={save}
    >
      <Group title="Aesthetic">
        <GroupBlock>
          <View style={styles.field}>
            <FieldLabel hint="up to 4">Words that describe your style</FieldLabel>
            <CustomProfileChips
              label="aesthetic"
              normalizeTerm={(value) => normalizeStylePreference([value])[0] ?? ''}
              maxLength={30}
              options={STYLE_OPTIONS}
              values={form.stylePreference}
              onChange={form.setStylePreference}
              max={4}
            />
          </View>
          <View style={styles.field}>
            <FieldLabel>Silhouette</FieldLabel>
            <SingleChips options={FIT_SILHOUETTE_OPTIONS} value={form.fitSilhouette} onChange={form.setFitSilhouette} />
          </View>
        </GroupBlock>
      </Group>

      <Group title="Never suggest" footer="Hard limits. Your stylist leaves these out, and shopping results that name them are filtered.">
        <GroupBlock>
          <TextTagInput
            label="Styles to avoid"
            placeholder="e.g. boxy cropped jackets"
            value={newStyleAvoid}
            onChangeText={setNewStyleAvoid}
            tags={details.styleAvoids}
            onAdd={(value) => { addDetailTag('styleAvoids', value); setNewStyleAvoid(''); }}
            onRemove={(value) => removeDetailTag('styleAvoids', value)}
          />
        </GroupBlock>
      </Group>

      <FineTune title="Materials & patterns" count={fineTuneCount}>
        <View style={styles.field}>
          <FieldLabel>Materials to seek</FieldLabel>
          <CustomProfileChips label="material" options={MATERIAL_OPTIONS} values={details.materialLikes}
            onChange={(values) => updateExclusive('materialLikes', 'materialAvoids', values)} />
        </View>
        <View style={styles.field}>
          <FieldLabel>Materials to avoid</FieldLabel>
          <CustomProfileChips label="material" options={MATERIAL_OPTIONS} values={details.materialAvoids}
            onChange={(values) => updateExclusive('materialAvoids', 'materialLikes', values)} />
        </View>
        <View style={styles.field}>
          <FieldLabel>Patterns I like</FieldLabel>
          <CustomProfileChips label="pattern" options={PATTERN_OPTIONS} values={details.patternLikes}
            onChange={(values) => updateExclusive('patternLikes', 'patternAvoids', values)} />
        </View>
        <View style={styles.field}>
          <FieldLabel>Patterns to avoid</FieldLabel>
          <CustomProfileChips label="pattern" options={PATTERN_OPTIONS} values={details.patternAvoids}
            onChange={(values) => updateExclusive('patternAvoids', 'patternLikes', values)} />
        </View>
      </FineTune>
    </EditScaffold>
  );
}
