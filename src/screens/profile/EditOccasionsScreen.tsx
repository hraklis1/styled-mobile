import React from 'react';
import { View, Text, TextInput } from 'react-native';
import { EditScaffold, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { FieldLabel, styles } from '../../components/profile/fields';
import { CustomProfileChips } from '../../components/profile/CustomProfileChips';
import { OCCASION_OPTIONS, normalizeOccasions } from '../../lib/profileOptions';
import { colors } from '../../theme';
import { useProfileEditor } from './useProfileEditor';

export function EditOccasionsScreen() {
  const { form, save } = useProfileEditor();

  return (
    <EditScaffold
      title="Your Life"
      lede="Where you actually go shapes what Today's Look and your stylist reach for."
      dirty={form.isDirty}
      saving={form.isSaving}
      onSave={save}
    >
      <Group title="Occasions">
        <GroupBlock>
          <CustomProfileChips
            label="occasion"
            normalizeTerm={(value) => normalizeOccasions([value])[0] ?? ''}
            occasionCategories={form.styleProfileDetails.customOccasionCategories}
            onAddOccasion={(value, category) => {
              form.setOccasions([...form.occasions, value]);
              form.updateStyleProfileDetails((current) => ({
                ...current,
                customOccasionCategories: { ...current.customOccasionCategories, [value]: category },
              }));
            }}
            options={OCCASION_OPTIONS}
            values={form.occasions}
            onChange={(values) => {
              form.setOccasions(values);
              form.updateStyleProfileDetails((current) => ({
                ...current,
                customOccasionCategories: Object.fromEntries(Object.entries(current.customOccasionCategories ?? {})
                  .filter(([label]) => values.includes(label))),
              }));
            }}
          />
        </GroupBlock>
      </Group>

      <Group title="Notes for your stylist">
        <GroupBlock>
          <View style={styles.field}>
            <FieldLabel>Anything else</FieldLabel>
            <TextInput
              style={[styles.input, styles.textarea]}
              value={form.fitNotes}
              onChangeText={form.setFitNotes}
              placeholder="A dress code at work, a uniform you love, a rule you live by…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              maxLength={200}
            />
            <Text style={styles.hint}>{form.fitNotes.length}/200</Text>
          </View>
        </GroupBlock>
      </Group>
    </EditScaffold>
  );
}
