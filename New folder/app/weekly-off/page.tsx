import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
export default async function Page(){
 const {profile,supabase}=await requireProfile();
 const {data,error}=await supabase.from('profiles').select('full_name,weekly_off_day').eq('id',profile.id).limit(100);
 return <Shell name={profile.full_name||'Team member'} role={profile.role}>
 <div className="eyebrow">WORK MATE</div><h1>My weekly off</h1><p className="muted">My assigned weekly off and requests</p>
 {error?<p className="notice error">{error.message}</p>:<div className="card tablewrap"><table><thead><tr><th>Full Name</th><th>Weekly Off Day</th></tr></thead><tbody>{(data||[]).map((row,i)=><tr key={i}><td>{String(row.full_name??'—')}</td><td>{String(row.weekly_off_day??'—')}</td></tr>)}</tbody></table></div>}
 <p className="muted">View-only until matching privileged write endpoints and role policies are verified.</p>
 </Shell>
}
