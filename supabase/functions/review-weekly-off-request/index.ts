// STAGING ONLY — deploy this along with the included atomic-approval SQL (service_role-only RPC).
import { createClient } from 'jsr:@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,x-client-info,content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Content-Type':'application/json'};
const respond=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{status,headers:cors});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return respond(405,{error:'Method not allowed'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!secret)return respond(500,{error:'Server configuration missing'});
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!token)return respond(401,{error:'Login required'});
  const {data:identity,error:authError}=await createClient(url,anon).auth.getUser(token);
  if(authError||!identity.user)return respond(401,{error:'Invalid session'});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:reviewer}=await db.from('profiles').select('id,role,department_id,is_active,must_change_password').eq('id',identity.user.id).maybeSingle();
  if(!reviewer?.is_active||reviewer.must_change_password||!['DEPARTMENT_HEAD','HR','SUPER_ADMIN'].includes(reviewer.role))return respond(403,{error:'Not an approver'});
  const body=await req.json().catch(()=>null);
  const requestId=body?.request_id,action=typeof body?.action==='string'?body.action.trim().toUpperCase():'';
  const note=typeof body?.review_note==='string'?body.review_note.trim():'';
  if(typeof requestId!=='string'||!uuid.test(requestId))return respond(400,{error:'Invalid request ID'});
  if(!['APPROVED','REJECTED'].includes(action))return respond(400,{error:'Invalid decision'});
  if(note.length>500||(action==='REJECTED'&&note.length<3))return respond(400,{error:'Provide a valid review/rejection note'});
  const {data:request,error:requestError}=await db.from('weekly_off_requests').select('id,employee_id,requested_day,status').eq('id',requestId).maybeSingle();
  if(requestError||!request)return respond(404,{error:'Weekly-off request not found'});
  if(request.status!=='PENDING')return respond(409,{error:'Request already reviewed'});
  if(request.employee_id===reviewer.id)return respond(403,{error:'Cannot approve your own request'});
  if(!['MONDAY','TUESDAY','WEDNESDAY','THURSDAY'].includes(request.requested_day))return respond(400,{error:'Invalid weekly-off day'});
  const {data:applicant}=await db.from('profiles').select('id,role,department_id,workplace_type,is_active').eq('id',request.employee_id).maybeSingle();
  if(!applicant?.is_active)return respond(404,{error:'Applicant inactive or missing'});
  const {data:department}=applicant.department_id?await db.from('departments').select('department_type,is_active').eq('id',applicant.department_id).maybeSingle():{data:null};
  const workplace=applicant.workplace_type||(department?.is_active?department.department_type:null);
  if(!['STORE','WAREHOUSE'].includes(String(workplace)))return respond(403,{error:'Only Store/Warehouse weekly off requests are supported'});
  const allowed=reviewer.role==='SUPER_ADMIN'&&['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(applicant.role)||
    reviewer.role==='HR'&&['EMPLOYEE','DEPARTMENT_HEAD'].includes(applicant.role)||
    reviewer.role==='DEPARTMENT_HEAD'&&applicant.role==='EMPLOYEE'&&!!reviewer.department_id&&reviewer.department_id===applicant.department_id;
  if(!allowed)return respond(403,{error:'Not permitted to review this employee'});
  // Database routine locks the request and applies profile update + review atomically.
  const {data:review,error:dbError}=await db.rpc('workmate_review_weekly_off_atomic',{
   p_request_id:requestId,p_reviewer_id:reviewer.id,p_decision:action,p_note:note||null,
  });
  if(dbError){
   if(dbError.message.includes('already reviewed'))return respond(409,{error:'Request already reviewed'});
   console.error('weekly off approval failure',dbError.code);
   return respond(500,{error:'Could not safely save the approval'});
  }
  return respond(200,{success:true,review,weekly_off_day:action==='APPROVED'?request.requested_day:null});
 }catch(e){console.error('weekly off review',e instanceof Error?e.message:'unknown');return respond(500,{error:'Weekly-off review failed'});}
});
