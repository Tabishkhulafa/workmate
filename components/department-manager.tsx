'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './department-manager.module.css';

type Department = {
  id: string;
  name: string;
  code: string | null;
  department_type: string | null;
  is_active: boolean;
  head_user_id?: string | null;
};
type Staff = {
  id: string;
  full_name: string | null;
  employee_code: string | null;
  department_id: string | null;
  role: string;
};
type Filter = 'ALL' | 'OFFICE' | 'STORE' | 'WAREHOUSE';
type Modal = { kind: 'create' } | { kind: 'edit'; departmentId: string } | { kind: 'head'; departmentId: string } | null;

const TYPE_LABELS: Record<string, string> = {
  OFFICE: 'Office', STORE: 'Store', WAREHOUSE: 'Warehouse',
};
const filters: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'OFFICE', label: 'Office' },
  { value: 'STORE', label: 'Store' },
  { value: 'WAREHOUSE', label: 'Warehouse' },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || 'WM';
}

export default function DepartmentManager({ departments, staff }: { departments: Department[]; staff: Staff[] }) {
  const router = useRouter();
  const [items, setItems] = useState(departments.filter(item => item.is_active));
  const [staffMembers, setStaffMembers] = useState(staff);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState('OFFICE');
  const [candidate, setCandidate] = useState('');

  const staffById = useMemo(() => new Map(staffMembers.map(person => [person.id, person])), [staffMembers]);
  const selectedDepartment = modal && 'departmentId' in modal
    ? items.find(item => item.id === modal.departmentId)
    : undefined;
  const candidateStaff = useMemo(() => selectedDepartment
    ? staffMembers.filter(person => person.department_id === selectedDepartment.id && person.role === 'EMPLOYEE')
    : [], [selectedDepartment, staffMembers]);

  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter(item => {
      if (filter !== 'ALL' && item.department_type !== filter) return false;
      if (!term) return true;
      const head = staffById.get(item.head_user_id ?? '')?.full_name ?? '';
      return [item.name, item.code ?? '', item.department_type ?? '', head]
        .some(value => value.toLocaleLowerCase().includes(term));
    });
  }, [items, filter, search, staffById]);

  const assigned = items.filter(item => Boolean(item.head_user_id && staffById.has(item.head_user_id))).length;

  function openCreate() {
    setName(''); setCode(''); setKind('OFFICE'); setCandidate(''); setError(''); setMessage('');
    setModal({ kind: 'create' });
  }
  function openEdit(item: Department) {
    setName(item.name); setCode(item.code ?? ''); setKind(item.department_type ?? 'OFFICE');
    setCandidate(''); setError(''); setMessage('');
    setModal({ kind: 'edit', departmentId: item.id });
  }
  function openAssign(item: Department) {
    setCandidate(''); setError(''); setMessage('');
    setModal({ kind: 'head', departmentId: item.id });
  }
  function closeModal() { if (!busy) { setModal(null); setError(''); } }

  async function saveDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !modal || modal.kind === 'head') return;
    const action = modal.kind === 'create' ? 'CREATE' : 'UPDATE';
    if (name.trim().length < 2) { setError('Department name must be at least 2 characters.'); return; }
    setBusy(true); setError(''); setMessage('');
    try {
      const endpoint = action === 'UPDATE' ? '/api/proxy/manage-department' : '/api/proxy/manage-department-records';
      const payload = {
        action,
        department_id: modal.kind === 'edit' ? modal.departmentId : undefined,
        name: name.trim(), code: code.trim(), department_type: kind,
      };
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Could not save department.');
      if (action === 'CREATE') {
        if (data.department?.id) {
          setItems(old => [...old, data.department].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else if (modal.kind === 'edit') {
        const id = modal.departmentId;
        setItems(old => old.map(item => item.id === id ? {
          ...item, name: name.trim(), code: code.trim().toUpperCase() || null,
          department_type: kind,
        } : item));
      }
      setModal(null);
      setMessage(action === 'CREATE' ? 'Department created successfully.' : 'Department updated successfully.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Department operation failed.');
    } finally { setBusy(false); }
  }

  async function deleteDepartment(item: Department) {
    if (busy) return;
    if (!window.confirm(`Permanently delete “${item.name}”? This is blocked if staff or other records reference it.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/proxy/manage-department-records', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE', department_id: item.id }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to delete department.');
      setItems(old => old.filter(row => row.id !== item.id));
      setMessage('Department deleted successfully.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete department.');
    } finally { setBusy(false); }
  }

  async function assignHead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !candidate || modal?.kind !== 'head' || !selectedDepartment) return;
    const previousName = staffById.get(selectedDepartment.head_user_id ?? '')?.full_name;
    const nextName = staffById.get(candidate)?.full_name;
    if (!window.confirm(`Assign ${nextName || 'selected employee'} as Department Head?${previousName ? `\n${previousName} will become Employee.` : ''}`)) return;
    const departmentId = selectedDepartment.id;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/departments/assign-head', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department_id: departmentId, employee_id: candidate }),
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to assign department head.');
      setStaffMembers(old => old.map(person => person.department_id === departmentId
        ? { ...person, role: person.id === candidate ? 'DEPARTMENT_HEAD' : person.role === 'DEPARTMENT_HEAD' ? 'EMPLOYEE' : person.role }
        : person));
      setItems(old => old.map(item => item.id === departmentId ? { ...item, head_user_id: candidate } : item));
      setModal(null); setCandidate('');
      setMessage('New Department Head assigned. Previous Head changed to Employee.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to assign department head.');
    } finally { setBusy(false); }
  }

  return <section className={styles.directory} aria-label="Manage departments">
    <div className={styles.topRow}>
      <div className={styles.intro}>
        <div className={styles.eyebrow}>ORGANISATION SETUP</div>
        <h2>Department directory</h2>
        <p>Manage departments, teams and reporting heads in one place.</p>
      </div>
      <button type="button" className={styles.primaryButton} onClick={openCreate} disabled={busy}>
        <span className={styles.plus} aria-hidden="true">+</span> Create department
      </button>
    </div>

    <div className={styles.metrics} aria-label="Department summary">
      <div className={styles.metric}><span>Active departments</span><strong>{items.length}</strong></div>
      <div className={styles.metric}><span>Heads assigned</span><strong>{assigned}</strong></div>
      <div className={styles.metric}><span>Heads unassigned</span><strong>{items.length - assigned}</strong></div>
      <div className={styles.metric}><span>Team members</span><strong>{staffMembers.length}</strong></div>
    </div>

    <div className={styles.listPanel}>
      <div className={styles.toolbar}>
        <label className={styles.searchBox}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <span className={styles.visuallyHidden}>Search departments</span>
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search department, code or head" type="search" />
        </label>
        <span className={styles.resultCount}>{visible.length} of {items.length} departments</span>
      </div>
      <div className={styles.filterRow} role="group" aria-label="Filter department type">
        {filters.map(option => <button key={option.value} type="button"
          className={`${styles.filterButton} ${filter === option.value ? styles.filterActive : ''}`}
          aria-pressed={filter === option.value} onClick={() => setFilter(option.value)}>
          {option.label}<span>{option.value === 'ALL' ? items.length : items.filter(item => item.department_type === option.value).length}</span>
        </button>)}
      </div>
      {message && <p role="status" className={styles.successNotice}>{message}</p>}
      {error && !modal && <p role="alert" className={styles.errorNotice}>{error}</p>}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr><th>Department</th><th>Code</th><th>Type</th><th>Department Head</th><th>Actions</th></tr></thead>
          <tbody>
            {visible.map(item => {
              const head = staffById.get(item.head_user_id ?? '');
              return <tr key={item.id}>
                <td data-label="Department">
                  <div className={styles.departmentCell}>
                    <span className={styles.departmentAvatar} aria-hidden="true">{initials(item.name)}</span>
                    <div><strong>{item.name}</strong><small>Active department</small></div>
                  </div>
                </td>
                <td data-label="Code"><span className={styles.codeBadge}>{item.code || '—'}</span></td>
                <td data-label="Type"><span className={`${styles.typeBadge} ${item.department_type === 'STORE' ? styles.store : item.department_type === 'WAREHOUSE' ? styles.warehouse : styles.office}`}><span className={styles.typeDot}/>{TYPE_LABELS[item.department_type ?? ''] || item.department_type || '—'}</span></td>
                <td data-label="Head"><div className={styles.headCell}>
                  {head ? <span className={styles.headName}><span className={styles.headAvatar}>{initials(head.full_name || head.employee_code || 'Head')}</span><span title={head.full_name || ''}>{head.full_name || head.employee_code}</span></span> : <span className={styles.unassigned}><span className={styles.unassignedDot}/>Unassigned</span>}
                  <button type="button" className={styles.headButton} disabled={busy} onClick={() => openAssign(item)}>{head ? 'Change' : 'Assign'}</button>
                </div></td>
                <td data-label="Actions"><div className={styles.rowActions}>
                  <button type="button" className={styles.editButton} onClick={() => openEdit(item)} disabled={busy}>Edit</button>
                  <button type="button" className={styles.deleteButton} onClick={() => deleteDepartment(item)} disabled={busy}>Delete</button>
                </div></td>
              </tr>;
            })}
          </tbody>
        </table>
        {visible.length === 0 && <div className={styles.empty}>
          <strong>No matching departments</strong>
          <p>{items.length ? 'Try a different search or department type.' : 'Create your first department to get started.'}</p>
          {items.length > 0 && <button type="button" className={styles.clearButton} onClick={() => {setSearch('');setFilter('ALL');}}>Clear filters</button>}
        </div>}
      </div>
      <div className={styles.footer}><span className={styles.footerDot}/>Only active departments are shown. Deletion is blocked when records reference a department.</div>
    </div>

    {modal && <div className={styles.overlay} role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="wm-dept-modal-title" className={styles.modal}>
        <div className={styles.modalHeader}>
          <div><span className={styles.modalEyebrow}>{modal.kind === 'head' ? 'REPORTING STRUCTURE' : 'DEPARTMENT DETAILS'}</span>
            <h3 id="wm-dept-modal-title">{modal.kind === 'create' ? 'Create department' : modal.kind === 'edit' ? 'Edit department' : 'Assign Department Head'}</h3>
          </div>
          <button type="button" aria-label="Close dialog" className={styles.closeButton} onClick={closeModal} disabled={busy}>×</button>
        </div>
        {modal.kind === 'head' ? <form onSubmit={assignHead} className={styles.modalBody}>
          <p className={styles.modalDescription}>Choose an employee from <strong>{selectedDepartment?.name}</strong> to lead this department.</p>
          {selectedDepartment?.head_user_id && <div className={styles.currentHead}>Current Head <strong>{staffById.get(selectedDepartment.head_user_id)?.full_name || 'Assigned'}</strong></div>}
          <label className={styles.field}>New department head
            <select required value={candidate} onChange={event => setCandidate(event.target.value)} disabled={busy}>
              <option value="">Select an employee</option>
              {candidateStaff.map(person => <option key={person.id} value={person.id}>{person.full_name || person.employee_code || person.id}{person.employee_code ? ` (${person.employee_code})` : ''}</option>)}
            </select>
          </label>
          {candidateStaff.length === 0 && <p className={styles.helper}>No eligible employees available in this department.</p>}
          <p className={styles.headWarning}>Only one Head is allowed. The existing Head automatically becomes an Employee when you assign a new one.</p>
          {error && <p role="alert" className={styles.errorNotice}>{error}</p>}
          <div className={styles.modalActions}><button type="button" className={styles.cancelButton} onClick={closeModal} disabled={busy}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={busy || !candidate}>{busy ? 'Assigning…' : 'Confirm assignment'}</button></div>
        </form> : <form onSubmit={saveDepartment} className={styles.modalBody}>
          <label className={styles.field}>Department name <span>*</span>
            <input required autoFocus minLength={2} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Customer Support" disabled={busy}/>
          </label>
          <label className={styles.field}>Department code
            <input maxLength={30} value={code} onChange={event => setCode(event.target.value)} placeholder="e.g. CS01" disabled={busy}/>
          </label>
          <label className={styles.field}>Workplace type
            <select value={kind} onChange={event => setKind(event.target.value)} disabled={busy}><option value="OFFICE">Office</option><option value="STORE">Store</option><option value="WAREHOUSE">Warehouse</option></select>
          </label>
          {error && <p role="alert" className={styles.errorNotice}>{error}</p>}
          <div className={styles.modalActions}><button type="button" className={styles.cancelButton} onClick={closeModal} disabled={busy}>Cancel</button><button type="submit" className={styles.primaryButton} disabled={busy || name.trim().length < 2}>{busy ? 'Saving…' : modal.kind === 'edit' ? 'Save changes' : 'Create department'}</button></div>
        </form>}
      </section>
    </div>}
  </section>;
}
