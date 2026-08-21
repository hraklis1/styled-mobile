/**
 * Keep structured model output out of the stylist's human-facing copy.
 *
 * A stale stylist API response can contain a JSON object with a `response`
 * field appended to the normal preflight text. The structured fields still
 * render correctly, so the safest fallback is to keep the preflight prefix;
 * when the JSON is the whole response, use its human-readable response field.
 */
export function sanitizeStylistResponseText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const marker = /\{\s*"response"\s*:/i;
  const markerIndex = trimmed.search(marker);
  if (markerIndex < 0) return trimmed;

  const prefix = trimmed.slice(0, markerIndex).replace(/^```(?:json)?\s*/i, '').trim();
  const jsonCandidate = trimmed.slice(markerIndex);
  const parsed = parseJsonObject(jsonCandidate);

  if (parsed && typeof parsed.response === 'string' && parsed.response.trim()) {
    return prefix || parsed.response.trim();
  }

  // During streaming the JSON object may not be complete yet. Hide it rather
  // than briefly rendering implementation details in the chat.
  return prefix;
}

function parseJsonObject(value: string): { response?: unknown } | null {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(value.slice(0, index + 1));
          return parsed && typeof parsed === 'object' ? parsed as { response?: unknown } : null;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}
