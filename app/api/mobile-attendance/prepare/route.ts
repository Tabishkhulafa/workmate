import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';
import {checkGps,type Gps,type Office} from '@/lib/mobile-attendance/geofence';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  const {supabase,profile}=await requireProfile();
  if(!['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(profile.role))return NextResponse.json({error:'Role cannot punch attendance'},{status:403});
  const body=await request.json().catch(()=>null);
  if(!body||!['CLOCK_IN','CLOCK_OUT'].includes(body.action)||typeof body.office_id!=='string'||!body.gps)return NextResponse.json({error:'Invalid request'},{status:400});
  if(body.action==='CLOCK_OUT'){
    // Fail early before starting camera inference for a previous-day punch.
    // Supabase attendance-action v9 independently enforces this rule.
    const {data:open,error:openError}=await supabase.from('attendance')
      .select('attendance_date,clock_in_at').eq('employee_id',profile.id)
      .is('clock_out_at',null).not('clock_in_at','is',null)
      .order('clock_in_at',{ascending:false}).limit(1).maybeSingle();
    if(openError)return NextResponse.json({error:'Unable to verify active attendance; try again'},{status:503});
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(open && open.attendance_date!==today)return NextResponse.json({error:'Clock Out for yesterday is disabled after midnight. Submit an attendance regularization request.'},{status:409});
  }
  const {data,error}=await supabase.from('office_locations').select('id,name,latitude,longitude,allowed_radius_meters').eq('id',body.office_id).eq('is_active',true).maybeSingle();
  if(error||!data)return NextResponse.json({error:'Approved office unavailable'},{status:404});
  const gps=body.gps as Gps, office=data as Office;
  const result=checkGps(gps,office);
  if(!result.ok)return NextResponse.json({error:result.error,distance_m:result.distance??null},{status:422,headers:{'Cache-Control':'no-store'}});
  // This endpoint never creates an attendance record or grants a biometric token.
  return NextResponse.json({ready:true,office_id:office.id,distance_m:Math.round(result.distance??0),face_verification_required:true,attendance_recorded:false},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Session invalid or expired'},{status:401})}
}
