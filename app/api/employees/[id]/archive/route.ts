import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
import {stagingWriteError} from '@/lib/staging-write';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  const {supabase,profile}=await requireAdmin();
  if(!uuid.test(id))return NextResponse.json({error:'Invalid employee ID'},{status:400});
  const blocked=stagingWriteError();
  if(blocked)return NextResponse.json({error:blocked},{status:409});
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON'},{status:400});}
  const confirm_code=typeof body.confirm_code==='string'?body.confirm_code.trim():'';
  if(!confirm_code)return NextResponse.json({error:'Enter employee code to confirm'},{status:400});
  const {data:target,error:loadError}=await supabase.from('profiles').select('id,role,is_active,employee_code').eq('id',id).maybeSingle();
  if(loadError||!target)return NextResponse.json({error:'Employee not found'},{status:404});
  if(!target.is_active)return NextResponse.json({error:'Employee is already inactive'},{status:409});
  if(target.id===profile.id||target.role==='SUPER_ADMIN'||(profile.role==='HR'&&target.role==='HR'))return NextResponse.json({error:'Not permitted to remove this account'},{status:403});
  if(!target.employee_code||target.employee_code.trim().toUpperCase()!==confirm_code.toUpperCase())return NextResponse.json({error:'Employee code does not match'},{status:400});
  const {data,error}=await supabase.functions.invoke('deactivate-staff',{body:{user_id:id}});
  if(error||data?.error||data?.success!==true){
    let message=typeof data?.error==='string'?data.error:error?.message||'Employee deactivation failed';
    const context=(error as {context?:Response}|null)?.context;
    if(context&&typeof context.json==='function')try{const j=await context.json() as {error?:string};message=j.error||message;}catch{/* upstream may not return JSON */}
    return NextResponse.json({error:message},{status:422});
  }
  return NextResponse.json({success:true,auth_banned:data?.auth_banned===true});
}
