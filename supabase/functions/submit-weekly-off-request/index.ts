// STAGING ONLY — do not deploy to production until reviewed and tested.
import { createClient } from 'jsr:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const respond=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const validDay=(x:string)=>['MONDAY','TUESDAY','WEDNESDAY','THURSDAY'].includes(x);
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return respond(500,{error:'Server configuration unavailable'});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return respond(401,{error:'Login required'});
  const {data:identity,error:authError}=await createClient(url,anon).auth.getUser(token);
  if(authError||!identity.user)return respond(401,{error:'Invalid session'});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:actor,error:profileError}=await db.from('profiles')
   .select('id,role,department_id,workplace_type,is_active,must_change_password').eq('id',identity.user.id).maybeSingle();
  if(profileError||!actor?.is_active||actor.must_change_password)return respond(403,{error:'Inactive or restricted account'});
  if(!['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(actor.role))return respond(403,{error:'This role cannot request a weekly off'});
  const {data:dept}=actor.department_id?await db.from('departments').select('department_type,is_active').eq('id',actor.department_id).maybeSingle():{data:null};
  const workplace=actor.workplace_type|| (dept?.is_active?dept.department_type:null);
  if(!['STORE','WAREHOUSE'].includes(String(workplace)))return respond(403,{error:'Weekly off requests are for Store/Warehouse staff only'});
  const body=await req.json().catch(()=>null);
  const requestedDay=typeof body?.requested_day==='string'?body.requested_day.trim().toUpperCase():'';
  const reason=typeof body?.reason==='string'?body.reason.trim():'';
  if(!validDay(requestedDay))return respond(400,{error:'Choose Monday, Tuesday, Wednesday or Thursday'});
  if(reason.length>500)return respond(400,{error:'Reason is too long'});
  const {data:pending,error:pendingError}=await db.from('weekly_off_requests').select('id').eq('employee_id',actor.id).eq('status','PENDING').limit(1);
  if(pendingError)return respond(500,{error:'Unable to check existing request'});
  if(pending?.length)return respond(409,{error:'You already have a pending weekly-off request'});
  const {data:created,error:insertError}=await db.from('weekly_off_requests')
   .insert({employee_id:actor.id,requested_day:requestedDay,reason:reason||null,status:'PENDING'})
   .select('id,status,requested_day,created_at').single();
  if(insertError)return respond(insertError.code==='23505'?409:500,{error:'Unable to create weekly-off request'});
  return respond(201,{success:true,request:created});
 }catch(e){console.error('weekly off request',e instanceof Error?e.message:'unknown');return respond(500,{error:'Weekly-off request failed'});}
});
