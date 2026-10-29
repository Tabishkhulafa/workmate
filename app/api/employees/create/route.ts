import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/access';
import {stagingWriteError} from '@/lib/staging-write';

function extractMessage(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const o = value as Record<string, unknown>;
  for (const k of ['error', 'message', 'msg']) {
    if (typeof o[k] === 'string' && o[k]) return o[k] as string;
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const { supabase, profile } = await requireAdmin();
  const blocked=stagingWriteError();if(blocked)return NextResponse.json({error:blocked},{status:409});
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const role = String(body.role || 'EMPLOYEE');
  if (!['EMPLOYEE','DEPARTMENT_HEAD','HR','SUPER_ADMIN'].includes(role)) return NextResponse.json({error:'Invalid role'}, {status:400});
  const createDepartmentHead=role==='DEPARTMENT_HEAD';
  const headDepartmentId=String(body.department_id||'').trim();
  const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if(createDepartmentHead&&!uuidPattern.test(headDepartmentId))return NextResponse.json({error:'Select a valid department before assigning Department Head.'},{status:400});
  if (profile.role === 'HR' && ['HR','SUPER_ADMIN'].includes(role)) return NextResponse.json({error:'Not permitted'}, {status:403});
  // Keep local validation in sync with the existing Edge Function: all three
  // assignment fields must travel together, even if the client bypasses the form.
  const joining=String(body.date_of_joining||'').trim();
  const workplace=String(body.workplace_type||'').trim();
  const locationId=String(body.work_location_id||'').trim();
  const parsedJoining=/^\d{4}-\d{2}-\d{2}$/.test(joining)
    ? new Date(`${joining}T00:00:00.000Z`) : null;
  if(!parsedJoining||!Number.isFinite(parsedJoining.getTime())||parsedJoining.toISOString().slice(0,10)!==joining){
    return NextResponse.json({error:'A valid Date of Joining is required.'},{status:400});
  }
  if(!['OFFICE','STORE','WAREHOUSE'].includes(workplace)){
    return NextResponse.json({error:'Workplace must be Office, Store or Warehouse.'},{status:400});
  }
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(locationId)){
    return NextResponse.json({error:'Select a valid Work Location.'},{status:400});
  }
  const phone=String(body.phone||'').trim();
  const email=String(body.email||'').trim();
  const privateDetails=(body.private_details&&typeof body.private_details==='object'&&!Array.isArray(body.private_details)?body.private_details:{}) as Record<string,unknown>;
  if(email&&!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(email))return NextResponse.json({error:'Enter a valid employee email address.'},{status:400});
  if(phone&&!/^\d{10}$/.test(phone))return NextResponse.json({error:'Employee mobile must have exactly 10 digits.'},{status:400});
  for(const field of ['emergency_contact_1_phone','emergency_contact_2_phone']){
   const number=String(privateDetails[field]||'').trim();
   if(number&&!/^\d{10}$/.test(number))return NextResponse.json({error:`${field.replaceAll('_',' ')} must have exactly 10 digits.`},{status:400});
  }
  const password=String(body.password||'');
  if (!/^\d{10}$/.test(phone) && !String(body.email||'').trim()) return NextResponse.json({error:'Email or 10-digit phone required'},{status:400});
  if (password.length<6) return NextResponse.json({error:'Initial password too short'}, {status:400});
  // Create Auth account as Employee first; promote through the existing
  // atomic per-department assignment RPC, not by writing DEPARTMENT_HEAD directly.
  const creationBody=createDepartmentHead?{...body,role:'EMPLOYEE'}:body;
  const {data,error}=await supabase.functions.invoke('create-employee',{body:creationBody});
  if (error || extractMessage(data) || data?.success === false) {
    let reason=extractMessage(data);
    let httpStatus: number|undefined;
    const context = error && typeof error === 'object' && 'context' in error ? error.context : undefined;
    if (context instanceof Response) {
      httpStatus=context.status;
      try {
        const raw=await context.clone().text();
        try {reason ||= extractMessage(JSON.parse(raw));} catch {reason ||= raw.slice(0,250);}
      } catch { /* context may be consumed */ }
    }
    reason = reason || error?.message || 'Employee creation failed';
    const rateLimited = httpStatus===429 || /rate.?limit|too many requests|email rate limit/i.test(reason ?? '');
    return NextResponse.json({error:reason,upstream_status:httpStatus,rate_limited:rateLimited}, {status:rateLimited?429:422});
  }
  if(createDepartmentHead){
    // Account creation and auth user provisioning cannot share a database
    // transaction. Failure here leaves a valid Employee for manual assignment,
    // rather than deleting someone's credentials or creating duplicate Heads.
    const createdUserId=typeof data?.user_id==='string'?data.user_id:'';
    if(!uuidPattern.test(createdUserId)){
      return NextResponse.json({
        error:'Account was created as Employee but its ID was not returned. Find the new employee under Departments > Assign Head. Do not create the account again.',
        employee_created:true,
      },{status:502});
    }
    let assignment: Record<string, unknown> | null = null;
    let assignmentFailed = false;
    try {
      const result = await supabase.functions.invoke('assign-department-head',{
        body:{department_id:headDepartmentId,employee_id:createdUserId},
      });
      assignment = result.data as Record<string, unknown> | null;
      assignmentFailed = !!result.error || assignment?.success !== true;
    } catch {
      assignmentFailed = true;
    }
    if(assignmentFailed){
      return NextResponse.json({
        error:'Employee account was created, but Department Head assignment did not complete. Go to Departments > Assign Head and select the newly created employee. Do not create the account again.',
        employee_created:true,
        user_id:createdUserId,
      },{status:409});
    }
    return NextResponse.json({success:true,data:{...data,role:'DEPARTMENT_HEAD',assignment}});
  }
  return NextResponse.json({success:true,data});
}

