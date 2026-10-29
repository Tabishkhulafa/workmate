export type ReminderSchedule={success?:boolean;date?:string;schedule?:{start_time:string;end_time:string}|null;attendance?:{clock_in_at?:string|null;clock_out_at?:string|null}|null;error?:string};
export type Reminder={id:string;label:string;when:number;kind:'IN'|'OUT'};
/** Create Asia/Kolkata reminder times from the effective schedule. No dummy shifts. */
export function deriveReminders(data:ReminderSchedule):Reminder[]{
 if(!data.success||!data.date||!data.schedule)return [];
 const {start_time,end_time}=data.schedule;
 const parse=(t:string):number|null=>{
  const m=/^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(t);
  if(!m)return null;
  const hour=Number(m[1]),minute=Number(m[2]);
  if(hour<0||hour>23||minute<0||minute>59)return null;
  const ms=Date.parse(`${data.date}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00+05:30`);
  return Number.isFinite(ms)?ms:null;
 };
 const start=parse(start_time),rawEnd=parse(end_time);
 if(start===null||rawEnd===null)return [];
 const end=rawEnd<=start?rawEnd+86400000:rawEnd;
 const stages:[string,string,number,'IN'|'OUT'][]=[
  ['in-minus-15','Clock In starts in 15 minutes',start-900000,'IN'],
  ['in-now','Time to Clock In',start,'IN'],
  ['in-plus-15','Clock In is 15 minutes overdue',start+900000,'IN'],
  ['in-plus-60','Final Clock In reminder',start+3600000,'IN'],
  ['out-now','Shift finished — Clock Out',end,'OUT'],
  ['out-plus-15','Clock Out reminder — 15 minutes',end+900000,'OUT'],
  ['out-plus-60','Clock Out reminder — 1 hour',end+3600000,'OUT'],
 ];
 const nextDay=Date.parse(`${data.date}T00:00:00+05:30`)+86400000;
 return stages.filter(([,,,kind])=>kind==='IN'?!data.attendance?.clock_in_at:!data.attendance?.clock_out_at&&Boolean(data.attendance?.clock_in_at))
  .filter(([, ,when,kind])=>kind!=='OUT'||when<nextDay) // After midnight: regularization, not Clock Out.
  .map(([id,label,when,kind])=>({id:String(id),label:String(label),when:Number(when),kind}));
}
