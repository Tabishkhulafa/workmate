import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import LocationManager from './location-manager';

export default async function Page() {
  const { profile, supabase } = await requireAdmin();
  const { data, error } = await supabase.from('office_locations')
    .select('id,name,address,latitude,longitude,allowed_radius_meters,is_active,is_default')
    .order('name').limit(200);
  return <Shell name={profile.full_name || 'Team member'} role={profile.role}>
    <div className="eyebrow">WORK MATE · HR MANAGEMENT</div>
    <h1>Office locations</h1>
    <p className="muted">Manage geofencing locations. Existing attendance records are preserved.</p>
    {error ? <p className="notice error">{error.message}</p> : <LocationManager locations={data || []} />}
  </Shell>;
}
