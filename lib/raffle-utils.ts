/**
 * Mask customer names for public community displays to prevent customer enumeration,
 * scraping, and social engineering attacks while preserving authentic community engagement.
 */
export function maskWinnerName(name?: string | null): string {
  if (!name || !name.trim()) return "Verified Customer";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    const n = parts[0];
    if (n.length <= 2) return `${n[0]}***`;
    return `${n.slice(0, 2)}***`;
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
  return `${first} ${lastInitial}.***`;
}

