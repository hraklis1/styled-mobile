# Commerce provider benchmark

This benchmark answers one question before product-catalog code reaches the app:

> Can a provider consistently return at least three real, relevant, Canadian-market products for Styled's shopping targets?

The first version contains 24 anonymized targets spanning categories, genders, price bands, occasions, fit constraints, and care constraints. It intentionally includes difficult requests such as wide footwear, petite/tall trousers, and machine-washable workwear.

## Run the harness

Fixture mode validates normalization, scoring, and reporting without network access:

```sh
npm run eval:commerce
```

The generated report is written to `eval/commerce/results/latest.md`. Results are ignored by git because they can contain raw provider payloads.

Run the live Sovrn benchmark after creating a Sovrn Commerce site/app and obtaining its site API key:

Add the key to the ignored local environment file:

```sh
SOVRN_COMMERCE_API_KEY=...
```

Then run:

```sh
npm run eval:commerce:sovrn
```

Do not use an `EXPO_PUBLIC_` variable for the key. The live integration belongs on the server; this local evaluator reads the private key only from the process environment.

## Initial pass criteria

- Coverage: at least 80% of targets return three qualified products.
- Product completeness: at least 95% include title, product URL, image, price, merchant, and currency.
- Qualified-product rate: at least 50% of returned candidates pass the automated checks.
- Merchant diversity: at least two qualified merchants per covered target on average.
- Manual review: no invented destinations, obviously wrong categories, children's products, or materially misleading prices.

Automated relevance is intentionally conservative and lexical. Passing it does not prove fashion quality. After a live run, a human should review the raw products for silhouette, color, material, size availability, image quality, and whether the item genuinely extends the example wardrobe.

## Adding another provider

Add a provider fetcher to `scripts/eval-commerce-provider.mjs` and normalize its response through `normalizeProducts`. Keep raw responses in the generated results so field mappings can be audited. Provider-specific ranking must not be treated as Styled's final ranking.

The benchmark is safe to expand with anonymized or synthetic targets. Never include a real user's name, raw wardrobe images, event titles, exact address, or unbounded profile data.
