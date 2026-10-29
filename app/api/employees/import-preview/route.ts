import {NextRequest, NextResponse} from 'next/server';
import {requireAdmin} from '@/lib/access';
import {readFirstWorksheet} from '@/lib/xlsx-first-sheet';
export const runtime='nodejs';
export async function POST(req:NextRequest){
 await requireAdmin();
 const type=req.headers.get('content-type')||'';
 if(!type.includes('multipart/form-data'))return NextResponse.json({error:'Expected Excel upload'},{status:415});
 try{
  const data=await req.formData();const file=data.get('file');
  if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))return NextResponse.json({error:'Choose .xlsx file'},{status:400});
  if(file.size>1_500_000)return NextResponse.json({error:'Excel file must be under 1.5 MB'},{status:413});
  const matrix=readFirstWorksheet(Buffer.from(await file.arrayBuffer()));
  return NextResponse.json({rows:matrix});
 }catch(err){return NextResponse.json({error:err instanceof Error?err.message:'Unable to preview Excel file'},{status:400});}
}
