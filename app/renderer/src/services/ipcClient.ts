declare global {
  interface Window {
    api: any;
  }
}

const api = window.api ?? {};

export const ipc = {
  ...api,

  sales: {
    create: async (payload: unknown) => {
      return await api.sales.create(payload);
    },

    suspend: async (payload: unknown) => {
      return await api.sales.suspend(payload);
    },

    listSuspended: async (payload: unknown) => {
      return await api.sales.listSuspended(payload);
    },

    getSuspended: async (payload: unknown) => {
      return await api.sales.getSuspended(payload);
    },

    deleteSuspended: async (payload: unknown) => {
      return await api.sales.deleteSuspended(payload);
    },

    listRecent: async (payload: unknown) => {
      return await api.sales.listRecent(payload);
    },

    getDetail: async (payload: unknown) => {
      return await api.sales.getDetail(payload);
    },

    return: async (payload: unknown) => {
      return await api.sales.return(payload);
    },

    printInvoice: async (payload: unknown) => {
      return await api.sales.printInvoice(payload);
    },

    createCreditNote: async (payload: unknown) => {
      return await api.sales.createCreditNote(payload);
    },

    createDebitNote: async (payload: unknown) => {
      return await api.sales.createDebitNote(payload);
    },

    listElectronicEvents: async (payload: unknown) => {
      return await api.sales.listElectronicEvents(payload);
    },
  },

  tableOrders: {
    list: async (payload: unknown) => {
      return await api.tableOrders.list(payload);
    },

    create: async (payload: unknown) => {
      return await api.tableOrders.create(payload);
    },

    get: async (payload: unknown) => {
      return await api.tableOrders.get(payload);
    },

    save: async (payload: unknown) => {
      return await api.tableOrders.save(payload);
    },

    close: async (payload: unknown) => {
      return await api.tableOrders.close(payload);
    },
  },

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
