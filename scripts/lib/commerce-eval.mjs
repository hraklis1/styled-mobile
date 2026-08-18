const PRODUCT_ARRAY_KEYS = ['products', 'items', 'results', 'recommendations', 'data'];

function asText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function firstText(...values) {
  for (const value of values) {
    const text = asText(value);
    if (text) return text;
  }
  return '';
}

function nestedText(value, ...keys) {
  if (!value || typeof value !== 'object') return '';
  return firstText(...keys.map((key) => value[key]));
}

function extractProductArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  for (const key of PRODUCT_ARRAY_KEYS) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = extractProductArray(value);
      if (nested.length) return nested;
    }
  }
  return [];
}

export function parsePrice(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value && typeof value === 'object') {
    return parsePrice(value.amount ?? value.value ?? value.current ?? value.sale);
  }
  if (typeof value !== 'string') return null;
  const normalized = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!normalized) return null;
  const parsed = Number(normalized[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeProduct(raw, index = 0) {
  const product = raw && typeof raw === 'object' ? raw : {};
  const merchantValue = product.merchant ?? product.retailer ?? product.store ?? product.source;
  const imageValue = product.image ?? product.thumbnail ?? product.media;
  const priceValue = product.price ?? product.currentPrice ?? product.salePrice ?? product.sale_price;

  const imageUrl = Array.isArray(imageValue)
    ? firstText(imageValue[0]?.url, imageValue[0]?.src, imageValue[0])
    : firstText(
        nestedText(imageValue, 'url', 'src', 'href'),
        product.imageUrl,
        product.image_url,
        product.thumbnailUrl,
        product.thumbnail_url,
      );

  const merchant = typeof merchantValue === 'object' && merchantValue !== null
    ? firstText(merchantValue.name, merchantValue.title, merchantValue.displayName)
    : asText(merchantValue);

  const currency = firstText(
    nestedText(priceValue, 'currency', 'currencyCode'),
    product.currency,
    product.currencyCode,
    product.currency_code,
  ).toUpperCase();

  return {
    id: firstText(product.id, product.productId, product.product_id, product.sku, `result-${index + 1}`),
    title: firstText(product.title, product.name, product.productName, product.product_name),
    description: firstText(product.description, product.summary, product.snippet),
    category: firstText(product.category, product.productType, product.product_type),
    brand: firstText(product.brand, product.manufacturer),
    merchant,
    url: firstText(
      product.affiliateUrl,
      product.affiliate_url,
      product.trackingUrl,
      product.tracking_url,
      product.clickUrl,
      product.click_url,
      product.url,
      product.link,
      product.productUrl,
      product.product_url,
    ),
    imageUrl,
    price: parsePrice(priceValue),
    currency,
    availability: firstText(product.availability, product.stockStatus, product.stock_status),
    raw: product,
  };
}

export function normalizeProducts(payload) {
  return extractProductArray(payload).map((product, index) => normalizeProduct(product, index));
}

function normalizedSearchText(product) {
  return [product.title, product.description, product.category, product.brand, product.merchant]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase();
}

function matchesAny(text, terms) {
  return terms.some((term) => text.includes(term.toLocaleLowerCase()));
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function evaluateProduct(product, target) {
  const text = normalizedSearchText(product);
  const termGroups = target.expected?.termGroups ?? [];
  const matchedGroups = termGroups.filter((group) => matchesAny(text, group)).length;
  const relevance = termGroups.length ? matchedGroups / termGroups.length : 1;
  const excluded = (target.expected?.excludeTerms ?? []).some((term) => text.includes(term.toLocaleLowerCase()));
  const min = target.priceRange?.min ?? 0;
  const max = target.priceRange?.max ?? Number.POSITIVE_INFINITY;
  const priceFit = product.price !== null && product.price >= min && product.price <= max;
  const expectedCurrency = target.currency?.toUpperCase() ?? '';
  const currencyFit = !product.currency || !expectedCurrency || product.currency === expectedCurrency;

  const fields = {
    title: Boolean(product.title),
    url: isHttpUrl(product.url),
    image: isHttpUrl(product.imageUrl),
    price: product.price !== null,
    merchant: Boolean(product.merchant),
    currency: Boolean(product.currency),
  };
  const completeness = (
    Number(fields.title) * 0.15
    + Number(fields.url) * 0.25
    + Number(fields.image) * 0.2
    + Number(fields.price) * 0.2
    + Number(fields.merchant) * 0.1
    + Number(fields.currency) * 0.1
  );

  const qualified = fields.title
    && fields.url
    && fields.image
    && priceFit
    && currencyFit
    && relevance >= 0.5
    && !excluded;

  return {
    product,
    fields,
    completeness,
    relevance,
    priceFit,
    currencyFit,
    excluded,
    qualified,
  };
}

export function evaluateTarget(target, products, minimumQualified = 3) {
  const evaluations = products.map((product) => evaluateProduct(product, target));
  const qualified = evaluations.filter((result) => result.qualified);
  const merchants = new Set(qualified.map((result) => result.product.merchant).filter(Boolean));
  const average = (values) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return {
    targetId: target.id,
    title: target.title,
    productCount: products.length,
    qualifiedCount: qualified.length,
    covered: qualified.length >= minimumQualified,
    merchantDiversity: merchants.size,
    averageCompleteness: average(evaluations.map((result) => result.completeness)),
    averageRelevance: average(evaluations.map((result) => result.relevance)),
    products: evaluations,
  };
}

export function summarizeEvaluation(provider, targetResults) {
  const count = targetResults.length;
  const covered = targetResults.filter((result) => result.covered).length;
  const totalProducts = targetResults.reduce((sum, result) => sum + result.productCount, 0);
  const totalQualified = targetResults.reduce((sum, result) => sum + result.qualifiedCount, 0);
  const average = (values) => values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;

  return {
    provider,
    targetCount: count,
    coveredTargetCount: covered,
    coverageRate: count ? covered / count : 0,
    totalProducts,
    totalQualified,
    qualifiedProductRate: totalProducts ? totalQualified / totalProducts : 0,
    averageCompleteness: average(targetResults.map((result) => result.averageCompleteness)),
    averageRelevance: average(targetResults.map((result) => result.averageRelevance)),
    averageMerchantDiversity: average(targetResults.map((result) => result.merchantDiversity)),
  };
}

function percentage(value) {
  return `${(value * 100).toFixed(1)}%`;
}

export function renderMarkdownReport(run) {
  const { summary } = run;
  const lines = [
    '# Commerce provider evaluation',
    '',
    `- Provider: ${summary.provider}`,
    `- Generated: ${run.generatedAt}`,
    `- Targets: ${summary.targetCount}`,
    `- Coverage: ${summary.coveredTargetCount}/${summary.targetCount} (${percentage(summary.coverageRate)})`,
    `- Qualified products: ${summary.totalQualified}/${summary.totalProducts} (${percentage(summary.qualifiedProductRate)})`,
    `- Average field completeness: ${percentage(summary.averageCompleteness)}`,
    `- Average lexical relevance: ${percentage(summary.averageRelevance)}`,
    `- Average qualified merchant diversity: ${summary.averageMerchantDiversity.toFixed(1)}`,
    '',
  ];
  if (summary.provider === 'fixture') {
    lines.push('> Fixture mode validates the harness only. It does not measure live catalog quality.', '');
  } else {
    lines.push('> Automated checks measure catalog coverage, not fashion judgment. Manually review the saved raw payloads.', '');
  }
  lines.push(
    '| Target | Products | Qualified | Covered | Merchants | Completeness | Relevance |',
    '|---|---:|---:|:---:|---:|---:|---:|',
  );

  for (const result of run.targets) {
    lines.push(`| ${result.title.replaceAll('|', '\\|')} | ${result.productCount} | ${result.qualifiedCount} | ${result.covered ? 'Yes' : 'No'} | ${result.merchantDiversity} | ${percentage(result.averageCompleteness)} | ${percentage(result.averageRelevance)} |`);
  }

  lines.push('', '## Uncovered targets', '');
  const uncovered = run.targets.filter((target) => !target.covered);
  if (!uncovered.length) lines.push('None.');
  else uncovered.forEach((target) => lines.push(`- ${target.title}: ${target.qualifiedCount} qualified of ${target.productCount}`));
  const errors = run.targets.filter((target) => target.error);
  if (errors.length) {
    lines.push('', '## Provider errors', '');
    errors.forEach((target) => lines.push(`- ${target.title}: ${target.error}`));
  }
  lines.push('');
  return lines.join('\n');
}

export function fixtureProducts(target) {
  const primaryTerms = (target.expected?.termGroups ?? []).map((group) => group[0]).filter(Boolean);
  const baseTitle = primaryTerms.join(' ');
  const span = Math.max(1, target.priceRange.max - target.priceRange.min);
  const valid = Array.from({ length: 4 }, (_, index) => ({
    id: `${target.id}-${index + 1}`,
    title: `${baseTitle} option ${index + 1}`,
    description: `Fixture catalog item matching ${baseTitle}.`,
    category: primaryTerms[1] ?? primaryTerms[0],
    brand: `Fixture Brand ${index + 1}`,
    merchant: `Fixture Merchant ${index + 1}`,
    url: `https://example.test/products/${target.id}-${index + 1}`,
    imageUrl: `https://images.example.test/${target.id}-${index + 1}.jpg`,
    price: Math.round(target.priceRange.min + span * ((index + 1) / 6)),
    currency: target.currency,
    availability: 'InStock',
  }));
  return [...valid, {
    id: `${target.id}-invalid`,
    title: 'Unrelated children costume',
    description: 'Deliberately invalid benchmark control',
    category: 'kids',
    brand: 'Fixture Brand',
    merchant: 'Fixture Merchant',
    url: '',
    imageUrl: '',
    price: target.priceRange.max * 2,
    currency: target.currency,
    availability: 'OutOfStock',
  }].map((product, index) => normalizeProduct(product, index));
}
