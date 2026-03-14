import { ipcMain, BrowserWindow } from 'electron';
import { SerialPort } from 'serialport';
import { spawn } from 'node:child_process';

type OpenPayload = {
  mode?: 'printer' | 'serial';

  // serial
  port?: string; // COM3
  baudRate?: number;
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';

  // printer
  printerName?: string;

  // common
  commandHex?: string; // default ESC/POS -> 1B700019FA
  appendCR?: boolean;
  appendLF?: boolean;
  timeoutMs?: number;
};

const DEFAULT_COMMAND_HEX = '1B700019FA'; // ESC p 0 25 250

function hexToBuffer(hex: string): Buffer {
  const clean = String(hex ?? '').replace(/[^0-9a-fA-F]/g, '');
  if (!clean) throw new Error('commandHex vacío.');
  if (clean.length % 2 !== 0) throw new Error('commandHex inválido (longitud impar).');
  return Buffer.from(clean, 'hex');
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} excedió el tiempo límite (${timeoutMs} ms).`));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function buildCommand(payload: OpenPayload): Buffer {
  const commandHex = String(payload?.commandHex ?? DEFAULT_COMMAND_HEX).trim();
  let data = hexToBuffer(commandHex);

  if (payload?.appendCR) data = Buffer.concat([data, Buffer.from([0x0d])]);
  if (payload?.appendLF) data = Buffer.concat([data, Buffer.from([0x0a])]);

  return data;
}

async function openDrawerSerial(payload: OpenPayload): Promise<{ ok: true; mode: 'serial'; port: string }> {
  const portName = String(payload?.port ?? '').trim();
  if (!portName) {
    throw new Error('Debes enviar { port: "COMx" } para modo serial.');
  }

  const baudRate = Number(payload?.baudRate ?? 9600);
  const dataBits = (payload?.dataBits ?? 8) as 5 | 6 | 7 | 8;
  const stopBits = (payload?.stopBits ?? 1) as 1 | 2;
  const parity = (payload?.parity ?? 'none') as 'none' | 'even' | 'odd' | 'mark' | 'space';
  const timeoutMs = Math.max(1000, Number(payload?.timeoutMs ?? 5000));
  const data = buildCommand(payload);

  const job = new Promise<{ ok: true; mode: 'serial'; port: string }>((resolve, reject) => {
    const sp = new SerialPort({
      path: portName,
      baudRate,
      dataBits,
      stopBits,
      parity,
      autoOpen: false,
    });

    const safeClose = () => {
      try {
        if (sp.isOpen) sp.close(() => {});
      } catch {}
    };

    sp.open((openErr) => {
      if (openErr) {
        safeClose();
        return reject(new Error(`No se pudo abrir ${portName}: ${openErr.message}`));
      }

      sp.write(data, (writeErr) => {
        if (writeErr) {
          safeClose();
          return reject(new Error(`No se pudo enviar comando al cajón por ${portName}: ${writeErr.message}`));
        }

        sp.drain((drainErr) => {
          safeClose();

          if (drainErr) {
            return reject(new Error(`Error drenando el puerto ${portName}: ${drainErr.message}`));
          }

          resolve({ ok: true, mode: 'serial', port: portName });
        });
      });
    });

    sp.on('error', (err) => {
      safeClose();
      reject(new Error(`Error en puerto ${portName}: ${err.message}`));
    });
  });

  return await withTimeout(job, timeoutMs, `Apertura de cajón en ${portName}`);
}

async function openDrawerPrinter(payload: OpenPayload): Promise<{ ok: true; mode: 'printer'; printerName: string }> {
  const printerName = String(payload?.printerName ?? '').trim();
  if (!printerName) {
    throw new Error('Debes enviar { printerName: "Nombre de la impresora" } para modo printer.');
  }

  const timeoutMs = Math.max(2000, Number(payload?.timeoutMs ?? 7000));
  const data = buildCommand(payload);
  const hex = data.toString('hex').toUpperCase();

  const psScript = `
$printerName = @'
${printerName}
'@

