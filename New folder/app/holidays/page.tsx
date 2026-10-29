import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
import HolidayManager from '@/components/holiday-manager';
type Holiday = {id:string; holiday_date:string;name:string|null;title:string|null;description:string|null;holiday_type:string|null;is_active:boolean};
export default async function Page(){
 const {profile,supabase}=await requireProfile();
 const {data,error}=await supabase.from('holidays').select('id,holiday_date,name,title,description,holiday_type,is_active').order('holiday_date',{ascending:false}).limit(300);
 const mayManage=profile.role==='HR'||profile.role==='SUPER_ADMIN';
 return <Shell name={profile.full_name||'Team member'} role={profile.role}>
 <div className="eyebrow">WORK MATE</div><h1>Holiday calendar</h1><p className="muted">Official organisation holidays</p>
 {error?<p className="notice error">{error.message}</p>:<HolidayManager initial={(data||[]) as Holiday[]} mayManage={mayManage}/>}
 </Shell>;
}
