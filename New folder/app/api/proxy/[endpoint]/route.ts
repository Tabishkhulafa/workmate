import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';
const allowed:Record<string,string[]>={
 'apply-leave':['EMPLOYEE','DEPARTMENT_HEAD','HR','SUPER_ADMIN'],
 'submit-attendance-regularization':['EMPLOYEE','DEPARTMENT_HEAD','HR'],
 'review-leave':['HR','SUPER_ADMIN','DEPARTMENT_HEAD'],
 'review-attendance-regularization':['HR','SUPER_ADMIN','DEPARTMENT_HEAD'],
 'manage-button-attendance':['HR','SUPER_ADMIN'],
 'manage-face-reenrollment':['HR','SUPER_ADMIN','DEPARTMENT_HEAD','EMPLOYEE'],
 'employee-face-photo':['HR','SUPER_ADMIN'],
 'manage-shift':['HR','SUPER_ADMIN'],
 'manage-office-location':['HR','SUPER_ADMIN'],
 'employee-private-details':['HR','SUPER_ADMIN'],
 'employee-kyc':['HR','SUPER_ADMIN'],
 'review-password-reset-request':['HR','SUPER_ADMIN']
};
export async function POST(request:Request,{params}:{params:Promise<{endpoint:string}>}) {
 const {endpoint}=await params;if(!allowed[endpoint])return NextResponse.json({error:'Unknown operation'},{status:404});
 const {supabase,profile}=await requireProfile();if(!allowed[endpoint].includes(profile.role))return NextResponse.json({error:'Role not permitted'},{status:403});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 if(endpoint==='manage-button-attendance'&&!['grant','revoke','status'].includes(String(body.action||'')))return NextResponse.json({error:'Invalid action'},{status:400});
 if(endpoint==='employee-face-photo'&&!/^[0-9a-f-]{36}$/i.test(String(body.employee_id||'')))return NextResponse.json({error:'Invalid employee ID'},{status:400});
 if(endpoint==='employee-kyc' && (!['view','upload'].includes(String(body.action))||!['aadhaar','pan'].includes(String(body.document_type))||!/^[0-9a-f-]{36}$/i.test(String(body.employee_id||''))))return NextResponse.json({error:'Invalid document request'},{status:400});
 const {data,error}=await supabase.functions.invoke(endpoint,{body});
 if(error){
  let detail=error.message;
  let upstreamStatus=502;
  const context=(error as {context?:Response}).context;
  if(context && typeof context.json==='function'){
   try{const errorBody=await context.json() as {error?:string;message?:string};detail=errorBody.error??errorBody.message??detail;upstreamStatus=context.status>=400?context.status:502;}catch{/* Invalid upstream JSON */}
  }
  return NextResponse.json({error:detail},{status:upstreamStatus});
 }
 return NextResponse.json(data??{error:'Empty response'},{status:200});
}
