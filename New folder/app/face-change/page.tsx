import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import {FaceChangeClient} from './request-client';
export default async function FaceChange(){const {profile}=await requireProfile();
return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">IDENTITY</div><h1>Face change request</h1><p className="muted">Already enrolled? Request permission to replace your attendance face. Your current face remains active until a new enrollment succeeds.</p><FaceChangeClient /></Shell>}
