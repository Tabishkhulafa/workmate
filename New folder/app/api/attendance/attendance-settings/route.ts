import {NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
export async function POST(request:Request){
 const {supabase,profile}=await requireAdmin();
 let body:Record<string,unknown>;
 try{body=await request.json()}catch{return NextResponse.json({error:'Invalid JSON'},{status:400})}
 const grace=body.late_grace_minutes,accuracy=body.minimum_gps_accuracy_meters;
 const gps=body.geo_location_required,face=body.face_verification_required;
 if(typeof grace!=='number'||!Number.isInteger(grace)||grace<0||grace>180||typeof accuracy!=='number'||!Number.isInteger(accuracy)||accuracy<5||accuracy>1000||typeof gps!=='boolean'||typeof face!=='boolean'){
  return NextResponse.json({error:'Invalid settings values'},{status:400});
 }
 // Uses the signed-in user's Supabase RLS: no service-role key in the web app.
 const {data:existing,error:lookupError}=await supabase.from('attendance_settings').select('id').eq('is_active',true).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(lookupError)return NextResponse.json({error:'Cannot read settings with your permissions'},{status:403});
 const payload={late_grace_minutes:grace,minimum_gps_accuracy_meters:accuracy,geo_location_required:gps,face_verification_required:face,updated_at:new Date().toISOString()};
 const response=existing?await supabase.from('attendance_settings').update(payload).eq('id',existing.id).select('id').single():await supabase.from('attendance_settings').insert({...payload,is_active:true,created_by:profile.id}).select('id').single();
 if(response.error)return NextResponse.json({error:'Save rejected by Supabase permissions or database rules: '+response.error.message},{status:403});
 return NextResponse.json({success:true});
}
