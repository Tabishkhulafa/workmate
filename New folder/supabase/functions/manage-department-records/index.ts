import {createClient} from 'jsr:@supabase/supabase-js@2';
const headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response('ok',{headers});
 if(request.method!=='POST')return reply(405,{error:'Method not allowed'});
 try{
  const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!key)return reply(500,{error:'Server configuration incomplete'});
  const jwt=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
  if(!jwt)return reply(401,{error:'Login required'});
  const authClient=createClient(url,anon),db=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:identity,error:authError}=await authClient.auth.getUser(jwt);
  if(authError||!identity.user)return reply(401,{error:'Invalid session'});
  const {data:actor,error:actorError}=await db.from('profiles').select('role,is_active,must_change_password').eq('id',identity.user.id).maybeSingle();
  if(actorError||!actor?.is_active||actor.must_change_password===true||!['HR','SUPER_ADMIN'].includes(actor.role))return reply(403,{error:'HR or Super Admin permission required'});
  const body=await request.json().catch(()=>null),action=String(body?.action||'').toUpperCase();
  if(action==='CREATE'){
   const name=String(body?.name||'').trim(),code=String(body?.code||'').trim().toUpperCase(),type=String(body?.department_type||'OFFICE').toUpperCase();
   if(name.length<2||name.length>100||code.length>30||!['OFFICE','STORE','WAREHOUSE'].includes(type))return reply(400,{error:'Invalid department name, code or type'});
   const {data:existing,error:existingError}=await db.from('departments').select('id,name,is_active').ilike('name',name).limit(1);
   if(existingError)return reply(500,{error:'Unable to verify department name'});
   if(existing?.length)return reply(409,{error:'Department already exists (possibly inactive). Rename or restore it instead of creating a duplicate.'});
   const {data,error}=await db.from('departments').insert({name,code:code||null,department_type:type,is_active:true}).select('id,name,code,department_type,is_active').single();
   if(error)return reply(error.code==='23505'?409:500,{error:'Department creation failed'});
   return reply(201,{success:true,department:data});
  }
  if(action==='DELETE'){
   const id=String(body?.department_id||'');if(!uuid.test(id))return reply(400,{error:'Valid department ID required'});
   const {data:existing,error:existsError}=await db.from('departments').select('id').eq('id',id).maybeSingle();
   if(existsError||!existing)return reply(404,{error:'Department not found'});
   const {count:employees,error:staffError}=await db.from('profiles').select('id',{head:true,count:'exact'}).eq('department_id',id);
   if(staffError)return reply(500,{error:'Unable to verify linked employees'});
   if((employees??0)>0)return reply(409,{error:`Department has ${employees} assigned employee records. Transfer employees before permanent deletion.`});
   const {error:deleteError}=await db.from('departments').delete().eq('id',id);
   if(deleteError){if(deleteError.code==='23503')return reply(409,{error:'Department is referenced by another record; deletion blocked'});return reply(500,{error:'Department deletion failed'});}
   return reply(200,{success:true,deleted:true});
  }
  return reply(400,{error:'Invalid department action'});
 }catch(error){console.error('manage-department-records',error instanceof Error?error.message:'unhandled');return reply(500,{error:'Unexpected error'});}
});
