import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import AttendanceSettingsForm from './settings-form';

export default async function AttendanceSettingsPage(){
 const {profile,supabase}=await requireAdmin();
 const {data,error}=await supabase.from('attendance_settings').select('id,late_grace_minutes,geo_location_required,face_verification_required,minimum_gps_accuracy_meters,is_active,created_at').eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 return <Shell name={profile.full_name||'Admin'} role={profile.role}>
 <div className="eyebrow">ATTENDANCE CONTROL</div><h1>Attendance settings</h1>
 <p className="muted">Manage the same grace, face and GPS rules used by the Android app.</p>
 {error?<div className="notice error">Unable to load settings: {error.message}</div>:<AttendanceSettingsForm initial={data??null}/>}
 <p className="muted small">Changes affect attendance validation. Test with a dummy employee before changing production policy.</p>
 </Shell>;
}
