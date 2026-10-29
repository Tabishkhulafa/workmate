import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const {profile,supabase}=await requireProfile();
  if(profile.role==='SUPER_ADMIN')return NextResponse.json({error:'No attendance reminders for this role'},{status:403});
  const {data,error}=await supabase.functions.invoke('attendance-reminder-schedule',{body:{}});
  if(error){let detail=error.message;try{const v=await (error as {context?:Response}).context?.json() as {error?:string}|undefined;detail=v?.error||detail}catch{}return NextResponse.json({error:detail},{status:502});}
  return NextResponse.json(data??{error:'No schedule response'}, {headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Sign in required'},{status:401});}
}
