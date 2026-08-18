#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import {
  evaluateTarget,
  fixtureProducts,
  normalizeProducts,
  renderMarkdownReport,
  summarizeEvaluation,
} from './lib/commerce-eval.mjs';

const ROOT = process.cwd();
const DEFAULT_TARGETS = path.join(ROOT, 'eval/commerce/targets.json');
const DEFAULT_OUTPUT = path.join(ROOT, 'eval/commerce/results');

function parseArgs(argv) {
  const args = { provider: 'fixture', targets: DEFAULT_TARGETS, output: DEFAULT_OUTPUT, limit: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--provider') args.provider = argv[++index];
    else if (arg === '--targets') args.targets = path.resolve(argv[++index]);
    else if (arg === '--output') args.output = path.resolve(argv[++index]);
    else if (arg === '--limit') args.limit = Number(argv[++index]);
    else if (arg === '--help' || arg === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(`Commerce provider evaluation\n\nUsage:\n  node scripts/eval-commerce-provider.mjs --provider fixture\n  SOVRN_COMMERCE_API_KEY=... node scripts/eval-commerce-provider.mjs --provider sovrn\n\nOptions:\n  --provider fixture|sovrn\n  --targets <file>\n  --output <directory>\n  --limit <count>\n`);
}

function sovrnUrl(target, apiKey) {
  const url = new URL('https://shopping-gallery.prd-commerce.sovrnservices.com/ai-orchestration/products');
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('market', target.market);
  url.searchParams.set('priceRange', `${target.priceRange.min}-${target.priceRange.max}`);
  url.searchParams.set('numProducts', '12');
  url.searchParams.set('pageUrl', `styled-commerce-eval-v1-${target.id}`);
  return url;
}

async function fetchSovrnProducts(target) {
  const apiKey = process.env.SOVRN_COMMERCE_API_KEY?.trim();
  if (!apiKey) throw new Error('Missing SOVRN_COMMERCE_API_KEY. See eval/commerce/README.md.');

  const response = await fetch(sovrnUrl(target, apiKey), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ title: target.title, content: target.content }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    const responseText = await response.text().catch(() => '');
    const safeDetails = responseText
      .replaceAll(apiKey, '[redacted]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
    throw new Error(
      `Sovrn request failed with HTTP ${response.status}${safeDetails ? `: ${safeDetails}` : ''}`,
    );
  }
  const payload = await response.json();
  return { payload, products: normalizeProducts(payload) };
}

async function productsFor(provider, target) {
  if (provider === 'fixture') return { payload: null, products: fixtureProducts(target) };
  if (provider === 'sovrn') return fetchSovrnProducts(target);
  throw new Error(`Unsupported provider: ${provider}`);
}

function serializableTargetResult(result) {
  return {
    ...result,
    products: result.products.map((evaluation) => ({
      ...evaluation,
      product: { ...evaluation.product, raw: undefined },
    })),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (!['fixture', 'sovrn'].includes(args.provider)) throw new Error(`Unsupported provider: ${args.provider}`);
  if (args.provider === 'sovrn' && !process.env.SOVRN_COMMERCE_API_KEY?.trim()) {
    throw new Error('Missing SOVRN_COMMERCE_API_KEY. See eval/commerce/README.md.');
  }

  const targetFile = JSON.parse(await readFile(args.targets, 'utf8'));
  const allTargets = targetFile.targets;
  if (!Array.isArray(allTargets) || !allTargets.length) throw new Error('Target file has no targets');
  const targets = Number.isFinite(args.limit) && args.limit > 0 ? allTargets.slice(0, args.limit) : allTargets;
  const targetResults = [];
  const rawPayloads = {};

  for (const [index, target] of targets.entries()) {
    process.stdout.write(`[${index + 1}/${targets.length}] ${target.title}\n`);
    try {
      const { payload, products } = await productsFor(args.provider, target);
      if (payload) rawPayloads[target.id] = payload;
      targetResults.push(evaluateTarget(target, products));
    } catch (error) {
      targetResults.push({
        ...evaluateTarget(target, []),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const generatedAt = new Date().toISOString();
  const run = {
    benchmarkVersion: targetFile.version,
    generatedAt,
    summary: summarizeEvaluation(args.provider, targetResults),
    targets: targetResults.map(serializableTargetResult),
  };
  await mkdir(args.output, { recursive: true });
  await writeFile(path.join(args.output, 'latest.json'), `${JSON.stringify(run, null, 2)}\n`);
  await writeFile(path.join(args.output, 'latest.md'), renderMarkdownReport(run));
  if (Object.keys(rawPayloads).length) {
    await writeFile(path.join(args.output, 'latest-raw.json'), `${JSON.stringify(rawPayloads, null, 2)}\n`);
  }

  process.stdout.write(`\n${renderMarkdownReport(run)}\n`);
  if (args.provider !== 'fixture' && run.summary.coverageRate < 0.8) process.exitCode = 2;
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
