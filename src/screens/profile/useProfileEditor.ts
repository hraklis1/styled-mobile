import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useProfileForm } from '../../hooks/useProfileForm';
import { termKey } from '../../lib/customProfileTerms';
import type { CategoryBudgetKey } from '../../types/profile';
import type { DetailArrayKey, SensitiveArrayKey, SizeExtraKey } from '../../components/profile/fields';

function uniqueAppend(values: string[], value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return values;
  if (values.some((entry) => entry.toLowerCase() === trimmed.toLowerCase())) return values;
  return [...values, trimmed];
}

type ExclusiveKey = 'materialLikes' | 'materialAvoids' | 'patternLikes' | 'patternAvoids';

/**
 * useProfileForm plus the styleProfileDetails helpers every editor needed.
 * They used to live inline in the old single-scroll ProfileScreen. `save()`
 * returns to the Profile hub on success.
 */
export function useProfileEditor() {
  const form = useProfileForm();
  const navigation = useNavigation();
  const details = form.styleProfileDetails;

  const updateDetailArray = (key: DetailArrayKey, values: string[]) => {
    form.updateStyleProfileDetails((current) => ({ ...current, [key]: values }));
  };

  /** Setting a "like" removes the same term from its "avoid" twin, and vice versa. */
  const updateExclusive = (key: ExclusiveKey, opposite: ExclusiveKey, values: string[]) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      [key]: values,
      [opposite]: current[opposite].filter((entry) => !values.some((value) => termKey(value) === termKey(entry))),
    }));
  };

  const addDetailTag = (key: DetailArrayKey, value: string) => {
    updateDetailArray(key, uniqueAppend(details[key] ?? [], value));
  };

  const removeDetailTag = (key: DetailArrayKey, value: string) => {
    updateDetailArray(key, (details[key] ?? []).filter((entry) => entry !== value));
  };

  const updateSensitive = (key: SensitiveArrayKey, values: string[]) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      sensitiveFit: { ...current.sensitiveFit, [key]: values },
    }));
  };

  const setSizeExtra = (key: SizeExtraKey, value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      sizeExtras: { ...current.sizeExtras, [key]: value.trim() || null },
    }));
  };

  const setCategoryBudget = (key: CategoryBudgetKey, value: string) => {
    form.updateStyleProfileDetails((current) => ({
      ...current,
      categoryBudgets: { ...current.categoryBudgets, [key]: value || null },
    }));
  };

  // Leave only once the re-baselined form reports clean, so the scaffold's
  // unsaved-changes guard has already been removed.
  const [exitAfterSave, setExitAfterSave] = useState(false);
  useEffect(() => {
    if (exitAfterSave && !form.isDirty && navigation.canGoBack()) navigation.goBack();
  }, [exitAfterSave, form.isDirty, navigation]);

  const save = () => form.handleSave(() => setExitAfterSave(true));

  return {
    form,
    details,
    updateDetailArray,
    updateExclusive,
    addDetailTag,
    removeDetailTag,
    updateSensitive,
    setSizeExtra,
    setCategoryBudget,
    save,
  };
}
