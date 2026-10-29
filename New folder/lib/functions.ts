import { supabaseServer } from '@/lib/supabase/server';
export async function callFunction(name:string, body:Record<string,unknown>={}) {
 const supabase=await supabaseServer();
 const {data,error}=await supabase.functions.invoke(name,{body});
 return {data,error:error?.message||((data&&typeof data==='object'&&'error' in data)?String(data.error):null)};
}
