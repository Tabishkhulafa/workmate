import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import PasswordResetReview from './review-client';

export default async function PasswordResetRequests(){
  const { profile } = await requireAdmin();
  return (
    <Shell name={profile.full_name || 'Administrator'} role={profile.role}>
      <div className="eyebrow">ACCOUNT ACCESS</div>
      <h1>Password reset requests</h1>
      <p className="muted">Review pending requests, generate an 8-digit code and share it privately only after confirming employee identity. The code expires after 30 minutes.</p>
      <PasswordResetReview/>
    </Shell>
  );
}
