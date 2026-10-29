import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import ButtonPunch from '../button-punch';
export default async function Page(){const {profile}=await requireProfile();return <Shell name={profile.full_name||'Team member'} role={profile.role}><div className="eyebrow">WORK MATE</div><h1>Button Clock In / Out</h1><p className="muted">Temporary attendance when approved by HR or Super Admin.</p><ButtonPunch/></Shell>}
