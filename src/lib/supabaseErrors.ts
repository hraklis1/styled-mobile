type SupabaseErrorLike = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
};

export function isSupabaseSchemaMissing(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as SupabaseErrorLike;
  const code = candidate.code ?? '';
  const message = candidate.message ?? '';
  return code === '42P01'
    || code === '42703'
    || code === 'PGRST204'
    || message.includes('shopping_store_locations')
    || message.includes('store_location_id');
}

export function describeSyncError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (!error || typeof error !== 'object') return String(error);
  const candidate = error as SupabaseErrorLike;
  return [
    candidate.code,
    candidate.message,
    candidate.details,
    candidate.hint,
  ].filter(Boolean).join(' | ') || JSON.stringify(error);
}
