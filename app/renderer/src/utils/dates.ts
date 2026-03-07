export const isoNow = (): string => new Date().toISOString();
export const dayStart = (): string => new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
