import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const send=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function actor(){const supabase=await supabaseServer();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)return {supabase,error:'Sign in required'};const {data:profile}=await supabase.from('profiles').select('role,is_active,must_change_password').eq('id',user.id).maybeSingle();if(!profile?.is_active||profile.must_change_password||!['EMPLOYEE','HR','DEPARTMENT_HEAD'].includes(profile.role))return {supabase,error:'Attendance enrollment unavailable for this account'};return {supabase,user};}
export async function GET(){
 const a=await actor();
 if(a.error||!a.user)return send({error:a.error},403);
 const {data,error}=await a.supabase.functions.invoke('face-profile-status',{body:{employee_id:a.user.id}});
 if(error){
  const context=(error as {context?:Response}).context;
  let reason='Unable to retrieve enrollment status. Please refresh.';
  try{const details=await context?.clone().json() as {error?:string}|undefined;reason=details?.error||reason;}catch{}
  return send({error:reason},context?.status&&context.status>=400?context.status:502);
 }
 if(typeof data?.enrolled!=='boolean')return send({error:'Enrollment status could not be confirmed. Please refresh.'},502);
 // First-time enrollment must not depend on the face-change approval API.
 if(data.enrolled===false)return send({enrolled:false,can_replace:false,model_name:null,model_version:null});
 const {data:requests,error:requestError}=await a.supabase.functions.invoke('manage-face-reenrollment',{body:{action:'my_requests'}});
 if(requestError)return send({enrolled:true,can_replace:false,model_name:data.model_name??null,
  warning:'Unable to check face replacement approval. Refresh to retry.'});
 const approved=(Array.isArray(requests?.requests)?requests.requests:[]).find((item:unknown)=>{
  if(!item||typeof item!=='object')return false;
  const r=item as {status?:string;approved_until?:string|null;consumed_at?:string|null};
  return r.status==='APPROVED'&&!r.consumed_at&&typeof r.approved_until==='string'&&new Date(r.approved_until).getTime()>Date.now();
 });
 return send({enrolled:true,model_name:data.model_name??null,model_version:data.model_version??null,
  can_replace:!!approved,approval_expires_at:approved?.approved_until??null});
}
export async function POST(request:Request){const a=await actor();if(a.error||!a.user)return send({error:a.error},403);const input:unknown=await request.json().catch(()=>null);if(!input||typeof input!=='object')return send({error:'Invalid enrollment request'},400);const b=input as Record<string,unknown>;if(!Array.isArray(b.embedding)||b.embedding.length!==192||b.embedding.some(v=>typeof v!=='number'||!Number.isFinite(v)))return send({error:'Invalid embedding'},400);if(b.model_name!=='mobilefacenet'||b.model_version!=='1'||typeof b.photo_base64!=='string'||b.photo_base64.length>2200000)return send({error:'Invalid model or photo'},400);
const {data,error}=await a.supabase.functions.invoke('complete-face-enrollment',{body:{embedding:b.embedding,model_name:'mobilefacenet',model_version:'1',photo_base64:b.photo_base64}});if(error){let msg='Unable to enroll face';const context=(error as {context?:Response}).context;try{const detail=await context?.json() as {error?:string}|undefined;msg=detail?.error||msg;}catch{}return send({error:msg},context?.status&&context.status>=400?context.status:502);}if(!data||data.success!==true)return send({error:'Enrollment could not be confirmed. Refresh enrollment status before retrying.'},502);return send({success:true,replaced:data.replaced===true,approval_consumed:data.approval_consumed===true});}
