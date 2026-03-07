// app/electron/ipc/cashdrawer.ipc.ts
import { ipcMain } from 'electron';
import { SerialPort } from 'serialport';

type OpenPayload = {
  port: string;            // "COM3"
  baudRate?: number;       // 9600, 19200, etc
  dataBits?: 5 | 6 | 7 | 8;
  stopBits?: 1 | 2;
  parity?: 'none' | 'even' | 'odd';
  // comando para abrir cajón:
  // default: ESC/POS pulse => 1B 70 00 19 FA
  commandHex?: string;     // "1B700019FA"
  // por si el dispositivo requiere CR/LF
  appendCR?: boolean;
  appendLF?: boolean;
};

function hexToBuffer(hex: string): Buffer {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) throw new Error('commandHex inválido (longitud impar).');
  return Buffer.from(clean, 'hex');
}

export function registerCashDrawerIpc(): void {
  ipcMain.handle('cashdrawer:list-ports', async () => {
    const ports = await SerialPort.list();
    return ports.map((p) => ({
      path: p.path,                 // COM3
      manufacturer: p.manufacturer,
      serialNumber: p.serialNumber,
      vendorId: p.vendorId,
      productId: p.productId,
      friendlyName: (p as any).friendlyName,
    }));
  });

  ipcMain.handle('cashdrawer:open', async (_e, payload: OpenPayload) => {
    const portName = String(payload?.port ?? '').trim();
    if (!portName) throw new Error('Debes enviar { port: "COMx" }.');

    const baudRate = Number(payload?.baudRate ?? 9600);
    const dataBits = (payload?.dataBits ?? 8) as any;
    const stopBits = (payload?.stopBits ?? 1) as any;
    const parity = (payload?.parity ?? 'none') as any;

    const commandHex = String(payload?.commandHex ?? '1B700019FA').trim(); // ESC/POS open drawer pulse
    let data = hexToBuffer(commandHex);

    if (payload?.appendCR) data = Buffer.concat([data, Buffer.from([0x0d])]);
    if (payload?.appendLF) data = Buffer.concat([data, Buffer.from([0x0a])]);

    await new Promise<void>((resolve, reject) => {
      const sp = new SerialPort(
        { path: portName, baudRate, dataBits, stopBits, parity, autoOpen: false },
        // callback aquí NO siempre corre si autoOpen false
      );

      sp.open((err) => {
        if (err) return reject(new Error(`No se pudo abrir ${portName}: ${err.message}`));

        sp.write(data, (err2) => {
          if (err2) {
            try { sp.close(() => {}); } catch {}
            return reject(new Error(`No se pudo enviar comando al cajón: ${err2.message}`));
          }

          sp.drain((err3) => {
            sp.close(() => {});
            if (err3) return reject(new Error(`Error drenando el puerto: ${err3.message}`));
            resolve();
          });
        });
      });
    });

    return { ok: true, port: portName };
  });
}