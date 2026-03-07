declare global {
  interface Window {
    api: any;
  }
}

const api = window.api ?? {};

export const ipc = {
  ...api,

  // ✅ Cajón (si no existe aún, retorna valores seguros)
  cashdrawer: {
    listPorts: async (): Promise<string[]> => {
      try {
        return (await api.cashdrawer?.listPorts?.()) ?? [];
      } catch {
        return [];
      }
    },
    open: async (payload: { port: string; baudRate?: number }): Promise<{ ok: boolean; message?: string }> => {
      try {
        if (!api.cashdrawer?.open) return { ok: false, message: 'Cajón no configurado aún.' };
        return await api.cashdrawer.open(payload);
      } catch (e: any) {
        return { ok: false, message: String(e?.message ?? e) };
      }
    },
  },
};