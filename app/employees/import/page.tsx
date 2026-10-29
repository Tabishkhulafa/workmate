import {requireAdmin} from '@/lib/access';
import {Shell} from '@/components/shell';
import ImportClient from './upload';
export default async function ImportPage(){const {profile,supabase}=await requireAdmin();const {data:departments}=await supabase.from('departments').select('id,name').eq('is_active',true);return <Shell name={profile.full_name||'Administrator'} role={profile.role}><div className="eyebrow">BULK IMPORT</div><h1>Import employees (Excel / CSV)</h1><p className="muted">Upload XLSX or CSV. Preview rows before creating staff accounts. Only the first worksheet is imported.</p><ImportClient departments={departments||[]}/></Shell>}
