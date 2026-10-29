import {NextResponse} from 'next/server';
import {requireProfile} from '@/lib/access';

export const dynamic='force-dynamic';
export async function GET(){
 try{
  const {supabase,profile}=await requireProfile();
  if(profile.role==='SUPER_ADMIN')return NextResponse.json({error:'Super Admin does not punch attendance'},{status:403});
  const {data,error}=await supabase.from('office_locations').select('id,name,latitude,longitude,allowed_radius_meters,is_default').eq('is_active',true).limit(100);
  if(error)return NextResponse.json({error:'Office locations cannot be loaded for this account'},{status:403});
  return NextResponse.json({locations:(data??[]).filter(x=>typeof x.latitude==='number'&&typeof x.longitude==='number'&&Number.isFinite(x.latitude)&&Number.isFinite(x.longitude)&&typeof x.allowed_radius_meters==='number'&&x.allowed_radius_meters>0)}, {headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Authentication required'},{status:401,headers:{'Cache-Control':'no-store'}})}
}
