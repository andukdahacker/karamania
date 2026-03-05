export function toUnixMs(): number {
  return Date.now();
}

export function toISOString(ms: number): string {
  return new Date(ms).toISOString();
}
