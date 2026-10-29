export type WorkMateRole = 'EMPLOYEE' | 'DEPARTMENT_HEAD' | 'HR' | 'SUPER_ADMIN';
export type BreakReason = 'FOOD' | 'PERSONAL' | 'OTHER';
export const BREAK_WORKPLACES = ['OFFICE', 'STORE', 'WAREHOUSE'] as const;
export type BreakWorkplace = typeof BREAK_WORKPLACES[number];
export type BreakWorkplacePolicy = {workplace_type:BreakWorkplace;is_enabled:boolean;updated_at?:string|null};
export function breakWorkplace(value:unknown,departmentType?:unknown):BreakWorkplace|null{
 for(const candidate of [value, departmentType]){
  if(typeof candidate==='string'){
   const normalized=candidate.trim().toUpperCase();
   if(BREAK_WORKPLACES.some(workplace=>workplace===normalized))return normalized as BreakWorkplace;
  }
 }
 return null;
}
export function breakWorkplaceAllowed(workplace:BreakWorkplace|null, policies:BreakWorkplacePolicy[]):boolean{
 return !!workplace && policies.some(row=>row.workplace_type===workplace && row.is_enabled===true);
}

export type BreakSchedule = {weekday:number;start_time:string;end_time:string;updated_at?:string|null};
export type BreakRow = {id:string;employee_id:string;started_at:string;ended_at:string|null;reason:BreakReason;employee_name?:string;employee_code?:string;department_name?:string};

const isoIndia=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
export function indiaDay(d:Date=new Date()):string{return isoIndia.format(d);}
export function validDay(day:string):boolean{
 return /^\d{4}-\d{2}-\d{2}$/.test(day) && !Number.isNaN(Date.parse(`${day}T12:00:00Z`)) && new Date(`${day}T12:00:00Z`).toISOString().slice(0,10)===day;
}
export function indiaDayBounds(day:string):{from:string;to:string}{
 const start=new Date(`${day}T00:00:00+05:30`);
 return {from:start.toISOString(),to:new Date(start.getTime()+86400000).toISOString()};
}
export const WEEKDAYS=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export function indiaWeekday(date:Date=new Date()):number{
 const label=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Kolkata',weekday:'long'}).format(date);
 return WEEKDAYS.indexOf(label)+1;
}
export function timeLabel(time:string):string{
 const match=/^(\d{2}):(\d{2})/.exec(time);
 if(!match)return time;
 const hours=Number(match[1]);return `${hours%12||12}:${match[2]} ${hours>=12?'PM':'AM'}`;
}
export function shortIST(timestamp:string):string{
 const parsed=new Date(timestamp);
 if(Number.isNaN(parsed.getTime()))return '—';
 return new Intl.DateTimeFormat('en-IN',{timeZone:'Asia/Kolkata',hour:'numeric',minute:'2-digit',hour12:true}).format(parsed);
}
export function durationSeconds(started:string,ended:string|undefined|null,now=Date.now()):number{
 const from=Date.parse(started),to=ended?Date.parse(ended):now;
 return Number.isFinite(from)&&Number.isFinite(to)?Math.max(0,Math.floor((to-from)/1000)):0;
}
export function durationLabel(seconds:number):string{
 const hours=Math.floor(seconds/3600),min=Math.floor((seconds%3600)/60),sec=seconds%60;
 return hours?`${hours}h ${String(min).padStart(2,'0')}m ${String(sec).padStart(2,'0')}s`:`${min}m ${String(sec).padStart(2,'0')}s`;
}
export function isBreakUser(role:string):boolean{return ['EMPLOYEE','DEPARTMENT_HEAD','HR'].includes(role);}
export function isBreakManager(role:string):boolean{return role==='HR'||role==='SUPER_ADMIN';}
export function isBreakReviewer(role:string):boolean{return isBreakManager(role)||role==='DEPARTMENT_HEAD';}
