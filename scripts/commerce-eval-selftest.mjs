import assert from 'node:assert/strict';

import {
  evaluateProduct,
  evaluateTarget,
  fixtureProducts,
  normalizeProducts,
  parsePrice,
  summarizeEvaluation,
} from './lib/commerce-eval.mjs';

assert.equal(parsePrice('$129.99 CAD'), 129.99);
assert.equal(parsePrice({ amount: '88.00' }), 88);
assert.equal(parsePrice('not priced'), null);

const normalized = normalizeProducts({
  data: {
    products: [{
      product_id: 'p1',
      product_name: 'Olive linen overshirt',
      retailer: { name: 'Test Retailer' },
      product_url: 'https://example.test/p1',
      image_url: 'https://example.test/p1.jpg',
      currentPrice: { amount: 140, currency: 'CAD' },
    }],
  },
});
assert.equal(normalized.length, 1);
assert.equal(normalized[0].merchant, 'Test Retailer');
assert.equal(normalized[0].price, 140);
assert.equal(normalized[0].currency, 'CAD');

const target = {
  id: 'olive-overshirt',
  title: 'Olive overshirt',
  content: 'An olive linen overshirt.',
  currency: 'CAD',
  priceRange: { min: 80, max: 180 },
  expected: {
    termGroups: [['olive'], ['overshirt', 'shirt'], ['linen']],
    excludeTerms: ['kids'],
  },
};

const products = fixtureProducts(target);
const valid = evaluateProduct(products[0], target);
const invalid = evaluateProduct(products.at(-1), target);
assert.equal(valid.qualified, true);
assert.equal(invalid.qualified, false);

const targetResult = evaluateTarget(target, products);
assert.equal(targetResult.covered, true);
assert.equal(targetResult.qualifiedCount, 4);

const summary = summarizeEvaluation('fixture', [targetResult]);
assert.equal(summary.coverageRate, 1);
assert.equal(summary.totalQualified, 4);

process.stdout.write('Commerce evaluator self-test passed.\n');
