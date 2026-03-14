declare global {
  interface Window {
    api: any;
  }
}

const api = window.api ?? {};

export const ipc = {
  ...api,

  cashdrawer: {
    listPorts: async (): Promise<any[]> => {
      try {
        return (await api.cashdrawer?.listPorts?.()) ?? [];
      } catch {
        return [];
      }
    },

    listPrinters: async (): Promise<any[]> => {
      try {
        return (await api.cashdrawer?.listPrinters?.()) ?? [];
      } catch {
        return [];
      }
    },

    open: async (payload: {
      mode?: 'printer' | 'serial';
      printerName?: string;
      port?: string;
      baudRate?: number;
      dataBits?: 5 | 6 | 7 | 8;
      stopBits?: 1 | 2;
      parity?: 'none' | 'even' | 'odd' | 'mark' | 'space';
      commandHex?: string;
      appendCR?: boolean;
      appendLF?: boolean;
      timeoutMs?: number;
    }): Promise<{ ok: boolean; message?: string; port?: string; printerName?: string; mode?: string }> => {
      try {
        if (!api.cashdrawer?.open) return { ok: false, message: 'Cajón no configurado aún.' };
        return await api.cashdrawer.open(payload);
      } catch (e: any) {
        return { ok: false, message: String(e?.message ?? e) };
      }
    },
  },
};