/** Read-only location classification for the organisation attendance display.
 * Comparisons use GPS-matched office_locations IDs, never user-entered text or a selected dropdown label.
 */
export type SiteMatch = 'ON_SITE' | 'OFF_SITE' | 'UNASSIGNED' | 'UNKNOWN';
export type PunchSite = { match: SiteMatch; actualSite: string | null };
export type AttendanceSites = { clockIn: PunchSite | null; clockOut: PunchSite | null };

export function classifyPunchSite(
  punched: boolean,
  assignedLocationId: string | null | undefined,
  actualLocationId: string | null | undefined,
  siteNames: ReadonlyMap<string, string>,
): PunchSite | null {
  if (!punched) return null;
  if (!actualLocationId) return { match: 'UNKNOWN', actualSite: null };
  const actualSite = siteNames.get(actualLocationId) ?? 'Site name unavailable';
  if (!assignedLocationId) return { match: 'UNASSIGNED', actualSite };
  return {
    match: assignedLocationId === actualLocationId ? 'ON_SITE' : 'OFF_SITE',
    actualSite,
  };
}
