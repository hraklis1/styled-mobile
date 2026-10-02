import React, { useState } from 'react';
import { View } from 'react-native';
import { EditScaffold, FineTune, Group, GroupBlock } from '../../components/profile/SettingsUI';
import { BrandTagInput, CategoryBudgets, FieldLabel, OptionChips, styles } from '../../components/profile/fields';
import { CustomProfileChips } from '../../components/profile/CustomProfileChips';
import { BUDGET_OPTIONS, CARE_CONSTRAINT_OPTIONS, SHOPPING_PRIORITY_OPTIONS } from '../../lib/profileOptions';
import { useProfileEditor } from './useProfileEditor';

export function EditShoppingScreen() {
  const { form, details, updateDetailArray, addDetailTag, removeDetailTag, setCategoryBudget, save } = useProfileEditor();
  const [newBrandAvoid, setNewBrandAvoid] = useState('');
  const fineTuneCount = Object.values(details.categoryBudgets).filter(Boolean).length + details.careConstraints.length;

  return (
    <EditScaffold
      title="Shopping"
      lede="Sets the price range, stores and brands for every shopping suggestion."
      dirty={form.isDirty}
      saving={form.isSaving}
      onSave={save}
    >
      <Group title="Budget" footer="Used as the price range when a suggestion doesn't name its own.">
        <GroupBlock>
          <OptionChips options={BUDGET_OPTIONS} values={form.budgetRange} onChange={form.setBudgetRange} />
        </GroupBlock>
      </Group>

      <Group title="Brands" footer="Favorites are searched first. Avoided brands never appear.">
        <GroupBlock>
          <BrandTagInput
            label="Favorite brands and shops"
            placeholder="e.g. Toteme"
            value={form.newRetailer}
            onChangeText={form.setNewRetailer}
            tags={form.retailers}
            onAdd={form.addRetailer}
            onRemove={form.removeRetailer}
          />
          <BrandTagInput
            label="Brands to avoid"
            placeholder="A brand you never want to see"
            value={newBrandAvoid}
            onChangeText={setNewBrandAvoid}
            tags={details.brandAvoids}
            onAdd={(value) => { addDetailTag('brandAvoids', value); setNewBrandAvoid(''); }}
            onRemove={(value) => removeDetailTag('brandAvoids', value)}
          />
        </GroupBlock>
      </Group>

      <Group title="What matters">
        <GroupBlock>
          <View style={styles.field}>
            <FieldLabel>Shopping priorities</FieldLabel>
            <CustomProfileChips
              label="shopping priority"
              options={SHOPPING_PRIORITY_OPTIONS}
              values={details.shoppingPriorities}
              onChange={(values) => updateDetailArray('shoppingPriorities', values)}
            />
          </View>
        </GroupBlock>
      </Group>

      <FineTune title="Category budgets & care" count={fineTuneCount}>
        <View style={styles.field}>
          <FieldLabel>Per-category budget</FieldLabel>
          <CategoryBudgets budgets={details.categoryBudgets} onChange={setCategoryBudget} />
        </View>
        <View style={styles.field}>
          <FieldLabel>Care constraints</FieldLabel>
          <CustomProfileChips
            label="care constraint"
            options={CARE_CONSTRAINT_OPTIONS}
            values={details.careConstraints}
            onChange={(values) => updateDetailArray('careConstraints', values)}
          />
        </View>
      </FineTune>
    </EditScaffold>
  );
}
