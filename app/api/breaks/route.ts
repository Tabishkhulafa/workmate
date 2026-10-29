import {NextResponse, type NextRequest} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
import {stagingWriteError} from '@/lib/staging-write';
import {indiaDay,isBreakManager,isBreakUser,breakWorkplace,BREAK_WORKPLACES} from '@/lib/breaks';

const clockPattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const error=(message:string,status=400)=>NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
type Body={action?:unknown;reason?:unknown;break_id?:unknown;weekday?:unknown;start_time?:unknown;end_time?:unknown;workplace_type?:unknown;is_enabled?:unknown};

export async function POST(request:NextRequest){
 const origin=request.headers.get('origin');
 if(origin){try{if(new URL(origin).host!==request.headers.get('host'))return error('Invalid request origin.',403);}catch{return error('Invalid request origin.',403);}}
 if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))return error('JSON request required.',415);
 const supabase=await supabaseServer();
 const {data:{user},error:sessionError}=await supabase.auth.getUser();
 if(sessionError||!user)return error('Please sign in.',401);
 const {data:profile,error:profileError}=await supabase.from('profiles')
  .select('id,role,is_active,must_change_password,workplace_type,department_id').eq('id',user.id).maybeSingle();
 if(profileError||!profile||!profile.is_active||profile.must_change_password)return error('Account not authorized.',403);
 const safety=stagingWriteError();
 if(safety)return error(safety,403);
 let body:Body;
 try{body=await request.json();}catch{return error('Invalid JSON.');}
 const action=String(body.action||'');

 if(action==='start'){
  if(!isBreakUser(profile.role))return error('This role cannot take random breaks.',403);
  // Check the actual workplace on the server. Client toggles are presentation only.
  // Legacy accounts without an assigned workplace can use their department category.
  let departmentType:unknown=null;
  if(!breakWorkplace(profile.workplace_type) && profile.department_id){
   const {data:department,error:departmentError}=await supabase.from('departments')
    .select('department_type').eq('id',profile.department_id).maybeSingle();
   if(departmentError)return error('Unable to verify your workplace.',503);
   departmentType=department?.department_type;
  }
  const workplace=breakWorkplace(profile.workplace_type,departmentType);
  if(!workplace)return error('Your workplace is not configured. Ask HR to assign Office, Store or Warehouse.',403);
  const {data:policy,error:policyError}=await supabase.from('workmate_break_workplace_settings')
   .select('is_enabled').eq('workplace_type',workplace).maybeSingle();
  if(policyError||!policy)return error('Random Break workplace settings are unavailable on this database.',503);
  if(policy.is_enabled!==true)return error(`Random Break is disabled for ${workplace.toLowerCase()} staff.`,403);
  const reason=String(body.reason||'OTHER');
  if(!['FOOD','PERSONAL','OTHER'].includes(reason))return error('Invalid reason.');
  // Enforce a punched-in workday at both application and database trigger levels.
  const yesterday=new Date(Date.now()-86400000);
  const {data:attendance,error:attendanceError}=await supabase.from('attendance')
   .select('clock_in_at').eq('employee_id',profile.id).is('clock_out_at',null)
   .gte('attendance_date',indiaDay(yesterday)).order('clock_in_at',{ascending:false}).limit(2);
  if(attendanceError)return error('Unable to verify Clock In. Try again.',503);
  const clockIn=attendance?.find(a=>a.clock_in_at&&Date.parse(a.clock_in_at)>=Date.now()-86400000);
  if(!clockIn)return error('Clock In is required before starting a random break.',409);
  const {data, error:writeError}=await supabase.from('workmate_random_breaks')
   .insert({employee_id:profile.id,reason}).select('id,started_at,ended_at').single();
  if(writeError)return error(writeError.code==='23505'?'A random break is already active.':writeError.message,writeError.code==='23505'?409:400);
  return NextResponse.json({ok:true,break:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(action==='stop'){
  if(!isBreakUser(profile.role))return error('This role cannot end a random break.',403);
  const id=String(body.break_id||'');
  if(!/^[a-f0-9-]{36}$/i.test(id))return error('Valid break ID required.');
  const {data, error:writeError}=await supabase.from('workmate_random_breaks')
   .update({ended_at:new Date().toISOString()}).eq('id',id).eq('employee_id',profile.id)
   .is('ended_at',null).select('id,started_at,ended_at').maybeSingle();
  if(writeError)return error(writeError.message,400);
  if(!data)return error('No active break found. Refresh this page.',409);
  return NextResponse.json({ok:true,break:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(action==='workplace_policy'){
  if(!isBreakManager(profile.role))return error('Only HR or Super Admin may edit Random Break workplace access.',403);
  if(typeof body.workplace_type!=='string'||!BREAK_WORKPLACES.some(x=>x===body.workplace_type))return error('Invalid workplace type.');
  if(typeof body.is_enabled!=='boolean')return error('Enabled must be a boolean.');
  const {data, error:writeError}=await supabase.from('workmate_break_workplace_settings')
   .update({is_enabled:body.is_enabled}).eq('workplace_type',body.workplace_type)
   .select('workplace_type,is_enabled,updated_at').maybeSingle();
  if(writeError)return error(writeError.message,400);
  if(!data)return error('Workplace controls are not installed. Apply the staging SQL migration.',409);
  return NextResponse.json({ok:true,policy:data},{headers:{'Cache-Control':'no-store'}});
 }
 if(action==='schedule'){
  if(!isBreakManager(profile.role))return error('Only HR or Super Admin can edit scheduled breaks.',403);
  const weekday=Number(body.weekday),start=String(body.start_time||''),end=String(body.end_time||'');
  if(!Number.isInteger(weekday)||weekday<1||weekday>7)return error('Invalid weekday.');
  if(!clockPattern.test(start)||!clockPattern.test(end))return error('Select valid start and end times.');
  const span=(Number(end.slice(0,2))*60+Number(end.slice(3)))-(Number(start.slice(0,2))*60+Number(start.slice(3)));
  if(span<5||span>240)return error('Break window must last between 5 minutes and 4 hours.');
  const {data, error:writeError}=await supabase.from('workmate_break_schedule')
   .update({start_time:start,end_time:end}).eq('weekday',weekday)
   .select('weekday,start_time,end_time,updated_at').maybeSingle();
  if(writeError)return error(writeError.message,400);
  if(!data)return error('Schedule row missing. Install the staging migration.',409);
  return NextResponse.json({ok:true,schedule:data},{headers:{'Cache-Control':'no-store'}});
 }
 return error('Unsupported break action.');
}
