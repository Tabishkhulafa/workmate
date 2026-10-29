import { NextResponse } from 'next/server';
import { requireProfile } from '@/lib/access';

export const dynamic = 'force-dynamic';

const noStore = { 'Cache-Control': 'private, no-store' };

// Active, geofencable office locations. Never reveal unrestricted staff data.
export async function GET() {
  try {
    const { supabase } = await requireProfile();
    const { data, error } = await supabase
      .from('office_locations')
      .select('id,name,address,latitude,longitude,allowed_radius_meters,is_default')
      .eq('is_active', true)
      .order('name')
      .limit(100);
    if (error) {
      return NextResponse.json(
        { error: 'Locations cannot be loaded for this account' },
        { status: 403, headers: noStore },
      );
    }
    const locations = (data ?? []).filter((location) =>
      typeof location.latitude === 'number' && Number.isFinite(location.latitude) &&
      typeof location.longitude === 'number' && Number.isFinite(location.longitude) &&
      typeof location.allowed_radius_meters === 'number' &&
      location.allowed_radius_meters > 0,
    );
    return NextResponse.json({ locations }, { headers: noStore });
  } catch {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: noStore },
    );
  }
}

// HR/Super Admin management. Permission checks also run inside the Edge Function.
export async function POST(request: Request) {
  try {
    const { supabase, profile } = await requireProfile();
    if (!['HR', 'SUPER_ADMIN'].includes(profile.role)) {
      return NextResponse.json({ error: 'HR or Super Admin required' }, { status: 403, headers: noStore });
    }
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: noStore });
    }
    const payload = body as Record<string, unknown>;
    const action = String(payload.action ?? '').toUpperCase();
    if (!['CREATE', 'UPDATE', 'ACTIVATE', 'DEACTIVATE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400, headers: noStore });
    }
    const { data, error } = await supabase.functions.invoke('manage-office-location', {
      body: { ...payload, action },
    });
    if (error) {
      let reason = error.message;
      let status = 502;
      const context = (error as { context?: Response }).context;
      if (context) {
        status = context.status || 502;
        try {
          const details: unknown = await context.json();
          if (details && typeof details === 'object' && 'error' in details &&
              typeof (details as { error?: unknown }).error === 'string') {
            reason = (details as { error: string }).error;
          }
        } catch { /* upstream did not send JSON */ }
      }
      return NextResponse.json({ error: reason }, { status, headers: noStore });
    }
    return NextResponse.json(data ?? { success: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401, headers: noStore });
  }
}
