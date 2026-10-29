import {inflateRawSync} from 'node:zlib';

const MAX_UNCOMPRESSED = 6_000_000;
function xmlDecode(input: string): string {return input.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,(_m,n:string,k:string)=>{if(k)return ({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"} as Record<string,string>)[k]||'';const num=n.toLowerCase().startsWith('x')?parseInt(n.slice(1),16):parseInt(n,10);return num>0&&num<=0x10ffff?String.fromCodePoint(num):'';});}
function zipEntries(bytes:Buffer):Map<string,string>{
 const output=new Map<string,string>();let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(bytes.readUInt32LE(i)===0x06054b50){end=i;break;}}
 if(end<0)throw Error('Invalid Excel workbook ZIP structure');
 const total=bytes.readUInt16LE(end+10);let cursor=bytes.readUInt32LE(end+16);if(total>500||cursor>=bytes.length)throw Error('Excel workbook is too large');
 let budget=0;
 for(let j=0;j<total;j++){
  if(cursor+46>bytes.length||bytes.readUInt32LE(cursor)!==0x02014b50)throw Error('Invalid Excel directory');
  const flag=bytes.readUInt16LE(cursor+8),method=bytes.readUInt16LE(cursor+10),packed=bytes.readUInt32LE(cursor+20),unpacked=bytes.readUInt32LE(cursor+24);
  const nameSize=bytes.readUInt16LE(cursor+28),extra=bytes.readUInt16LE(cursor+30),comment=bytes.readUInt16LE(cursor+32),offset=bytes.readUInt32LE(cursor+42);
  const name=bytes.subarray(cursor+46,cursor+46+nameSize).toString('utf8');cursor+=46+nameSize+extra+comment;
  if(flag&1)throw Error('Password-protected Excel files are not supported');
  if(!['xl/sharedStrings.xml','xl/worksheets/sheet1.xml','xl/workbook.xml'].includes(name))continue;
  budget+=unpacked;if(budget>MAX_UNCOMPRESSED||unpacked>MAX_UNCOMPRESSED||offset+30>bytes.length)throw Error('Excel file exceeds preview limits');
  if(bytes.readUInt32LE(offset)!==0x04034b50)throw Error('Invalid Excel ZIP entry');
  const start=offset+30+bytes.readUInt16LE(offset+26)+bytes.readUInt16LE(offset+28);
  if(start+packed>bytes.length)throw Error('Corrupted Excel data');
  const data=method===0?bytes.subarray(start,start+packed):method===8?inflateRawSync(bytes.subarray(start,start+packed),{maxOutputLength:MAX_UNCOMPRESSED}):null;
  if(!data||data.length!==unpacked)throw Error('Unsupported or corrupted Excel compression');
  output.set(name,data.toString('utf8'));
 }
 return output;
}
function strings(xml:string):string[]{const result:string[]=[];for(const si of xml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)){let val='';for(const t of si[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g))val+=xmlDecode(t[1]);result.push(val);}return result;}
function colIndex(reference:string){const m=/^([A-Z]+)/i.exec(reference);if(!m)return -1;let n=0;for(const c of m[1].toUpperCase())n=n*26+c.charCodeAt(0)-64;return n-1;}
export function readFirstWorksheet(file:Buffer):string[][]{
 const parts=zipEntries(file),sheet=parts.get('xl/worksheets/sheet1.xml');if(!sheet)throw Error('First worksheet not found. Save as a standard .xlsx file.');
 const shared=strings(parts.get('xl/sharedStrings.xml')||'');const result:string[][]=[];
 for(const match of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  const values:string[]=[];for(const cell of match[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){
   const ref=/\br="([^"]+)"/.exec(cell[1])?.[1]||'';const idx=colIndex(ref);if(idx<0||idx>100)continue;
   const type=/\bt="([^"]+)"/.exec(cell[1])?.[1];const raw=/<v>([\s\S]*?)<\/v>/.exec(cell[2])?.[1]??'';
   const inline=/<is(?:\s[^>]*)?>([\s\S]*?)<\/is>/.exec(cell[2])?.[1]||'';
   const text=type==='s'?shared[Number(raw)]||'':type==='inlineStr'?Array.from(inline.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)).map(x=>xmlDecode(x[1])).join(''):type==='b'?(raw==='1'?'TRUE':'FALSE'):type==='e'?'':xmlDecode(raw);
   values[idx]=text;
  }
  if(values.some(x=>x?.trim()))result.push(Array.from({length:values.length},(_,i)=>values[i]||''));
  if(result.length>201)throw Error('Maximum 200 employees per import');
 }
 return result;
}
