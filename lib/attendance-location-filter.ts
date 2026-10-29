/** Apply the employee's assigned work location to attendance reports (never GPS punch location). */
export type WorkmateLocation = {id: string; name: string; is_default?: boolean};
export const ALL_WORK_LOCATIONS = 'all';

export function attendanceLocationSelection(locations: WorkmateLocation[], requested: string | null | undefined) {
  const sitafalwadi = locations.find(x => /^sitafalwadi(?:\s+office)?$/i.test(x.name.trim()));
  // Sitafalwadi is the requested default, independent of any future DB default change.
  const defaultId = sitafalwadi?.id || locations.find(x => x.is_default)?.id;
  const selected = requested?.trim() || defaultId || ALL_WORK_LOCATIONS;
  if (selected !== ALL_WORK_LOCATIONS && !locations.some(x => x.id === selected)) {
    return {selected, valid: false, label: 'Invalid location'};
  }
  return {selected, valid: true, label: selected === ALL_WORK_LOCATIONS ? 'All locations' : locations.find(x => x.id === selected)?.name || 'Unknown'};
}
