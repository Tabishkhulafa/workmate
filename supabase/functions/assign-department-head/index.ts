import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond=(status:number,body:Record<string,unknown>) => new Response(JSON.stringify(body),{status,headers:cors});

Deno.serve(async (request:Request) => {
  if(request.method==='OPTIONS') return new Response('ok',{headers:cors});
  if(request.method!=='POST') return respond(405,{error:'Method not allowed'});
  try {
    const url=Deno.env.get('SUPABASE_URL');
    const anonKey=Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anonKey||!serviceKey)return respond(500,{error:'Server configuration missing'});
    const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
    if(!token) return respond(401,{error:'Login required'});
    const userClient=createClient(url,anonKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:auth,error:authError}=await userClient.auth.getUser(token);
    if(authError||!auth.user)return respond(401,{error:'Invalid session'});
    const admin=createClient(url,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:caller,error:callerError}=await admin.from('profiles')
      .select('role,is_active,must_change_password').eq('id',auth.user.id).maybeSingle();
    if(callerError||!caller?.is_active||caller.must_change_password||
       !['SUPER_ADMIN','HR'].includes(caller.role))
      return respond(403,{error:'Only active Super Admin or HR can assign department heads'});
    const body=await request.json().catch(()=>null);
    if(!body||typeof body.department_id!=='string'||!uuid.test(body.department_id)||
       typeof body.employee_id!=='string'||!uuid.test(body.employee_id))
      return respond(400,{error:'Valid department and employee IDs required'});
    const {data,error}=await admin.rpc('workmate_assign_department_head_atomic',{
      p_department_id:body.department_id,p_employee_id:body.employee_id,
    });
    if(error){
      console.warn('department head assignment failed',error.code);
      return respond(error.code==='23505'?409:422,{error:error.message||'Assignment failed'});
    }
    return respond(200,{success:true,...(data&&typeof data==='object'?data:{})});
  }catch(error){
    console.error('department head assignment',error instanceof Error?error.message:'unknown');
    return respond(500,{error:'Department head assignment failed'});
  }
});
