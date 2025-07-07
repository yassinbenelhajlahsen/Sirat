export default function getTimeUntil(nextTime: Date): string {
  const now = new Date();
  const diffMs = nextTime.getTime() - now.getTime();

  if (diffMs <= 0) return "Now";

  const seconds = Math.floor((diffMs / 1000) % 60);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}