# Onboarding imagery — sources and licences

Every image in this directory is bundled with the app and shipped to users, so
each one is recorded here with enough detail to re-verify its licence without
having to find it again.

## Selection rules

1. **No identifiable people.** Neither the Pexels nor the Unsplash licence
   warrants that a model release exists, so a free-for-commercial-use photo of a
   person is still a liability in a shipping app. Every image here is a garment,
   a textile or a rack — nothing that needs a release.
2. **No trademarks or visible brand marks.** The Pexels licence explicitly
   forbids implying endorsement.
3. **Warm neutral palette**, so the photography sits against the app's ivory
   (`#FBFAF7`) and taupe (`#6F5948`) rather than fighting it.

## Files

| File | Source | Photographer | Licence | Retrieved |
|---|---|---|---|---|
| `welcome-wardrobe.jpg` | https://www.pexels.com/photo/close-up-of-a-clothing-rack-8989864/ | A. Darmel | [Pexels License](https://www.pexels.com/license/) | 2026-08-06 |
| `welcome-scan.jpg` | https://www.pexels.com/photo/close-up-of-bent-linen-11125918/ | Qiana Zhang | [Pexels License](https://www.pexels.com/license/) | 2026-08-06 |
| `welcome-stylist.jpg` | https://www.pexels.com/photo/white-blazer-hanging-on-black-metal-rack-7671167/ | Ivan S | [Pexels License](https://www.pexels.com/license/) | 2026-08-06 |
| `profile-hero.jpg` | https://www.pexels.com/photo/photo-of-brown-textile-4862928/ | Karola G | [Pexels License](https://www.pexels.com/license/) | 2026-08-06 |

All four were downscaled to 1000px on the long edge and re-encoded at quality 72
on the way in. Total bundled weight: ~450 KB.

## Pexels License, in short

Free for commercial use, no attribution required (recorded here anyway).
Modification is allowed. The restrictions that actually bear on this app:

- Identifiable people must not appear in a bad light — moot here, there are none.
- Images must not be used as part of a trademark, trade name or service mark, so
  none of these may be used in the app icon, the wordmark, or store artwork.
- Unmodified copies must not be resold or redistributed as stock.

## Adding to this directory

Record the row above **before** the image is committed, and re-check the
selection rules. JPEG, not WebP: `cwebp` is not installed on the build machine
and macOS `sips` cannot encode WebP, so a WebP here would have to be produced
by hand and would silently rot.

## Newsreader typeface

The app's editorial typeface is [Newsreader](https://github.com/productiontype/Newsreader),
designed by Production Type and distributed under the [SIL Open Font License,
Version 1.1](https://scripts.sil.org/OFL). It is bundled through
`@expo-google-fonts/newsreader`; the package's complete font license is also
kept in `assets/fonts/NEWSREADER-LICENSE.txt`.
