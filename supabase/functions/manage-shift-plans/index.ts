import {createClient} from 'jsr:@supabase/supabase-js@2';
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const day=/^20\d\d-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const time=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
type Scope='EMPLOYEE'|'DEPARTMENT'|'ORGANISATION';
const string=(value:unknown)=>typeof value==='string'?value.trim():'';
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return reply(500,{error:'Server configuration missing'});
  const token=String(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return reply(401,{error:'Session required'});
  const auth=createClient(url,anon,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:loginError}=await auth.auth.getUser(token);
  if(loginError||!identity.user)return reply(401,{error:'Invalid session'});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor}=await db.from('profiles').select('id,role,is_active,must_change_password').eq('id',identity.user.id).maybeSingle();
  if(!actor?.is_active||actor.must_change_password||!['HR','SUPER_ADMIN'].includes(actor.role))return reply(403,{error:'HR or Super Admin access required'});
  const b=await req.json().catch(()=>null);if(!b||typeof b!=='object')return reply(400,{error:'Invalid input'});
  const action=string(b.action).toUpperCase();
  if(action==='DEACTIVATE_ASSIGNMENT'||action==='DEACTIVATE_OVERRIDE'){
   const id=string(b.id);if(!uuid.test(id))return reply(400,{error:'Invalid ID'});
   const table=action==='DEACTIVATE_ASSIGNMENT'?'shift_assignments':'shift_overrides';
   const {data:existingPlan}=await db.from(table).select('id,scope,employee_id').eq('id',id).eq('is_active',true).maybeSingle();
   if(!existingPlan)return reply(404,{error:'Active shift plan not found'});
   if(existingPlan.scope==='ORGANISATION'&&actor.role!=='SUPER_ADMIN')return reply(403,{error:'Only Super Admin can modify organisation assignments'});
   if(existingPlan.employee_id&&actor.role!=='SUPER_ADMIN'){
    const {data:target}=await db.from('profiles').select('role').eq('id',existingPlan.employee_id).maybeSingle();
    if(target?.role==='HR')return reply(403,{error:'Only Super Admin can modify HR shifts'});
   }
   const {data:row,error}=await db.from(table).update({is_active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('is_active',true).select('id,scope,employee_id').maybeSingle();
   if(error)return reply(500,{error:'Could not deactivate shift plan'});
   if(!row)return reply(404,{error:'Active shift plan not found'});
   return reply(200,{success:true,id:row.id});
  }
  if(!['CREATE_ASSIGNMENT','CREATE_OVERRIDE'].includes(action))return reply(400,{error:'Unsupported action'});
  const scope=string(b.scope).toUpperCase() as Scope;
  if(!['ORGANISATION','DEPARTMENT','EMPLOYEE'].includes(scope))return reply(400,{error:'Invalid scope'});
  if(scope==='ORGANISATION'&&actor.role!=='SUPER_ADMIN')return reply(403,{error:'Only Super Admin can assign organisation-wide shifts'});
  const employee_id=scope==='EMPLOYEE'?string(b.employee_id):null;
  const department_id=scope==='DEPARTMENT'?string(b.department_id):null;
  if(scope==='EMPLOYEE'){
   if(!employee_id||!uuid.test(employee_id))return reply(400,{error:'Valid employee ID required'});
   const {data:p}=await db.from('profiles').select('role,is_active').eq('id',employee_id).maybeSingle();
   if(!p?.is_active||!['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(p.role))return reply(400,{error:'Eligible employee not found'});
   if(p.role==='HR'&&actor.role!=='SUPER_ADMIN')return reply(403,{error:'Only Super Admin may assign HR shifts'});
  }
  if(scope==='DEPARTMENT'){
   if(!department_id||!uuid.test(department_id))return reply(400,{error:'Valid department ID required'});
   const {data:dept}=await db.from('departments').select('id,is_active').eq('id',department_id).maybeSingle();
   if(!dept?.is_active)return reply(400,{error:'Active department not found'});
  }
  const isRegular=action==='CREATE_ASSIGNMENT';
  const start=string(isRegular?b.effective_from:b.start_date),end=string(isRegular?b.effective_to:b.end_date);
  if(!day.test(start)||!day.test(end)||end<start)return reply(400,{error:'Valid date range required'});
  const startEpoch=Date.parse(start+'T00:00:00Z'),endEpoch=Date.parse(end+'T00:00:00Z');
  if(!Number.isFinite(startEpoch)||!Number.isFinite(endEpoch)||endEpoch-startEpoch>366*2*86400000)return reply(400,{error:'Date range cannot exceed two years'});
  const table=isRegular?'shift_assignments':'shift_overrides';
  let conflictQuery=db.from(table).select(isRegular?'id,effective_from,effective_to':'id,start_date,end_date').eq('is_active',true).eq('scope',scope);
  if(scope==='EMPLOYEE') conflictQuery=conflictQuery.eq('employee_id',employee_id!);
  if(scope==='DEPARTMENT') conflictQuery=conflictQuery.eq('department_id',department_id!);
  const {data:existing,error:conflictError}=await conflictQuery.limit(500);
  if(conflictError)return reply(500,{error:'Unable to verify existing date ranges'});
  for(const row of existing??[]){
   const eStart=String(isRegular?row.effective_from:row.start_date),eEnd=String((isRegular?row.effective_to:row.end_date)??'9999-12-31');
   if(eStart<=end&&eEnd>=start)return reply(409,{error:'Overlapping active shift plan exists for this target. Deactivate the old plan first.'});
  }
  const shared={scope,employee_id,department_id,is_active:true,created_by:actor.id};
  if(isRegular){
   const shift_id=string(b.shift_id);if(!uuid.test(shift_id))return reply(400,{error:'Valid shift ID required'});
   const {data:s}=await db.from('shifts').select('id,is_active').eq('id',shift_id).maybeSingle();
   if(!s?.is_active)return reply(400,{error:'Active shift not found'});
   const {data,error}=await db.from(table).insert({...shared,shift_id,effective_from:start,effective_to:end}).select('id').single();
   return error?reply(500,{error:'Regular shift assignment could not be saved'}):reply(200,{success:true,id:data.id});
  }
  const name=string(b.name),start_time=string(b.start_time),end_time=string(b.end_time);
  const full=Number(b.required_work_minutes),half=Number(b.half_day_minutes);
  if(name.length<2||name.length>100||!time.test(start_time)||!time.test(end_time)||!Number.isInteger(full)||full<60||full>1440||!Number.isInteger(half)||half<30||half>=full)return reply(400,{error:'Invalid special shift details'});
  const {data,error}=await db.from(table).insert({...shared,name,start_date:start,end_date:end,start_time,end_time,required_work_minutes:full,half_day_minutes:half}).select('id').single();
  return error?reply(500,{error:'Special shift could not be saved'}):reply(200,{success:true,id:data.id});
 }catch(e){console.error('manage-shift-plans',e instanceof Error?e.message:'unknown');return reply(500,{error:'Unexpected shift plan error'});}
});
