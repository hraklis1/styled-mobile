/**
 * One-time migration: convert legacy 'spring_fall' season values to separate
 * 'spring' and 'fall' entries, and normalise any capitalised string variants.
 *
 * Run BEFORE deploying the updated frontend code:
 *   EXPO_PUBLIC_API_URL=http://localhost:3001 npx ts-node scripts/migrate-seasons.ts
 *
 * NOTE: If your app targets a physical device via a local IP (e.g. http://192.168.1.x:3001),
 * set EXPO_PUBLIC_API_URL to that same address when running this script, or run it
 * directly from the server machine.
 */

import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';

const LEGACY_MAP: Record<string, string[]> = {
  spring_fall:   ['spring', 'fall'],
  'Spring/Fall': ['spring', 'fall'],
  Summer:        ['summer'],
  Winter:        ['winter'],
  Spring:        ['spring'],
  Fall:          ['fall'],
};

async function migrate() {
  console.log(`Connecting to ${API_URL}...`);
  const { data: items } = await axios.get(`${API_URL}/api/items`);
  console.log(`Fetched ${items.length} item(s).`);

  let patched = 0;

  for (const item of items) {
    const oldSeasons: string[] = item.seasons ?? [];
    const newSeasons = Array.from(
      new Set(oldSeasons.flatMap((s: string) => LEGACY_MAP[s] ?? [s]))
    );

    const changed =
      newSeasons.length !== oldSeasons.length ||
      newSeasons.some((s: string, i: number) => s !== oldSeasons[i]);

    if (changed) {
      await axios.patch(`${API_URL}/api/items/${item.id}`, { seasons: newSeasons });
      console.log(`  Patched ${item.id}: ${JSON.stringify(oldSeasons)} → ${JSON.stringify(newSeasons)}`);
      patched++;
    }
  }

  console.log(`\nDone. Patched ${patched} / ${items.length} item(s).`);
}

migrate().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
