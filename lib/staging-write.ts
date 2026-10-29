/**
 * Explicitly gate sensitive admin writes by deployment environment and Supabase project.
 * Localhost / Vercel previews connected to production must NEVER write production data.
 * Production writes still require the existing authenticated role checks in each route
 * and in Supabase RLS / Edge Functions. This is an additional release safety switch.
 */
const LIVE_PROJECT_REF = 'oshehhznsrbumiguvhbf';

export function stagingWriteError(): string | null {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!rawUrl) return 'Supabase project URL is not configured.';

  let host: string;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return 'Supabase must use HTTPS.';
    host = url.hostname.toLowerCase();
  } catch {
    return 'Invalid Supabase project URL.';
  }

  if (host === `${LIVE_PROJECT_REF}.supabase.co`) {
    // The production switch has no effect on localhost, previews or another project.
    return process.env.VERCEL_ENV === 'production' &&
      process.env.WORKMATE_PRODUCTION_WRITES_ENABLED === 'true'
      ? null
      : 'Production writes are disabled here. Use the reviewed Vercel production deployment with its explicit release flag.';
  }

  const stagingRef = process.env.WORKMATE_STAGING_PROJECT_REF?.trim();
  const isValidStagingRef = !!stagingRef && /^[a-z0-9]{15,30}$/.test(stagingRef) && stagingRef !== LIVE_PROJECT_REF;
  if (process.env.WORKMATE_STAGING_WRITE_ENABLED === 'true' &&
      isValidStagingRef && host === `${stagingRef}.supabase.co`) {
    return null;
  }

  return 'Writes are disabled. Configure a separate staging Supabase project or release the reviewed production deployment.';
}
