import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';

export async function GET(){
  const {supabase,profile}=await requireProfile();
  if(!['HR','SUPER_ADMIN','DEPARTMENT_HEAD'].includes(profile.role))return NextResponse.json({error:'Not permitted'},{status:403});
  const {data:queue,error:queueError}=await supabase.functions.invoke('manage-face-reenrollment',{body:{action:'review_queue'}});
  if(queueError)return NextResponse.json({error:'Unable to load queue'},{status:502});
  const requests=Array.isArray(queue?.requests)?queue.requests as {employee_id:string}[]:[];
  const ids=[...new Set(requests.map(r=>r.employee_id).filter(x=>/^[0-9a-f-]{36}$/i.test(x)))].slice(0,100);
  if(ids.length===0)return NextResponse.json({identities:{}});
  const {data:people,error}=await supabase.from('profiles').select('id,full_name,employee_code,department_id').in('id',ids);
  if(error)return NextResponse.json({identities:{},warning:'Staff profiles cannot be read with the current account permissions'});
  const deptIds=[...new Set((people||[]).map(p=>p.department_id).filter((v):v is string=>typeof v==='string'))];
  const {data:departments}=deptIds.length?await supabase.from('departments').select('id,name').in('id',deptIds):{data:[] as {id:string,name:string}[]};
  const deptMap=new Map((departments||[]).map(d=>[d.id,d.name]));
  const identities:Record<string,{full_name:string;employee_code:string;department_name:string}>={};
  for(const p of people||[])identities[p.id]={full_name:p.full_name||'Employee',employee_code:p.employee_code||'',department_name:p.department_id?deptMap.get(p.department_id)||'':''};
  return NextResponse.json({identities});
}
