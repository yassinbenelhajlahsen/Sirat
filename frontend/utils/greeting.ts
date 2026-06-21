export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  if (hour > 4  && hour < 12) return "Good morning";
  if (hour < 18 && hour > 4 ) return "Good afternoon";
  return "Good evening";
}

export function personalizeGreeting(greeting: string, firstName: string | null): string {
  if (firstName && firstName.length < 10) return `${greeting}, ${firstName}.`;
  return greeting;
}
