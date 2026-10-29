import {redirect} from 'next/navigation';
import {supabaseServer} from '@/lib/supabase/server';
import InitialPasswordClient from './password-client';
export default async function InitialPasswordPage(){
 const supabase=await supabaseServer();const {data:{user}}=await supabase.auth.getUser();
 if(!user)redirect('/login');
 const {data:profile}=await supabase.from('profiles').select('id,is_active,must_change_password').eq('id',user.id).maybeSingle();
 if(!profile?.is_active)redirect('/login?error=profile');
 if(profile.must_change_password!==true)redirect('/dashboard');
 return <InitialPasswordClient/>;
}
