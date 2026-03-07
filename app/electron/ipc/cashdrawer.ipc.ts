// app/electron/ipc/cashdrawer.ipc.ts
import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';

type OpenPayload = {
  port: string; // "COM3"
  baudRate?: number; // 9600, 19200, etc
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
  commandHex?: string; // default ESC/POS => "1B700019FA"
  appendCR?: boolean;
  appendLF?: boolean;
  timeoutMs?: number;
};

const DEFAULT_COMMAND_HEX = '1B700019FA';

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

async function openDrawerSerial(payload: OpenPayload): Promise<{ ok: true; port: string }> {
  const portName = String(payload?.port ?? '').trim();
  if (!portName) {
    throw new Error('Debes enviar { port: "COMx" }.');
  }

  const baudRate = Number(payload?.baudRate ?? 9600);
  const dataBits = (payload?.dataBits ?? 8) as 5 | 6 | 7 | 8;
  const stopBits = (payload?.stopBits ?? 1) as 1 | 2;
  const parity = (payload?.parity ?? 'none') as 'none' | 'even' | 'odd' | 'mark' | 'space';
  const timeoutMs = Math.max(1000, Number(payload?.timeoutMs ?? 5000));

  const commandHex = String(payload?.commandHex ?? DEFAULT_COMMAND_HEX).trim();
  let data = hexToBuffer(commandHex);

  if (payload?.appendCR) data = Buffer.concat([data, Buffer.from([0x0d])]);
  if (payload?.appendLF) data = Buffer.concat([data, Buffer.from([0x0a])]);

  const job = new Promise<{ ok: true; port: string }>((resolve, reject) => {
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
        if (sp.isOpen) {
          sp.close(() => {});
        }
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
          return reject(new Error(`No se pudo enviar comando al cajón: ${writeErr.message}`));
        }

        sp.drain((drainErr) => {
          safeClose();

          if (drainErr) {
            return reject(new Error(`Error drenando el puerto ${portName}: ${drainErr.message}`));
          }

          resolve({ ok: true, port: portName });
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

export function registerCashDrawerIpc(): void {
  // evita error por doble registro en dev / HMR
  try {
    ipcMain.removeHandler('cashdrawer:list-ports');
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

  ipcMain.handle('cashdrawer:open', async (_e, payload: OpenPayload) => {
    return await openDrawerSerial(payload);
  });
}