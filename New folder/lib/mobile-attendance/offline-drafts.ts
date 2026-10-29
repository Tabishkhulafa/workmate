export type AttendanceDraft = {
  id: string;
  action: 'CLOCK_IN' | 'CLOCK_OUT';
  office_id: string;
  created_at: string;
};

const STORAGE_KEY = 'workmate_offline_attendance_drafts_v1';
const MAX_DRAFTS = 20;

function isDraft(value: unknown): value is AttendanceDraft {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return typeof item.id === 'string' &&
    (item.action === 'CLOCK_IN' || item.action === 'CLOCK_OUT') &&
    typeof item.office_id === 'string' &&
    typeof item.created_at === 'string';
}

export function readDrafts(): AttendanceDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter(isDraft).slice(-MAX_DRAFTS) : [];
  } catch { return []; }
}

export function saveDraft(action: AttendanceDraft['action'], office_id: string): AttendanceDraft {
  if (typeof window === 'undefined') throw new Error('Drafts require a browser');
  if (action !== 'CLOCK_IN' && action !== 'CLOCK_OUT') throw new Error('Invalid attendance action');
  if (!office_id.trim()) throw new Error('Select an office location');
  const draft: AttendanceDraft = {
    id: window.crypto.randomUUID(), action, office_id: office_id.trim(), created_at: new Date().toISOString(),
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...readDrafts(), draft].slice(-MAX_DRAFTS)));
  return draft;
}

export function deleteDraft(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(readDrafts().filter((draft) => draft.id !== id)));
}

export function clearDrafts(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

function csvValue(value: string): string { return '"' + value.replace(/"/g, '""') + '"'; }

/** Export local reminders only. Never imply these are recorded attendance. */
export function exportDraftsCsv(drafts: AttendanceDraft[] = readDrafts()): string {
  const rows = ['draft_id,intended_action,office_id,draft_created_at_utc,status'];
  for (const draft of drafts) rows.push([
    csvValue(draft.id),csvValue(draft.action),csvValue(draft.office_id),csvValue(draft.created_at),csvValue('NOT_SUBMITTED'),
  ].join(','));
  return rows.join('\r\n') + '\r\n';
}

// Never store camera captures, face embeddings, biometric tokens or GPS proof here.
// These drafts NEVER trigger attendance submission, even when connectivity returns.
