'use client';
import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/browser';
export default function Logout() {
  const router=useRouter();
  return <button className="secondary" onClick={async()=>{await supabaseBrowser().auth.signOut();router.replace('/login');router.refresh();}}>Sign out</button>;
}
