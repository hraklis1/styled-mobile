---
status: resolved
trigger: "Styled crashes on startup"
created: 2026-08-18
goal: find_and_fix
---

# Startup Crash

## Symptoms

- App reportedly crashes on startup.
- Reproduction target: `npm run ios` per project instructions.

## Current Focus

- hypothesis: Confirmed — the iOS development launch reused an 11-day-old Metro/inspector session, leaving stale Hermes debugger state; Expo Modules event delivery then entered invalid debugger source-location state and dereferenced null.
- next_action: Resolved for local startup; separately plan Expo 57.0.9+ upgrade to eliminate the SDK 56 Hermes V1 memory regression flagged by Expo Doctor.

## Evidence

- timestamp: 2026-08-18T00:00:00-04:00
  observation: No pre-existing `.planning/debug` session artifact was present; working tree contains substantial unrelated user edits.
- timestamp: 2026-08-18T10:12:14-04:00
  observation: `npm run ios` built and installed successfully, but launch produced `Styled-2026-08-18-101217.ips`; SIGSEGV / EXC_BAD_ACCESS at address 0 on the JavaScript thread.
- timestamp: 2026-08-18T10:12:17-04:00
  observation: Two crash reports have the same fault stack: `hermes::vm::CodeBlock::getSourceLocation` -> `Debugger::runUntilValidPauseLocation` -> Expo `EventEmitter` / `SharedObject.emit`; no application JavaScript frame is implicated.
- timestamp: 2026-08-18T10:16:57-04:00
  observation: Existing Metro PID 28185 started 2026-08-06 and had been alive more than 11 days; the current Styled process relaunched at 10:14 and survived, pointing to stale development server/debugger state rather than deterministic application startup code.
- timestamp: 2026-08-18T10:13:00-04:00
  observation: Expo Doctor flags affected Hermes V1 `250829098.0.10` in Expo 56 / RN 0.85 and recommends Expo 57.0.9+ for the broader memory regression; this raises upgrade priority but does not match the observed null debugger dereference closely enough to justify a major SDK upgrade as the immediate fix.
- timestamp: 2026-08-18T10:20:02-04:00
  observation: After replacing Metro with `npm start -- --clear`, `npm run ios` built, installed, bundled 2,850 modules, and launched Styled PID 7789. The app remained alive for 86 seconds (well beyond the prior 7-second failure) with live Metro connections and no new Styled crash report.

## Resolution

- root_cause: The development client reused an 11-day-old Metro/inspector session whose stale Hermes debugger state crashed while handling an Expo Modules shared-object event.
- fix: Stopped stale Metro PID 28185 and started a fresh cache-cleared Metro session; no application source change was necessary.
- verification: `npm run ios` succeeded; fresh Metro bundled 2,850 modules; Styled remained alive beyond the previous failure window with no new `.ips` report.
