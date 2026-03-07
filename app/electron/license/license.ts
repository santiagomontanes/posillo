import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuid } from 'uuid';

type LicensePlan = 'MONTHLY' | 'YEARLY' | 'LIFETIME';

type LicenseState = {
  machineId: string;
  licenseKey?: string;
  plan?: LicensePlan;
  expiresAt?: string | null;
  lastCheckAt?: string;
  graceDays?: number;
};

const licenseDir = path.join(app.getPath('userData'), 'license');
const machineFile = path.join(licenseDir, 'machine.json');
const licenseFile = path.join(licenseDir, 'license.json');

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  "https://awutehzbhhklcgodmluq.supabase.co";

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF3dXRlaHpiaGhrbGNnb2RtbHVxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI3MjU1NDcsImV4cCI6MjA4ODMwMTU0N30.Rtzda_lwrYxSjLSRORZ8ow2k4y7lZC5XjUMnN3qOIqs";

const VALIDATE_FN = `${SUPABASE_URL}/functions/v1/validate-license`;

const ensureDir = (): void => {
  fs.mkdirSync(licenseDir, { recursive: true });
};

const readJson = <T>(file: string, fallback: T): T => {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
};

const writeJson = (file: string, data: unknown): void => {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
};

const nowMs = (): number => Date.now();

const isoToMs = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
};

export const getMachineId = (): string => {
  ensureDir();

  if (!fs.existsSync(machineFile)) {
    const id = uuid();
    writeJson(machineFile, { id });
    return id;
  }

  const data = readJson<{ id?: string }>(machineFile, {});
  if (!data.id) {
    const id = uuid();
    writeJson(machineFile, { id });
    return id;
  }

  return data.id;
};

const readLicenseState = (): LicenseState => {
  const machineId = getMachineId();

  return readJson<LicenseState>(licenseFile, {
    machineId,
    graceDays: 7,
  });
};

const saveLicenseState = (state: Partial<LicenseState>): void => {
  const current = readLicenseState();

  const next: LicenseState = {
    ...current,
    ...state,
    machineId: current.machineId || getMachineId(),
    graceDays: Number(state.graceDays ?? current.graceDays ?? 7),
  };

  writeJson(licenseFile, next);
};

export const getSavedLicenseKey = (): string | null => {
  const s = readLicenseState();
  return s.licenseKey ? String(s.licenseKey) : null;
};

export const clearLicenseState = (): void => {
  ensureDir();
  if (fs.existsSync(licenseFile)) {
    fs.unlinkSync(licenseFile);
  }
};

export const licenseStatusLocal = (): {
  ok: boolean;
  reason?: string;
  state: LicenseState;
} => {
  const s = readLicenseState();
  const graceDays = Number(s.graceDays ?? 7);

  if (!s.licenseKey) {
    return { ok: false, reason: 'NO_LICENSE', state: s };
  }

  if (!s.lastCheckAt) {
    return { ok: false, reason: 'NEVER_VALIDATED', state: s };
  }

  const lastCheckMs = isoToMs(s.lastCheckAt);
  if (!lastCheckMs) {
    return { ok: false, reason: 'INVALID_LAST_CHECK', state: s };
  }

  const now = nowMs();

  if (s.expiresAt) {
    const expMs = isoToMs(s.expiresAt);
    if (expMs && now <= expMs) {
      return { ok: true, state: s };
    }
  } else if (s.plan === 'LIFETIME') {
    return { ok: true, state: s };
  }

  const graceUntil = lastCheckMs + graceDays * 24 * 60 * 60 * 1000;
  if (now <= graceUntil) {
    return { ok: true, reason: 'OFFLINE_GRACE', state: s };
  }

  return { ok: false, reason: 'LICENSE_EXPIRED_AND_GRACE_ENDED', state: s };
};

const validateAgainstSupabase = async (
  licenseKey: string,
): Promise<{ ok: boolean; message?: string }> => {
  const machineId = getMachineId();

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { ok: false, message: 'MISSING_SUPABASE_ENV' };
  }

  try {
    const res = await fetch(VALIDATE_FN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        licenseKey,
        machineId,
      }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        message: data?.message || data?.error || `HTTP_${res.status}`,
      };
    }

    saveLicenseState({
      licenseKey,
      plan: data.plan,
      expiresAt: data.expiresAt ?? null,
      lastCheckAt: data.serverTime ?? new Date().toISOString(),
      graceDays: Number(data.graceDays ?? 7),
    });

    return { ok: true };
  } catch (error: any) {
    return {
      ok: false,
      message: error?.message || 'NETWORK_OR_SUPABASE_ERROR',
    };
  }
};

export const activateOnline = async (
  licenseKey: string,
): Promise<{ ok: boolean; message?: string }> => {
  const key = String(licenseKey ?? '').trim();
  if (!key) return { ok: false, message: 'LICENSE_REQUIRED' };

  return await validateAgainstSupabase(key);
};

export const checkOnline = async (): Promise<{ ok: boolean; message?: string }> => {
  const key = getSavedLicenseKey();
  if (!key) return { ok: false, message: 'NO_LICENSE' };

  return await validateAgainstSupabase(key);
};