$hex = '${hex}'

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFOA {
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)]
    public string pDataType;
  }

  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string src, out IntPtr hPrinter, IntPtr pd);

  [DllImport("winspool.drv", EntryPoint="ClosePrinter", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In] DOCINFOA di);

  [DllImport("winspool.drv", EntryPoint="EndDocPrinter", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="StartPagePrinter", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="EndPagePrinter", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);

  [DllImport("winspool.drv", EntryPoint="WritePrinter", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);
}
"@

function HexToBytes([string]$hexText) {
  $clean = $hexText -replace '[^0-9A-Fa-f]', ''
  if (($clean.Length % 2) -ne 0) {
    throw "Hex inválido"
  }
  $bytes = New-Object byte[] ($clean.Length / 2)
  for ($i = 0; $i -lt $bytes.Length; $i++) {
    $bytes[$i] = [Convert]::ToByte($clean.Substring($i * 2, 2), 16)
  }
  return $bytes
}

$bytes = HexToBytes $hex
$hPrinter = [IntPtr]::Zero
$di = New-Object RawPrinterHelper+DOCINFOA
$di.pDocName = "Sistetecni Cash Drawer"
$di.pDataType = "RAW"

if (-not [RawPrinterHelper]::OpenPrinter($printerName, [ref]$hPrinter, [IntPtr]::Zero)) {
  throw "No se pudo abrir la impresora: $printerName"
}

try {
  if (-not [RawPrinterHelper]::StartDocPrinter($hPrinter, 1, $di)) {
    throw "No se pudo iniciar documento RAW"
  }

  try {
    if (-not [RawPrinterHelper]::StartPagePrinter($hPrinter)) {
      throw "No se pudo iniciar página RAW"
    }

    $ptr = [System.Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    try {
      [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $ptr, $bytes.Length)
      $written = 0
      if (-not [RawPrinterHelper]::WritePrinter($hPrinter, $ptr, $bytes.Length, [ref]$written)) {
        throw "No se pudo escribir en la impresora RAW"
      }
    }
    finally {
      [System.Runtime.InteropServices.Marshal]::FreeHGlobal($ptr)
    }

    [void][RawPrinterHelper]::EndPagePrinter($hPrinter)
  }
  finally {
    [void][RawPrinterHelper]::EndDocPrinter($hPrinter)
  }
}
finally {
  [void][RawPrinterHelper]::ClosePrinter($hPrinter)
}

Write-Output "OK"
`;

  const job = new Promise<{ ok: true; mode: 'printer'; printerName: string }>((resolve, reject) => {
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', psScript],
      { windowsHide: true }
    );

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += String(chunk ?? '');
    });

    child.stderr.on('data', (chunk) => {
      stderr += String(chunk ?? '');
    });

    child.on('error', (err) => {
      reject(new Error(`No se pudo ejecutar PowerShell: ${err.message}`));
    });

    child.on('close', (code) => {
      if (code === 0 && stdout.includes('OK')) {
        resolve({ ok: true, mode: 'printer', printerName });
        return;
      }

      reject(new Error(stderr.trim() || stdout.trim() || `Falló la apertura por impresora (${code})`));
    });
  });

  return await withTimeout(job, timeoutMs, `Apertura de cajón en impresora ${printerName}`);
}

export function registerCashDrawerIpc(): void {
  try {
    ipcMain.removeHandler('cashdrawer:list-ports');
  } catch {}

  try {
    ipcMain.removeHandler('cashdrawer:list-printers');
  } catch {}

  try {
    ipcMain.removeHandler('cashdrawer:open');
  } catch {}

  ipcMain.handle('cashdrawer:list-ports', async () => {
    const ports = await SerialPort.list();

    return ports.map((p) => ({
      path: p.path,
      manufacturer: p.manufacturer ?? '',
      serialNumber: p.serialNumber ?? '',
      vendorId: p.vendorId ?? '',
      productId: p.productId ?? '',
      friendlyName: (p as any).friendlyName ?? '',
    }));
  });

  ipcMain.handle('cashdrawer:list-printers', async () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (!win) return [];

    const printers = await win.webContents.getPrintersAsync();
    return printers.map((p) => ({
      name: p.name,
      displayName: p.displayName,
      description: p.description,
      status: p.status,
      isDefault: p.isDefault,
    }));
  });

  ipcMain.handle('cashdrawer:open', async (_e, payload: OpenPayload) => {
    const mode = String(payload?.mode ?? 'printer').trim().toLowerCase();

    if (mode === 'serial') {
      return await openDrawerSerial(payload);
    }

    return await openDrawerPrinter(payload);
  });
}