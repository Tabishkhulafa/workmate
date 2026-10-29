import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';
export async function POST(request:Request){
 const {profile,supabase}=await requireProfile();
 if(profile.role!=='SUPER_ADMIN')return NextResponse.json({error:'Super Admin only'},{status:403});
 const body:unknown=await request.json().catch(()=>null);
 const days=(body as {monthly_paid_leave_days?:unknown}|null)?.monthly_paid_leave_days;
 if(typeof days!=='number'||!Number.isInteger(days)||days<0||days>31)return NextResponse.json({error:'Monthly paid leave days must be 0 to 31'},{status:400});
 const {data:existing,error:readError}=await supabase.from('leave_policies').select('id').eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(readError)return NextResponse.json({error:readError.message},{status:500});
 const operation=existing?supabase.from('leave_policies').update({monthly_paid_leave_days:days}).eq('id',existing.id).select('id').single():supabase.from('leave_policies').insert({monthly_paid_leave_days:days,is_active:true,created_by:profile.id}).select('id').single();
 const {data,error}=await operation;
 if(error||!data)return NextResponse.json({error:error?.message||'Policy could not be saved'},{status:403});
 return NextResponse.json({success:true,id:data.id},{headers:{'Cache-Control':'no-store'}});
}
