import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const sb=await supabaseServer();const {data:{user}}=await sb.auth.getUser();if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 const b=await request.json().catch(()=>null);
 if(typeof b?.verification_token!=='string'||typeof b?.image_base64!=='string'||b.image_base64.length>3500000||b.image_base64.length<100)return NextResponse.json({error:'Invalid face evidence'},{status:400});
 const {data,error}=await sb.functions.invoke('upload-attendance-evidence',{body:{verification_token:b.verification_token,image_base64:b.image_base64}});
 if(error){let msg='Could not save attendance photo';try{const v=await (error as {context?:Response}).context?.json();if(v?.error)msg=v.error}catch{}return NextResponse.json({error:msg},{status:400});}
 if(data?.success!==true||!data?.evidence_path)return NextResponse.json({error:'Attendance photo not confirmed'},{status:502});
 return NextResponse.json({saved:true},{headers:{'Cache-Control':'no-store'}});
}
