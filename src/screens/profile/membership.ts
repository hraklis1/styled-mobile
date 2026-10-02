export function planTierLabel(tier: string | null | undefined): string {
  if (tier === 'premium') return 'Premium';
  if (tier === 'beta') return 'Beta Tester';
  return 'Free';
}
