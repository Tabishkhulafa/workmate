import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
import ProfileIdentityEditor from '@/components/profile-identity-editor';
import PrivateProfileClient from './private-profile-client';
import PasswordChangeClient from './password-change-client';
import {stagingWriteError} from '@/lib/staging-write';

export default async function Profile(){
  const {profile,supabase}=await requireProfile();
  const {data:extra}=await supabase.from('profiles').select('designation').eq('id',profile.id).maybeSingle();
  return <Shell name={profile.full_name||'Team member'} role={profile.role}>
    <div className="eyebrow">ACCOUNT</div><h1>My profile</h1>
    <section className="card details wm-profile-summary">
      <div><small>Name</small><strong>{profile.full_name||'—'}</strong></div>
      <div><small>Employee code</small><strong>{profile.employee_code||'—'}</strong></div>
      <div><small>Email</small><strong>{profile.email||'—'}</strong></div>
      <div><small>Access role</small><strong>{profile.role.replaceAll('_',' ')}</strong></div>
    </section>
    <ProfileIdentityEditor initialName={profile.full_name||''} initialDesignation={typeof extra?.designation==='string'?extra.designation:''} accessRole={profile.role}/>
    <PrivateProfileClient/>
    <PasswordChangeClient stagingEnabled={!stagingWriteError()}/>
  </Shell>;
}
