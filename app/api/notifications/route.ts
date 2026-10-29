import {NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'private, no-store'};
async function currentUser(){
 const supabase=await supabaseServer();
 const {data:{user},error}=await supabase.auth.getUser();
 if(error||!user)return {supabase,user:null};
 const {data:profile}=await supabase.from('profiles').select('id,is_active,must_change_password').eq('id',user.id).maybeSingle();
 return {supabase,user:profile?.is_active&&!profile.must_change_password?user:null};
}
export async function GET(){
 try{
  const {supabase,user}=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers:noStore});
  const [{data,error},{count,error:countError}]=await Promise.all([
   supabase.from('workmate_notifications').select('id,category,event_type,title,body,href,created_at,read_at').eq('recipient_id',user.id).order('created_at',{ascending:false}).limit(40),
   supabase.from('workmate_notifications').select('id',{count:'exact',head:true}).eq('recipient_id',user.id).is('read_at',null)
  ]);
  if(error||countError)return NextResponse.json({error:'Notification inbox is not configured yet'},{status:503,headers:noStore});
  return NextResponse.json({items:data??[],unread:count??0},{headers:noStore});
 }catch{return NextResponse.json({error:'Could not load notifications'},{status:500,headers:noStore});}
}
export async function POST(request:Request){
 try{
  const {supabase,user}=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers:noStore});
  const body=await request.json().catch(()=>null);
  if(!body||typeof body.id!=='string'||!/^[a-f0-9-]{36}$/i.test(body.id))return NextResponse.json({error:'Invalid notification id'},{status:400,headers:noStore});
  const {error}=await supabase.from('workmate_notifications').update({read_at:new Date().toISOString()}).eq('id',body.id).eq('recipient_id',user.id);
  if(error)return NextResponse.json({error:'Cannot mark notification read'},{status:503,headers:noStore});
  return NextResponse.json({success:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Notification update failed'},{status:500,headers:noStore});}
}

// Permanently clear the signed-in user's own notification inbox.
// The database DELETE RLS policy restricts rows to recipient_id = auth.uid().
export async function DELETE(){
 try{
  const {supabase,user}=await currentUser();
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers:noStore});
  const {error}=await supabase.from('workmate_notifications').delete().eq('recipient_id',user.id);
  if(error)return NextResponse.json({error:'Unable to clear your notifications'},{status:503,headers:noStore});
  return NextResponse.json({success:true},{headers:noStore});
 }catch{return NextResponse.json({error:'Notification clear failed'},{status:500,headers:noStore});}
}
