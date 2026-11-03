/**
 * Auto-assignment: the active consultant with the fewest open enquiries gets the new one;
 * ties go to whoever was assigned least recently, so work spreads evenly.
 */
export type ConsultantLoad = { id: string; name: string; open: number; lastAssignedAt: Date | null };

export function pickConsultant(consultants: ConsultantLoad[]): ConsultantLoad | null {
  if (consultants.length === 0) return null;
  return [...consultants].sort((a, b) => a.open - b.open || (a.lastAssignedAt?.getTime() ?? 0) - (b.lastAssignedAt?.getTime() ?? 0) || a.name.localeCompare(b.name))[0];
}
