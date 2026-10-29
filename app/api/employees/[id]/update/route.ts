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
  const full_name=typeof body.full_name==='string'?body.full_name.trim():'';
  const designation=typeof body.designation==='string'?body.designation.trim():'';
  const department_id=typeof body.department_id==='string'?body.department_id.trim():'';
  if(!full_name||full_name.length>150||!designation||designation.length>150||!uuid.test(department_id))return NextResponse.json({error:'Valid name, designation and department required'},{status:400});
  const {data:target,error:loadError}=await supabase.from('profiles').select('role,is_active').eq('id',id).maybeSingle();
  if(loadError||!target)return NextResponse.json({error:'Employee not found'},{status:404});
  if(target.is_active!==true||target.role==='SUPER_ADMIN'||(profile.role==='HR'&&target.role==='HR'))return NextResponse.json({error:'Not permitted to edit this employee'},{status:403});
  const {data,error}=await supabase.functions.invoke('update-staff-profile',{body:{employee_id:id,full_name,designation,department_id}});
  if(error||data?.error||data?.success===false){
    let message=typeof data?.error==='string'?data.error:error?.message||'Employee update failed';
    const context=(error as {context?:Response}|null)?.context;
    if(context&&typeof context.json==='function')try{const j=await context.json() as {error?:string};message=j.error||message;}catch{/* upstream may not return JSON */}
    return NextResponse.json({error:message},{status:422});
  }
  return NextResponse.json({success:true,details:data});
}
