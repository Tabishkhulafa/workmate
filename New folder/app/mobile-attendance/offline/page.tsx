'use client';
import { useEffect, useState } from 'react';
import { clearDrafts, deleteDraft, exportDraftsCsv, readDrafts, saveDraft, type AttendanceDraft } from '@/lib/mobile-attendance/offline-drafts';

type Office = { id: string; name: string };
export default function OfflineAttendanceDrafts() {
  const [drafts, setDrafts] = useState<AttendanceDraft[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [officeId, setOfficeId] = useState('');
  const [action, setAction] = useState<'CLOCK_IN' | 'CLOCK_OUT'>('CLOCK_IN');
  const [message, setMessage] = useState('');
  const refresh = () => setDrafts(readDrafts());
  useEffect(() => {
    refresh();
    let alive = true;
    fetch('/api/locations', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error('Office list unavailable');
        return r.json() as Promise<{ locations?: Office[] }>;
      })
      .then((result) => { if (alive) setOffices(result.locations ?? []); })
      .catch(() => { if (alive) setMessage('Office locations require internet. Saved drafts remain available on this device.'); });
    return () => { alive = false; };
  }, []);
  const downloadDrafts = () => {
    const csv = exportDraftsCsv(drafts);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'workmate-offline-drafts-NOT-ATTENDANCE.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };
  const create = () => {
    try { saveDraft(action, officeId); refresh(); setMessage('Draft saved locally. Attendance has NOT been recorded.'); }
    catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save draft'); }
  };
  return <main style={{ maxWidth: 850, margin: '32px auto', padding: 24 }}>
    <h1>Offline attendance drafts</h1>
    <p>Drafts are personal reminders, not verified punches. Reopen live Face + GPS attendance when online. No automatic submission.</p>
    <div className="card" style={{ display: 'grid', gap: 12, marginBottom: 24 }}>
      <label>Office <select value={officeId} onChange={(e) => setOfficeId(e.target.value)}>
        <option value="">Choose an office</option>{offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
      </select></label>
      <label>Intended action <select value={action} onChange={(e) => setAction(e.target.value as 'CLOCK_IN' | 'CLOCK_OUT')}>
        <option value="CLOCK_IN">Clock In</option><option value="CLOCK_OUT">Clock Out</option>
      </select></label>
      <button type="button" onClick={create} disabled={!officeId}>Save draft (not attendance)</button>
    </div>
    <h2>Saved drafts ({drafts.length})</h2>
    {drafts.length === 0 ? <p>No saved drafts.</p> : <div className="card">
      {drafts.map((draft) => <div key={draft.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span>{draft.action === 'CLOCK_IN' ? 'Clock In' : 'Clock Out'} · {new Date(draft.created_at).toLocaleString()} · {offices.find((o) => o.id === draft.office_id)?.name ?? draft.office_id}</span>
        <button className="secondary" type="button" onClick={() => { deleteDraft(draft.id); refresh(); }}>Delete</button>
      </div>)}
      <button className="secondary" type="button" onClick={downloadDrafts}>Download drafts CSV (not attendance)</button>
      <button className="secondary" type="button" onClick={() => { clearDrafts(); refresh(); }}>Clear all drafts</button>
    </div>}
    <p role="status">{message}</p>
    <a href="/mobile-attendance">Open live attendance</a>
  </main>;
}
