import { requireProfile } from '@/lib/access';
import { Shell } from '@/components/shell';
import { RegularizationForm } from './regularization-form';

export default async function Regularizations() {
  const { profile } = await requireProfile();
  return (
    <Shell name={profile.full_name || 'Team member'} role={profile.role}>
      <div className="eyebrow">ATTENDANCE</div>
      <h1>Attendance regularization</h1>
      <p className="muted">
        Missed a punch or recorded an incorrect time? Select the attendance date and what needs correcting.
        A reviewer must approve your request before stored attendance is changed.
      </p>
      <RegularizationForm />
    </Shell>
  );
}
