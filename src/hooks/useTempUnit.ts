import { useProfile } from './useProfile';
import { resolveTempUnit, type ResolvedTempUnit } from '../lib/temperature';

/**
 * The temperature unit to display in: the explicit preference when the user set
 * one, otherwise inferred from their Home location.
 */
export function useTempUnit(): ResolvedTempUnit {
  const { data: profile } = useProfile();
  return resolveTempUnit(profile?.tempUnit, profile?.location);
}
