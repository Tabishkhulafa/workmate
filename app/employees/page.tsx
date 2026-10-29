import Link from 'next/link';
import { requireAdmin } from '@/lib/access';
import { Shell } from '@/components/shell';
import styles from './directory.module.css';

type DirectorySearchParams = {
  q?: string | string[];
};

type DirectoryPageProps = {
  searchParams?: Promise<DirectorySearchParams>;
};

export default async function Employees({ searchParams }: DirectoryPageProps) {
  const { supabase, profile } = await requireAdmin();
  const params = await searchParams;
  const rawQuery = typeof params?.q === 'string' ? params.q : '';
  const query = rawQuery.trim().slice(0, 80);

  // This string is embedded in PostgREST's `or` filter syntax; accept only
  // characters that cannot alter its grammar. RLS still scopes all results.
  const searchTerm = query
    .replace(/[^\p{L}\p{N}\s@.+_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

  let staffQuery = supabase
    .from('profiles')
    .select('id,full_name,employee_code,email,role,designation,department_id,is_active');

  if (query) {
    if (searchTerm) {
      // Filter BEFORE limiting results, so employees past the initial
      // directory page can be found by name, code, email or mobile.
      const value = `"%${searchTerm}%"`;
      staffQuery = staffQuery.or(
        [
          `full_name.ilike.${value}`,
          `employee_code.ilike.${value}`,
          `email.ilike.${value}`,
          `phone.ilike.${value}`,
        ].join(','),
      );
    } else {
      // Punctuation-only terms must never trigger an unfiltered directory.
      staffQuery = staffQuery.eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }

  const [{ data, error }, { data: departments }] = await Promise.all([
    staffQuery.order('full_name').limit(200),
    supabase.from('departments').select('id,name').limit(200),
  ]);
  const deptNames = new Map((departments || []).map((department) => [department.id, department.name]));

  return (
    <Shell name={profile.full_name || 'Administrator'} role={profile.role}>
      <div className="eyebrow">PEOPLE</div>
      <h1>Employee directory</h1>
      <p className="muted">
        Account type, role/designation and department are separate fields. Showing up to 200 authorized records.
      </p>

      <div className={styles.toolbar}>
        <div className={styles.actions}>
          <Link className="buttonlink" href="/employees/new">Add employee</Link>
          <Link className="buttonlink" href="/employees/import">Import Excel / CSV</Link>
        </div>
        <form className={styles.search} method="get" action="/employees" role="search">
          <label className={styles.screenReader} htmlFor="employee-directory-search">
            Search employees
          </label>
          <input
            id="employee-directory-search"
            type="search"
            name="q"
            autoComplete="off"
            placeholder="Search name, code, email or mobile"
            defaultValue={query}
            maxLength={80}
            className={styles.searchInput}
          />
          <button type="submit" className={styles.searchButton}>Search</button>
          {query && <Link className={styles.clear} href="/employees">Clear</Link>}
        </form>
      </div>

      {query && !error && (
        <p className={styles.resultInfo} role="status">
          {data?.length ?? 0} {data?.length === 1 ? 'employee' : 'employees'} shown for &ldquo;{query}&rdquo;
          {(data?.length ?? 0) >= 200 ? ' (first 200 matches)' : ''}
        </p>
      )}

      {error ? (
        <div className="notice error">Directory read denied: {error.message}</div>
      ) : (
        <div className="card">
          <div className="tablewrap">
            <table className="wm-generic-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Code</th>
                  <th>Account type</th>
                  <th>Role / designation</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(data || []).map((employee) => (
                  <tr key={employee.id}>
                    <td><Link href={`/employees/${employee.id}`}>{employee.full_name}</Link></td>
                    <td>{employee.employee_code || '—'}</td>
                    <td>{employee.role.replaceAll('_', ' ')}</td>
                    <td>{employee.designation || '—'}</td>
                    <td>{deptNames.get(employee.department_id) || '—'}</td>
                    <td>{employee.is_active ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data?.length && (
            <p className="muted">
              {query ? 'No matching employees found. Try a different name, code, email or mobile number.' : 'No visible employees.'}
            </p>
          )}
        </div>
      )}
    </Shell>
  );
}
