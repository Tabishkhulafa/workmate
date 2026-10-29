import {redirect} from 'next/navigation';
import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import LeavePolicyEditor from './policy-editor';
export default async function LeavePolicy(){
 const {profile,supabase}=await requireProfile();
 if(profile.role!=='SUPER_ADMIN')redirect('/dashboard');
 const {data,error}=await supabase.from('leave_policies').select('id,monthly_paid_leave_days,is_active').eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">POLICIES</div><h1>Leave policy</h1><p className="muted">Monthly paid-leave allowance for the organisation. Only Super Admin can change this.</p>{error?<p className="notice error">{error.message}</p>:<LeavePolicyEditor initial={data?{id:data.id,monthly_paid_leave_days:data.monthly_paid_leave_days}:null}/>}</Shell>;
}
