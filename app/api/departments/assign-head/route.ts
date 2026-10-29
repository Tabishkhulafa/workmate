import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
import {stagingWriteError} from '@/lib/staging-write';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function POST(request:Request){
 const {supabase}=await requireAdmin();
 const blocked=stagingWriteError();if(blocked)return NextResponse.json({error:blocked},{status:409});
 const body=await request.json().catch(()=>null);
 if(!body||!uuid.test(String(body.department_id))||!uuid.test(String(body.employee_id)))return NextResponse.json({error:'Valid department and employee IDs required'},{status:400});
 const {data:staff,error:staffError}=await supabase.from('profiles').select('id,role,department_id,is_active').eq('id',body.employee_id).single();
 if(staffError||!staff?.is_active||staff.role!=='EMPLOYEE'||staff.department_id!==body.department_id)return NextResponse.json({error:'Select an active Employee from the same department'},{status:400});
 const {data,error}=await supabase.functions.invoke('assign-department-head',{body:{department_id:body.department_id,employee_id:body.employee_id}});
 if(error||data?.error)return NextResponse.json({error:String(data?.error||error?.message||'Assignment failed')},{status:422});
 return NextResponse.json({success:true});
}
