'use client';
import {useState} from 'react';
type Row=Record<string,string>;
type Failure={line:number;name:string;reason:string};
function parseCSV(text:string):string[][]{const rows:string[][]=[];let row:string[]=[],cell='',quotes=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quotes&&text[i+1]==='"'){cell+='"';i++;}else quotes=!quotes;}else if(c===','&&!quotes){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quotes){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}row.push(cell);if(row.some(x=>x.trim()))rows.push(row);return rows;}
const norm=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,'_');
const normalizeDepartment=(s:string)=>s.trim().toLowerCase().replace(/\s+/g,' ').replace(/\bvedio\b/g,'video');
const pause=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms));
const key=(r:Row)=>[r.email?.trim().toLowerCase()||'',(r.mobile||r.mobile_number||r.phone||'').trim()].join('|');
const privateKeys=new Set(['current_address','permanent_address','emergency_contact_1_name','emergency_contact_1_relation','emergency_contact_1_phone','emergency_contact_2_name','emergency_contact_2_relation','emergency_contact_2_phone','blood_group','bank_account_holder','bank_name','bank_account_number','bank_ifsc','bank_branch']);
export default function ImportClient({departments}:{departments:{id:string;name:string}[]}) {
 const [rows,setRows]=useState<Row[]>([]),[status,setStatus]=useState(''),[loading,setLoading]=useState(false),[busy,setBusy]=useState(false);
 const [created,setCreated]=useState<string[]>([]),[errors,setErrors]=useState<Failure[]>([]);
 const deptMap=new Map(departments.map(d=>[normalizeDepartment(d.name),d.id]));
 const missingDepartments=[...new Set(rows.filter(r=>(r.role||'EMPLOYEE').toUpperCase().replaceAll(' ','_')!=='SUPER_ADMIN').map(r=>(r.department||r.department_name||'').trim()).filter(name=>!deptMap.has(normalizeDepartment(name))))];
 async function load(file?:File){if(!file)return;setRows([]);setCreated([]);setErrors([]);setLoading(true);setStatus('Reading file…');try{
  let matrix:string[][];
  if(file.name.toLowerCase().endsWith('.xlsx')){const data=new FormData();data.set('file',file);const res=await fetch('/api/employees/import-preview',{method:'POST',body:data});const json=await res.json();if(!res.ok)throw Error(json.error||'Excel preview failed');matrix=json.rows;}
  else if(file.name.toLowerCase().endsWith('.csv'))matrix=parseCSV((await file.text()).replace(/^\uFEFF/,''));
  else throw Error('Choose a .csv or .xlsx file');
  if(matrix.length<2||matrix.length>201)throw Error('Provide 1–200 staff rows');
  const headers=matrix[0].map(norm);if(!headers.includes('name')&&!headers.includes('full_name'))throw Error('Missing name column');
  if(new Set(headers).size!==headers.length)throw Error('Duplicate column headings');
  const parsed=matrix.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').trim()])));
  const seen=new Set<string>();for(let i=0;i<parsed.length;i++){const p=(parsed[i].mobile||parsed[i].mobile_number||parsed[i].phone||'').trim();if(!/^\d{10}$/.test(p))throw Error(`Row ${i+2}: invalid mobile`);if(seen.has(p))throw Error(`Row ${i+2}: duplicate mobile in file`);seen.add(p);}
  setRows(parsed);setStatus(`Preview loaded: ${parsed.length} employees. Existing accounts may already exist; review before importing.`);
 }catch(e){setStatus(e instanceof Error?e.message:'Preview failed');}finally{setLoading(false);}}
 async function start(){if(busy||missingDepartments.length>0){setStatus('Cannot import: please create/activate missing departments first.');return;}setBusy(true);const completed=new Set(created);const failed:Failure[]=[];let attempted=0,halted=false;
  for(let i=0;i<rows.length;i++){
   const r=rows[i],k=key(r);if(completed.has(k))continue;
   const phone=r.mobile||r.mobile_number||r.phone||'';
   const role=(r.role||'EMPLOYEE').toUpperCase().replaceAll(' ','_');
   const departmentId=deptMap.get(normalizeDepartment(r.department||r.department_name||''));
   if(!departmentId&&role!=='SUPER_ADMIN'){failed.push({line:i+2,name:r.name||r.full_name||'',reason:`Unknown department: ${r.department||r.department_name||'(blank)'}. Create/activate the exact department first.`});continue;}
   const body={full_name:r.name||r.full_name||'',employee_code:r.employee_code||`WM${Date.now()}${i}`,email:r.email||null,phone,password:phone,department_id:departmentId||null,designation:r.designation||'Employee',role,private_details:Object.fromEntries(Object.entries(r).filter(([field])=>privateKeys.has(field)))};
   try {
    const res=await fetch('/api/employees/create',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const data=await res.json();
    if(!res.ok){const reason=String(data.error||`HTTP ${res.status}`);failed.push({line:i+2,name:body.full_name,reason});if(res.status===429||data.rate_limited){halted=true;setStatus(`Rate limited at row ${i+2}. Waiting before retry is required.`);break;}}
    else {completed.add(k);setCreated([...completed]);}
   }catch(e){failed.push({line:i+2,name:body.full_name,reason:e instanceof Error?e.message:'Network error'});halted=true;break;}
   attempted++;setStatus(`${attempted} attempted this run; ${completed.size} successful this upload; ${failed.length} failed.`);
   if(i<rows.length-1)await pause(1100);
  }
  setErrors(failed);setCreated([...completed]);setBusy(false);
  setStatus(`${halted?'Paused':'Finished'}: ${completed.size} successful in this upload; ${failed.length} failed this run. Already-created rows in this session are skipped on retry. ${completed.size===0?'Previously created accounts from older imports are NOT automatically detected.':''}`);
 }
 const finished=new Set(created);
 function downloadFailedOnly(){
  const failedLines=new Set(errors.map(e=>e.line));
  if(!failedLines.size)return;
  const cols=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));
  const csvCell=(value:string)=>{const safe=/^[\s]*[=+\-@]/.test(value)?`'${value}`:value;return `"${safe.replaceAll('"','""')}"`;};
  const data=[cols,...rows.flatMap((r,i)=>failedLines.has(i+2)?[cols.map(c=>r[c]??'')]:[])];
  const output='\uFEFF'+data.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([output],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='workmate-failed-only-retry.csv';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }
 function downloadReport(){
  const failureMap=new Map(errors.map(e=>[e.line,e.reason]));
  const csvCell=(value:string)=>{const safe=/^[\s]*[=+\-@]/.test(value)?`'${value}`:value;return `"${safe.replaceAll('"','""')}"`;};
  const entries=[['Source row','Name','Email','Mobile','Department','Import status','Error'],...rows.map((r,i)=>[String(i+2),r.name||r.full_name||'',r.email||'',r.mobile||r.mobile_number||r.phone||'',r.department||r.department_name||'',finished.has(key(r))?'Created this upload':failureMap.has(i+2)?'Failed':'Not attempted',failureMap.get(i+2)||''])];
  const csv='\uFEFF'+entries.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const anchor=document.createElement('a');anchor.href=url;anchor.download='workmate-import-results.csv';anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
 }

 return <div className="card"><p><a href="/workmate-employee-import-template.csv" download>Download employee CSV template</a></p><label>Upload Excel / CSV<input type="file" accept=".xlsx,.csv" disabled={busy||loading} onChange={e=>load(e.target.files?.[0])}/></label><p className="muted small">First worksheet only, max 200. This creates REAL accounts. If an earlier import created some accounts, remove those rows before starting a new import. Do not click create twice blindly.</p>
 {rows.length>0&&missingDepartments.length>0&&<div className="notice error" role="alert"><b>Import blocked: missing/inactive department(s): {missingDepartments.join(', ')}</b><p>Go to <a href="/departments">Departments</a> and add/activate these exact names using HR/Admin tools, then reload this import page and upload only the failed rows. Do not assign staff to a different department just to bypass the check.</p><p>Available department names: {departments.map(d=>d.name).join(', ')||'none'}</p></div>}
  {rows.length>0&&<><p><b>{rows.length} rows in preview · {created.length} newly created this upload</b></p><div className="tablewrap"><table><thead><tr><th>Row</th><th>Name</th><th>Department</th><th>Mobile</th><th>Status</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{i+2}</td><td>{r.name||r.full_name}</td><td>{r.department||r.department_name}</td><td>{r.mobile||r.phone||r.mobile_number}</td><td>{finished.has(key(r))?'Created (skip on retry)':(r.role||'EMPLOYEE').toUpperCase().replaceAll(' ','_')!=='SUPER_ADMIN'&&!deptMap.has(normalizeDepartment(r.department||r.department_name||''))?'Missing department':'Pending / Failed'}</td></tr>)}</tbody></table></div>
 <button disabled={busy||loading||missingDepartments.length>0||created.length===rows.length} onClick={start}>{busy?'Creating…':created.length?'Retry unfinished rows':`Create ${rows.length} employees`}</button></>}
 {rows.length>0&&<button type="button" disabled={busy} onClick={downloadReport}>Download import results CSV</button>}
 {status&&<div className="notice" role="status">{status}</div>}
 {errors.length>0&&<div className="card"><button type="button" disabled={busy} onClick={downloadFailedOnly}>Download failed rows only (CSV)</button><b>Detailed failures ({errors.length})</b><ul>{errors.map(e=><li key={`${e.line}-${e.name}`}>Row {e.line} ({e.name}): {e.reason}</li>)}</ul></div>}
 </div>;
}
