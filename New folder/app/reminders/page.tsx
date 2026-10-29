import {requireProfile} from '@/lib/access';
import {Shell} from '@/components/shell';
import ReminderControls from './reminder-controls';
export default async function RemindersPage(){
 const {profile}=await requireProfile();
 return <Shell name={profile.full_name||''} role={profile.role}><div className="eyebrow">WORK MATE</div><h1>Attendance reminders</h1><p className="muted">Uses your assigned shift and today's attendance status. No fixed sample timings.</p><ReminderControls/></Shell>;
}
