import type { ProfileOption } from './profileOptions';

export function termKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** Reuse a preset's stored value when someone types its visible label. */
export function resolveProfileTerm(text: string, options: readonly ProfileOption[]): string {
  const key = termKey(text);
  return options.find((option) => termKey(option.value) === key || termKey(option.label) === key)?.value
    ?? text.trim().replace(/\s+/g, ' ');
}

export function profileOptionsWithCustom(options: readonly ProfileOption[], values: readonly string[]): ProfileOption[] {
  return [...options, ...values.filter((value) => !options.some((option) => option.value === value))
    .map((value) => ({ value, label: value }))];
}
