import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';
export const dynamic='force-dynamic';
export const revalidate=0;
const noStore={'Cache-Control':'private, no-store, max-age=0'};
const indiaDate=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function GET(){
 try{
  const {profile,supabase}=await requireProfile();
  if(!['EMPLOYEE','HR','DEPARTMENT_HEAD'].includes(profile.role))return NextResponse.json({error:'Attendance not available for this role'},{status:403,headers:noStore});
  const date=indiaDate();
  const {data,error}=await supabase.from('attendance')
   .select('attendance_date,clock_in_at,clock_out_at,attendance_status,clock_in_location_address,clock_out_location_address,clock_in_location_id,clock_out_location_id,office_location_id')
   .eq('employee_id',profile.id)
   .eq('attendance_date',date)
   .maybeSingle();
  if(error)return NextResponse.json({error:'Could not load today attendance: '+error.message},{status:500,headers:noStore});
  const ids=[data?.clock_in_location_id,data?.clock_out_location_id,data?.office_location_id].filter((x):x is string=>typeof x==='string');
  const offices=new Map<string,string>();
  if(ids.length){const {data:locs}=await supabase.from('office_locations').select('id,name').in('id',ids);for(const loc of locs||[])offices.set(loc.id,loc.name);}
  const inLocation=data?.clock_in_location_address||offices.get(data?.clock_in_location_id||data?.office_location_id||'')||null;
  const outLocation=data?.clock_out_location_address||offices.get(data?.clock_out_location_id||data?.office_location_id||'')||null;
  return NextResponse.json({date,clock_in_at:data?.clock_in_at??null,clock_out_at:data?.clock_out_at??null,clock_in_location:inLocation,clock_out_location:outLocation,status:data?.attendance_status??'NOT_MARKED'},{headers:noStore});
 }catch{return NextResponse.json({error:'Session expired. Please sign in again.'},{status:401,headers:noStore});}
}
