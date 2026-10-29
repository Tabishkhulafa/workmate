'use client';

import { useMemo, useState, type FormEvent } from 'react';
import styles from './regularization-form.module.css';

type RequestType = 'MISSING_ATTENDANCE' | 'INCORRECT_CLOCK_IN' | 'INCORRECT_CLOCK_OUT';
const OPTIONS: { value: RequestType; label: string; description: string }[] = [
  { value: 'MISSING_ATTENDANCE', label: 'Attendance Miss', description: 'Neither Clock In nor Clock Out was recorded. Enter both times.' },
  { value: 'INCORRECT_CLOCK_IN', label: 'Fix Clock In Time', description: 'Correct only Clock In. Your existing Clock Out will be kept.' },
  { value: 'INCORRECT_CLOCK_OUT', label: 'Fix Clock Out Time', description: 'Correct only Clock Out. Your existing Clock In will be kept.' },
];

function indiaDate() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function dayAfter(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
}

// Clock correction inputs are office-local times, NOT the device's timezone.
// Pass full ISO instants so Safari, Chrome and Supabase agree on IST.
function asIST(date: string, time: string, nextDay = false) {
  const localDate = nextDay ? dayAfter(date) : date;
  const iso = new Date(`${localDate}T${time}:00+05:30`);
  if (Number.isNaN(iso.getTime())) throw new Error('Enter a valid clock time.');
  return iso.toISOString();
}

export function RegularizationForm() {
  const [date, setDate] = useState('');
  const [type, setType] = useState<RequestType>('MISSING_ATTENDANCE');
  const [clockIn, setClockIn] = useState('');
  const [clockOut, setClockOut] = useState('');
  const [clockOutNextDay, setClockOutNextDay] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const today = indiaDate();
  const needsIn = type === 'MISSING_ATTENDANCE' || type === 'INCORRECT_CLOCK_IN';
  const needsOut = type === 'MISSING_ATTENDANCE' || type === 'INCORRECT_CLOCK_OUT';
  const selected = useMemo(() => OPTIONS.find(option => option.value === type)!, [type]);

  function resetType(nextType: RequestType) {
    setType(nextType);
    setClockIn('');
    setClockOut('');
    setClockOutNextDay(false);
    setError('');
    setSuccess('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setSuccess('');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) {
      setError('Select a valid attendance date (today or earlier).');
      return;
    }
    if (type === 'MISSING_ATTENDANCE' && date === today) {
      setError('Missing attendance can be regularized after the attendance day ends. Please select an earlier date.');
      return;
    }
    if ((needsIn && !clockIn) || (needsOut && !clockOut)) {
      setError('Fill the required Clock In / Clock Out time.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Please enter a reason of at least 5 characters.');
      return;
    }
    try {
      const requestedIn = needsIn ? asIST(date, clockIn) : null;
      const requestedOut = needsOut ? asIST(date, clockOut, clockOutNextDay) : null;
      if (requestedIn && requestedOut && new Date(requestedOut) <= new Date(requestedIn)) {
        throw new Error('Clock Out must be after Clock In. For overnight shifts, select “Clock Out was next day”.');
      }
      if (requestedIn && new Date(requestedIn) > new Date()) {
        throw new Error('Corrected Clock In cannot be in the future.');
      }
      if (requestedOut && new Date(requestedOut) > new Date()) {
        throw new Error('Corrected Clock Out cannot be in the future.');
      }
      setBusy(true);
      const response = await fetch('/api/proxy/submit-attendance-regularization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attendance_date: date,
          request_type: type,
          requested_clock_in: requestedIn,
          requested_clock_out: requestedOut,
          reason: reason.trim(),
        }),
      });
      const result: { error?: string; message?: string; success?: boolean } = await response.json();
      if (!response.ok || result.error || result.success !== true) {
        throw new Error(result.error || result.message || 'Unable to submit the request.');
      }
      setSuccess('Request submitted! Attendance will update only after HR / an authorized reviewer approves it.');
      setClockIn('');
      setClockOut('');
      setClockOutNextDay(false);
      setReason('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit the request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`card ${styles.form}`} onSubmit={submit}>
      <div className={styles.intro}>
        <span className={styles.step}>01</span>
        <div>
          <h2>Request attendance correction</h2>
          <p>Dates and times are in India Standard Time (IST).</p>
        </div>
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Attendance date <b aria-hidden="true">*</b></span>
          <input type="date" value={date} max={today} onChange={e => { setDate(e.target.value); setError(''); }} required />
        </label>
        <label className={styles.field}>
          <span>What needs fixing? <b aria-hidden="true">*</b></span>
          <select value={type} onChange={e => resetType(e.target.value as RequestType)}>
            {OPTIONS.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      <p className={styles.hint} role="note">{selected.description}</p>
      <div className={styles.fields}>
        {needsIn && <label className={styles.field}>
          <span>Correct Clock In time (IST) <b aria-hidden="true">*</b></span>
          <input type="time" value={clockIn} onChange={e => setClockIn(e.target.value)} required />
        </label>}
        {needsOut && <label className={styles.field}>
          <span>Correct Clock Out time (IST) <b aria-hidden="true">*</b></span>
          <input type="time" value={clockOut} onChange={e => setClockOut(e.target.value)} required />
        </label>}
      </div>
      {needsOut && <label className={styles.checkbox}>
        <input type="checkbox" checked={clockOutNextDay} onChange={e => setClockOutNextDay(e.target.checked)} />
        <span>Clock Out was after midnight (next calendar day)</span>
      </label>}

      <label className={styles.field}>
        <span>Reason for correction <b aria-hidden="true">*</b></span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} minLength={5} maxLength={500} required placeholder="Example: I missed my Clock Out after completing my shift" />
      </label>
      <p className={styles.footnote}>
        Submission creates an approval request. Your saved Clock In/Out and attendance status remain unchanged until approval.
      </p>
      <button className={styles.submit} type="submit" disabled={busy}>
        {busy ? 'Submitting request…' : 'Submit regularization request'}
      </button>
      {error && <div className={styles.error} role="alert">{error}</div>}
      {success && <div className={styles.success} role="status">{success}</div>}
    </form>
  );
}
