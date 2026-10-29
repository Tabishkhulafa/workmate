'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock3, Download, Pencil, Plus, Search, Trash2, X, CheckCircle2 } from 'lucide-react';
import styles from './shift-management.module.css';

export type Shift = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean | null;
  fields: Record<string, string>;
};
type FormState = { name: string; start_time: string; end_time: string; required_work_minutes: string; half_day_minutes: string };
const blank: FormState = { name: '', start_time: '10:30', end_time: '19:30', required_work_minutes: '540', half_day_minutes: '270' };
const csv = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"';
const minutes = (value: string) => { const [h, m] = value.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const shortTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const [h, m] = value.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return value;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const clockSpan = (from: string, to: string) => {
  const delta = (minutes(to) - minutes(from) + 1440) % 1440;
  return `${Math.floor(delta / 60)}h ${String(delta % 60).padStart(2, '0')}m`;
};
const fmtMinutes = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.floor(n / 60)}h ${String(n % 60).padStart(2, '0')}m` : '—';
};

export default function ShiftTable({ shifts, readOnly }: { shifts: Shift[]; readOnly: boolean }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const active = shifts.filter(s => s.is_active === true).length;
  const filtered = useMemo(() => shifts.filter(s =>
    (filter === 'all' || (filter === 'active' ? s.is_active === true : s.is_active === false)) &&
    [s.name, s.start_time, s.end_time].join(' ').toLowerCase().includes(search.toLowerCase().trim())
  ), [shifts, filter, search]);
  const overnight = shifts.filter(s => s.is_active && minutes(s.end_time) < minutes(s.start_time)).length;

  function edit(s: Shift) {
    setSelected(s.id);
    setMessage(null);
    setForm({ name: s.name, start_time: s.start_time.slice(0, 5), end_time: s.end_time.slice(0, 5), required_work_minutes: s.fields.required_work_minutes || '540', half_day_minutes: s.fields.half_day_minutes || '270' });
  }
  function create() { setSelected('new'); setForm(blank); setMessage(null); }
  function checkForm() {
    const full = Number(form.required_work_minutes), half = Number(form.half_day_minutes);
    if (form.name.trim().length < 2 || !form.start_time || !form.end_time) return 'Enter a shift name and valid start/end times.';
    if (form.start_time === form.end_time) return 'Start and end time cannot be the same.';
    if (!Number.isInteger(full) || full < 60 || full > 1440 || !Number.isInteger(half) || half < 30 || half >= full) return 'Full-day minutes must be 60–1440 and half-day minutes must be at least 30, below full-day.';
    return null;
  }
  async function submit(action: 'CREATE' | 'UPDATE' | 'DEACTIVATE' | 'ACTIVATE' | 'DELETE', shiftId?: string) {
    if (busy || readOnly) return;
    if ((action === 'CREATE' || action === 'UPDATE')) { const error = checkForm(); if (error) { setMessage({ kind: 'error', text: error }); return; } }
    if (action === 'DELETE' && !window.confirm('Permanently delete this shift? Linked shifts cannot be deleted. This cannot be undone.')) return;
    if (action === 'DEACTIVATE' && !window.confirm('Deactivate this shift? Existing attendance records remain unchanged.')) return;
    if (action === 'ACTIVATE' && !window.confirm('Reactivate this shift?')) return;
    setBusy(true); setMessage(null);
    try {
      const payload = action === 'CREATE' || action === 'UPDATE'
        ? { action, shift_id: shiftId, ...form, name: form.name.trim(), required_work_minutes: Number(form.required_work_minutes), half_day_minutes: Number(form.half_day_minutes) }
        : { action, shift_id: shiftId };
      const response = await fetch('/api/proxy/manage-shift', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { success?: boolean; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || `Shift ${action.toLowerCase()} failed (HTTP ${response.status}).`);
      setSelected(null);
      setMessage({ kind: 'success', text: `Shift ${action === 'CREATE' ? 'created' : action === 'DELETE' ? 'deleted' : 'updated'} successfully.` });
      router.refresh();
    } catch (error) { setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Unable to save shift.' }); }
    finally { setBusy(false); }
  }
  function exportCSV() {
    const rows = [['Shift', 'Start', 'End', 'Status', 'Full-day minutes', 'Half-day minutes'], ...filtered.map(s => [s.name, s.start_time, s.end_time, s.is_active ? 'Active' : 'Inactive', s.fields.required_work_minutes || '', s.fields.half_day_minutes || ''])];
    const blob = new Blob(['\uFEFF' + rows.map(row => row.map(csv).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'workmate-shifts.csv'; anchor.click(); URL.revokeObjectURL(url);
  }

  return <section className={styles.section} aria-label="Shift catalogue">
    <div className={styles.metricGrid}>
      <div className={styles.metric}><span>Shift templates</span><strong>{shifts.length}</strong><small>Configured schedules</small></div>
      <div className={styles.metric}><span>Active shifts</span><strong>{active}</strong><small>Available for assignment</small></div>
      <div className={styles.metric}><span>Inactive shifts</span><strong>{shifts.length - active}</strong><small>Preserved for history</small></div>
      <div className={styles.metric}><span>Overnight shifts</span><strong>{overnight}</strong><small>Cross midnight</small></div>
    </div>

    <div className={styles.panel}>
      <div className={styles.panelHeading}>
        <div><span className={styles.kicker}>01 / SHIFT LIBRARY</span><h2>Shift templates</h2><p>Create schedules and set full-day / half-day thresholds.</p></div>
        <button className={styles.primaryButton} disabled={busy || readOnly} type="button" onClick={create}><Plus size={17}/> New shift</button>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}><Search size={18}/><input aria-label="Search shifts" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by shift name or time"/></label>
        <label className={styles.filter}><span>Show</span><select aria-label="Filter shift status" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="all">All shifts</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
        <button className={styles.outlineButton} type="button" onClick={exportCSV}><Download size={16}/> Export CSV ({filtered.length})</button>
      </div>
      {message && <p role="status" className={`${styles.message} ${message.kind === 'error' ? styles.messageError : styles.messageSuccess}`}>{message.text}</p>}

      {overnight > 0 && <div className={styles.overnightNotice}><Clock3 size={18}/><p><strong>Overnight shift warning:</strong> The current attendance backend blocks Clock Out after midnight. Night-shift schedules can be listed here, but a separate tested backend change is required before overnight attendance works end to end.</p></div>}
      {selected && <div className={styles.editor}>
        <div className={styles.editorHeading}><div><h3>{selected === 'new' ? 'Create a new shift' : 'Edit shift'}</h3><p>Times are in IST. Existing attendance history is never recalculated.</p></div><button aria-label="Close editor" type="button" className={styles.iconButton} disabled={busy} onClick={() => setSelected(null)}><X size={18}/></button></div>
        <div className={styles.editorGrid}>
          {([{ key: 'name', label: 'Shift name', type: 'text' }, { key: 'start_time', label: 'Shift starts', type: 'time' }, { key: 'end_time', label: 'Shift ends', type: 'time' }, { key: 'required_work_minutes', label: 'Full-day minutes', type: 'number' }, { key: 'half_day_minutes', label: 'Half-day minutes', type: 'number' }] as { key: keyof FormState; label: string; type: string }[]).map(item => <label key={item.key} className={styles.field}><span>{item.label}</span><input type={item.type} min={item.type === 'number' ? '1' : undefined} maxLength={item.key === 'name' ? 100 : undefined} value={form[item.key]} onChange={event => setForm(previous => ({ ...previous, [item.key]: event.target.value }))}/></label>)}
        </div>
        <div className={styles.previewLine}><Clock3 size={16}/> {shortTime(form.start_time)} – {shortTime(form.end_time)} {form.start_time && form.end_time && form.start_time !== form.end_time ? ` · ${clockSpan(form.start_time, form.end_time)} span${minutes(form.end_time) < minutes(form.start_time) ? ' · Ends next day' : ''}` : ''} · Full day {fmtMinutes(form.required_work_minutes)} · Half day {fmtMinutes(form.half_day_minutes)}</div>
        <div className={styles.buttonRow}><button type="button" className={styles.primaryButton} disabled={busy || readOnly} onClick={() => void submit(selected === 'new' ? 'CREATE' : 'UPDATE', selected === 'new' ? undefined : selected)}>{busy ? 'Saving…' : 'Save shift'}</button><button className={styles.outlineButton} type="button" disabled={busy} onClick={() => setSelected(null)}>Cancel</button></div>
      </div>}

      <div className={styles.shiftGrid}>
        {filtered.map(shift => <article key={shift.id} className={styles.shiftCard}>
          <div className={styles.shiftCardTop}><span className={`${styles.status} ${shift.is_active ? styles.active : styles.inactive}`}>{shift.is_active ? <><CheckCircle2 size={13}/> Active</> : 'Inactive'}</span><span className={styles.miniLabel}>SHIFT</span></div>
          <h3>{shift.name}</h3>
          <div className={styles.timeBar}><Clock3 size={17}/><strong>{shortTime(shift.start_time)}</strong><span className={styles.timeArrow}>→</span><strong>{shortTime(shift.end_time)}</strong></div>
          <div className={styles.shiftMeta}><span>{clockSpan(shift.start_time, shift.end_time)} span</span>{minutes(shift.end_time) < minutes(shift.start_time) && <span className={styles.night}>Next day</span>}</div>
          <div className={styles.thresholds}><span>Full day <b>{fmtMinutes(shift.fields.required_work_minutes || '540')}</b></span><span>Half day <b>{fmtMinutes(shift.fields.half_day_minutes || '270')}</b></span></div>
          <div className={styles.cardActions}><button type="button" disabled={busy || readOnly} onClick={() => edit(shift)}><Pencil size={14}/> Edit</button><button type="button" disabled={busy || readOnly} onClick={() => void submit(shift.is_active ? 'DEACTIVATE' : 'ACTIVATE', shift.id)}>{shift.is_active ? 'Deactivate' : 'Activate'}</button><button className={styles.deleteButton} type="button" title="Delete shift" aria-label={`Delete ${shift.name}`} disabled={busy || readOnly} onClick={() => void submit('DELETE', shift.id)}><Trash2 size={14}/></button></div>
        </article>)}
      </div>
      {filtered.length === 0 && <div className={styles.empty}>No shifts match this search. Try another name or status.</div>}
    </div>
  </section>;
}
