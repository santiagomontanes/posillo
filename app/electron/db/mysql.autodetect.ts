/**
 * mysql.autodetect.ts  — v2
 * =========================
 * Lee los archivos que dejó el instalador NSIS y configura
 * el POS automáticamente según el tipo de instalación:
 *
 *   PC SERVIDOR → MySQL local, pre-llena wizard con localhost
 *   PC CAJERO   → Sin MySQL, wizard abre en modo "conectar a servidor"
 */

import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { writeMySqlConfig, readMySqlConfig } from "./mysqlConfig";
import { checkDbInstalled } from "./dbInstaller";
import type { MySqlConfig } from "./mysqlConfig";

interface AutoInstallInfo {
  autoInstalled: boolean;
  installType: "server" | "cashier";
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface InstallTypeInfo {
  type: "server" | "cashier";
}

// ─────────────────────────────────────────────
// Leer archivos dejados por NSIS
// ─────────────────────────────────────────────
const readJson = <T>(filename: string): T | null => {
  try {
    const p = path.join(app.getPath("userData"), filename);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return null;
  }
};

const deleteFile = (filename: string): void => {
  try {
    const p = path.join(app.getPath("userData"), filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {}
};

// ─────────────────────────────────────────────
// Esperar a que MySQL esté listo
// ─────────────────────────────────────────────
const waitForMySQL = async (cfg: MySqlConfig, attempts = 10, delayMs = 2000): Promise<boolean> => {
  const { testMySqlConnection } = await import("./mysql");
  for (let i = 0; i < attempts; i++) {
    console.log(`[autodetect] Esperando MySQL... intento ${i + 1}/${attempts}`);
    const r = await testMySqlConnection(cfg).catch(() => ({ ok: false }));
    if (r.ok) return true;
    await new Promise(r => setTimeout(r, delayMs));
  }
  return false;
};

// ─────────────────────────────────────────────
// Tipos de resultado
// ─────────────────────────────────────────────
export type AutoDetectResult =
  | { status: "ready" }
  | { status: "server_auto"; config: MySqlConfig; dbInstalled: boolean }
  | { status: "cashier" }   // PC cajero: mostrar wizard en modo "conectar"
  | { status: "manual" };   // Sin info: wizard normal

// ─────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────
export const autoDetectAndConfigureMySQL = async (): Promise<AutoDetectResult> => {

  // ¿Ya hay config MySQL guardada y funcional?
  const existing = readMySqlConfig();
  if (existing?.host) {
    console.log("[autodetect] Config MySQL ya existe");
    return { status: "ready" };
  }

  // ¿El NSIS guardó el tipo de instalación?
  const installType = readJson<InstallTypeInfo>("install-type.json");

  // ── PC CAJERO ──
  if (installType?.type === "cashier") {
    console.log("[autodetect] PC Cajero detectado");
    deleteFile("install-type.json");
    return { status: "cashier" };
  }

  // ── PC SERVIDOR con MySQL auto-instalado ──
  const info = readJson<AutoInstallInfo>("mysql-install-info.json");

  if (!info?.host) {
    console.log("[autodetect] Sin info de instalación, modo manual");
    return { status: "manual" };
  }

  console.log("[autodetect] PC Servidor con MySQL auto-instalado, configurando...");

  const cfg: MySqlConfig = {
    host:     info.host,
    port:     info.port ?? 3306,
    user:     info.user,
    password: info.password,
    database: info.database,
  };

  const mysqlReady = await waitForMySQL(cfg);
  if (!mysqlReady) {
    console.warn("[autodetect] MySQL no respondió");
    return { status: "manual" };
  }

  writeMySqlConfig(cfg);
  const { installed } = await checkDbInstalled(cfg);
  deleteFile("mysql-install-info.json");
  deleteFile("install-type.json");

  return { status: "server_auto", config: cfg, dbInstalled: installed };
};
