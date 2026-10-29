import type {SupabaseClient} from '@supabase/supabase-js';

type BaseRow = {id:string;employee_id:string;status:string};
export type EnrichedApproval<T extends BaseRow> = T & {
  employee_name:string;
  employee_code:string | null;
  department_name:string | null;
};

// Uses the signed-in user's Supabase client: RLS continues to control readable records.
// Never expose email, phone, private profile fields, or a service-role key in the UI.
export async function enrichApprovalRows<T extends BaseRow>(
  supabase:SupabaseClient,
  rows:T[],
):Promise<EnrichedApproval<T>[]> {
  const ids=Array.from(new Set(rows.map(r=>r.employee_id).filter(Boolean)));
  if(ids.length===0)return [];
  const {data:people,error:peopleError}=await supabase.from('profiles')
    .select('id,full_name,employee_code,department_id').in('id',ids);
  if(peopleError)console.error('Approval employee names unavailable:',peopleError.message);
  const deptIds=Array.from(new Set((people||[]).map(p=>p.department_id).filter((v):v is string=>typeof v==='string')));
  const departments=deptIds.length?await supabase.from('departments').select('id,name').in('id',deptIds):null;
  if(departments?.error)console.error('Approval department names unavailable:',departments.error.message);
  const peopleMap=new Map((people||[]).map(p=>[p.id,p]));
  const deptMap=new Map((departments?.data||[]).map(d=>[d.id,d.name]));
  return rows.map(row=>{
    const p=peopleMap.get(row.employee_id);
    return {
      ...row,
      employee_name:p?.full_name?.trim()||'Employee details unavailable',
      employee_code:p?.employee_code||null,
      department_name:p?.department_id?deptMap.get(p.department_id)||null:null,
    };
  });
}
