import { profileOptionsWithCustom, resolveProfileTerm, termKey } from '../customProfileTerms';
import { MATERIAL_OPTIONS, normalizeStyleProfileDetails } from '../profileOptions';

test('typed preset labels reuse stored ids and custom labels keep their spelling', () => {
  expect(resolveProfileTerm('  TECHNICAL FABRICS ', MATERIAL_OPTIONS)).toBe('technical');
  expect(resolveProfileTerm('  Fine   merino ', MATERIAL_OPTIONS)).toBe('Fine merino');
  expect(termKey(' Fine MERINO ')).toBe(termKey('fine merino'));
});
test('saved custom terms remain visible alongside presets', () => {
  const options = profileOptionsWithCustom(MATERIAL_OPTIONS, ['cotton', 'Merino']);
  expect(options.filter((option) => option.value === 'cotton')).toHaveLength(1);
  expect(options.find((option) => option.value === 'Merino')?.label).toBe('Merino');
});
test('case and whitespace cannot leave the same custom material liked and avoided', () => {
  const details = normalizeStyleProfileDetails({ materialLikes: ['Fine merino', 'cotton'], materialAvoids: [' fine   MERINO '] });
  expect(details.materialLikes).toEqual(['cotton']);
});
test('legacy details default safely and invalid occasion categories are discarded', () => {
  expect(normalizeStyleProfileDetails({}).customOccasionCategories).toEqual({});
  expect(normalizeStyleProfileDetails({ customOccasionCategories: {
    'Gallery openings': 'smart_casual', Unknown: 'not-a-category',
  } }).customOccasionCategories).toEqual({ 'Gallery openings': 'smart_casual' });
});
