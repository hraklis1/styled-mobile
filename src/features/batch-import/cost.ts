/**
 * What a batch will cost before it starts. A scan is charged per photo, so a
 * full 10-photo batch is 40 credits — a free account's entire lifetime grant.
 * Better to say so at the picker than to fail on photo 6.
 */
export function batchCost(photoCount: number, costPerPhoto: number, balance: number | null) {
  const cost = photoCount * costPerPhoto;
  // Unknown balance or a free meter: never block on missing information.
  if (balance == null || costPerPhoto <= 0) {
    return { cost, affordable: photoCount, sufficient: true };
  }
  const affordable = Math.min(photoCount, Math.floor(balance / costPerPhoto));
  return { cost, affordable, sufficient: affordable >= photoCount };
}
