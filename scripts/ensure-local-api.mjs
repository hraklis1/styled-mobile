import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createConnection } from 'node:net';
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

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

async function isPortOccupied() {
  const port = Number(parsedApiUrl.port || 80);
  const host = parsedApiUrl.hostname === 'localhost' ? '127.0.0.1' : parsedApiUrl.hostname;

  // A listener can reserve the port while refusing connections. Prefer the
  // OS-level check on macOS (the local iOS development target), then fall
  // back to a TCP probe when lsof is unavailable.
  try {
    execFileSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { stdio: 'ignore' });
    return true;
  } catch (error) {
    if (error?.code !== 'ENOENT' && error?.status !== 1) return true;
  }

  return new Promise((resolvePromise) => {
    const socket = createConnection({ host, port });
    const finish = (occupied) => {
      socket.destroy();
      resolvePromise(occupied);
    };

    socket.setTimeout(500, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function waitForApi(deadline) {
  while (Date.now() < deadline) {
    if (await isApiReachable()) return true;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }
  return false;
}

if (await isApiReachable()) {
  console.log(`[local-api] API is already running at ${parsedApiUrl.origin}.`);
  process.exit(0);
}

const backendDir = resolve(process.env.STYLED_BACKEND_DIR ?? join(mobileDir, '..', 'Styled'));
const backendEntry = join(backendDir, 'server', 'index.ts');
const tsxCli = join(backendDir, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const logPath = `/tmp/styled-api-${parsedApiUrl.port || '80'}.log`;
const startupLockPath = `/tmp/styled-api-${parsedApiUrl.port || '80'}.startup.lock`;

try {
  readFileSync(backendEntry);
  readFileSync(tsxCli);
} catch {
  console.error(
    `[local-api] Backend not found at ${backendDir}. Set STYLED_BACKEND_DIR to its location.`
  );
  process.exit(1);
}

// `preios` can be invoked more than once while Expo is rebuilding. Without a
// lock, two callers can both observe a brief restart gap and launch separate
// `tsx watch` processes. The second process then dies with EADDRINUSE and can
// leave the API unavailable to the simulator.
let lockFd;
while (!lockFd) {
  try {
    lockFd = openSync(startupLockPath, 'wx');
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;

    let ownerPid = null;
    try {
      const lockContents = readFileSync(startupLockPath, 'utf8').trim();
      if (!lockContents) {
        // The creator has the file but has not written its PID yet.
        await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
        continue;
      }
      ownerPid = Number(lockContents);
    } catch {
      // The creator may still be between creating the file and writing its PID.
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
      continue;
    }

    if (isProcessAlive(ownerPid)) {
      console.log('[local-api] Another startup check is already launching the API; waiting for it.');
      if (await waitForApi(Date.now() + 30_000)) {
        console.log(`[local-api] Backend is ready. Logs: ${logPath}`);
        process.exit(0);
      }
      console.error(`[local-api] Another startup check owns ${startupLockPath}, but the API did not become ready. Check ${logPath}.`);
      process.exit(1);
    }

    // Recover a lock left by a launcher that exited before the backend started.
    try { unlinkSync(startupLockPath); } catch (unlinkError) {
      if (unlinkError?.code !== 'ENOENT') throw unlinkError;
    }
  }
}

const releaseLock = () => {
  try { closeSync(lockFd); } catch {}
  try { unlinkSync(startupLockPath); } catch (error) {
    if (error?.code !== 'ENOENT') console.warn(`[local-api] Could not remove ${startupLockPath}:`, error);
  }
};

// If something else already owns the port, wait for that process to finish
// its restart instead of starting a competing listener.
if (await isPortOccupied()) {
  writeSync(lockFd, `${process.pid}\n`);
  console.log(`[local-api] Port ${parsedApiUrl.port || '80'} is occupied but the API is not ready; waiting for the existing process.`);
  if (await waitForApi(Date.now() + 30_000)) {
    releaseLock();
    console.log(`[local-api] Backend is ready. Logs: ${logPath}`);
    process.exit(0);
  }
  releaseLock();
  console.error(`[local-api] Port ${parsedApiUrl.port || '80'} is occupied, but the API did not become ready. Check ${logPath}.`);
  process.exit(1);
}

console.log(`[local-api] Starting backend with source watching at ${parsedApiUrl.origin}...`);
const logFd = openSync(logPath, 'a');
const backend = spawn(process.execPath, ['--env-file=.env', tsxCli, 'watch', backendEntry], {
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
writeSync(lockFd, `${backend.pid}\n`);
backend.unref();
closeSync(logFd);

if (await waitForApi(Date.now() + 30_000)) {
  console.log(`[local-api] Backend is ready. Logs: ${logPath}`);
  process.exit(0);
}

releaseLock();
console.error(`[local-api] Backend did not become ready within 30 seconds. Check ${logPath}.`);
process.exit(1);
