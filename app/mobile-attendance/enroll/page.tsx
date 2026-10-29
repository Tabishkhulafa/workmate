import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import EnrollClient from './enroll-client';
export default async function FaceEnrollPage(){const {profile}=await requireProfile();return <Shell name={profile.full_name||'Team member'} role={profile.role}><div className="eyebrow">MOBILE / WEB</div><h1>Face enrollment</h1>{profile.role==='SUPER_ADMIN'?<p>Super Admin does not punch attendance.</p>:<EnrollClient/>}</Shell>}
