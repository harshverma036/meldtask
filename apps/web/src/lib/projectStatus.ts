/**
 * Color palette for project status chips.
 * Known statuses get a consistent color; unknown ones get assigned from this palette
 * based on a hash of their name.
 */
const STATUS_COLORS = [
  "bg-purple-500/10 text-purple-400 border-purple-500/20",
  "bg-blue-500/10 text-blue-400 border-blue-500/20",
  "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  "bg-pink-500/10 text-pink-400 border-pink-500/20",
  "bg-green-500/10 text-green-400 border-green-500/20",
  "bg-gray-500/10 text-gray-400 border-gray-500/20",
  "bg-red-500/10 text-red-400 border-red-500/20",
  "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  "bg-lime-500/10 text-lime-400 border-lime-500/20",
] as const;

/** Known statuses with explicit color mappings for consistency */
const KNOWN_STATUS_MAP: Record<string, string> = {
  "brainstorming":     STATUS_COLORS[0],
  "planning":          STATUS_COLORS[1],
  "in progress":       STATUS_COLORS[2],
  "under development": STATUS_COLORS[3],
  "under testing":     STATUS_COLORS[4],
  "in review":         STATUS_COLORS[5],
  "completed":         STATUS_COLORS[6],
  "on hold":           STATUS_COLORS[7],
  "cancelled":         STATUS_COLORS[8],
};

/**
 * Simple string hash to assign a consistent color to any status string.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  return Math.abs(hash);
}

/**
 * Get the Tailwind color classes for a given status string.
 * Known statuses get their defined color; everything else gets a stable color
 * based on a hash of the string.
 */
export function getStatusColor(status: string): string {
  const key = status.toLowerCase().trim();
  const known = KNOWN_STATUS_MAP[key];
  if (known) {
    return known;
  }
  return STATUS_COLORS[hashString(key) % STATUS_COLORS.length]!;
}
