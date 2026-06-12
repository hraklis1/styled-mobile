import { closeSync, openSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mobileDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

for (const envFile of ['.env', '.env.local']) {
  try {
    process.loadEnvFile(join(mobileDir, envFile));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL;
if (!apiUrl) {
  console.error('[local-api] EXPO_PUBLIC_API_URL is not configured.');
  process.exit(1);
}

const parsedApiUrl = new URL(apiUrl);
if (!['localhost', '127.0.0.1'].includes(parsedApiUrl.hostname)) {
  console.log(`[local-api] Using hosted API at ${parsedApiUrl.origin}.`);
  process.exit(0);
}

async function isApiReachable() {
  try {
    const response = await fetch(`${parsedApiUrl.origin}/api/profile`, {
      signal: AbortSignal.timeout(2_000),
    });
    return response.status > 0;
  } catch {
    return false;
  }
}

if (await isApiReachable()) {
  console.log(`[local-api] API is already running at ${parsedApiUrl.origin}.`);
  process.exit(0);
}

const backendDir = resolve(process.env.STYLED_BACKEND_DIR ?? join(mobileDir, '..', 'Styled'));
const backendEntry = join(backendDir, 'server', 'index.ts');
const tsxCli = join(backendDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const logPath = `/tmp/styled-api-${parsedApiUrl.port || '80'}.log`;

try {
  readFileSync(backendEntry);
  readFileSync(tsxCli);
} catch {
  console.error(
    `[local-api] Backend not found at ${backendDir}. Set STYLED_BACKEND_DIR to its location.`
  );
  process.exit(1);
}

console.log(`[local-api] Starting backend at ${parsedApiUrl.origin}...`);
const logFd = openSync(logPath, 'a');
const backend = spawn(process.execPath, ['--env-file=.env', tsxCli, backendEntry], {
  cwd: backendDir,
  detached: true,
  env: {
    ...process.env,
    NODE_ENV: 'development',
    PORT: parsedApiUrl.port || '80',
    APP_URL: parsedApiUrl.origin,
  },
  stdio: ['ignore', logFd, logFd],
});
backend.unref();
closeSync(logFd);

const deadline = Date.now() + 30_000;
while (Date.now() < deadline) {
  if (await isApiReachable()) {
    console.log(`[local-api] Backend is ready. Logs: ${logPath}`);
    process.exit(0);
  }
  await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
}

console.error(`[local-api] Backend did not become ready within 30 seconds. Check ${logPath}.`);
process.exit(1);
