import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  
  installer: {
  testConnection: (cfg: any)     => ipcRenderer.invoke('installer:test-connection', cfg),
  check:          ()             => ipcRenderer.invoke('installer:check'),
  run:            (payload: any) => ipcRenderer.invoke('installer:run', payload),
  },
autodetect: {
  status: () => ipcRenderer.invoke('autodetect:status'),
  reset:  () => ipcRenderer.invoke('autodetect:reset'),
  },
on: (channel: string, cb: (...args: any[]) => void) => {
  ipcRenderer.on(channel, (_event, ...args) => cb(...args));
  return () => ipcRenderer.removeAllListeners(channel);
  },
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (cfg: any) => ipcRenderer.invoke('config:set', cfg),
  },

  auth: {
    login: (email: string, password: string) =>
      ipcRenderer.invoke('auth:login', email, password),
  },

  license: {
  status: () => ipcRenderer.invoke('license:status'),
  activate: (licenseKey: string) =>
    ipcRenderer.invoke('license:activate', { licenseKey }),

  // ✅ NUEVO: revalidar online (renueva gracia)
  checkOnline: () => ipcRenderer.invoke('license:check-online'),
},

  mysql: {
    getConfig: () => ipcRenderer.invoke('mysql:config:get'),
    setConfig: (cfg: any) => ipcRenderer.invoke('mysql:config:set', cfg),
    clearConfig: () => ipcRenderer.invoke('mysql:config:clear'),
    test: () => ipcRenderer.invoke('mysql:test'),
    initSchema: () => ipcRenderer.invoke('mysql:init-schema'),
  },

  products: {
    list: (payload: unknown) => ipcRenderer.invoke('products:list', payload),
    listForPos: (payload: unknown) => ipcRenderer.invoke('pos:products:list', payload),
    byBarcode: (payload: unknown) => ipcRenderer.invoke('products:by-barcode', payload),
    save: (payload: unknown) => ipcRenderer.invoke('products:save', payload),
    update: (payload: unknown) => ipcRenderer.invoke('products:update', payload),
    archive: (payload: unknown) => ipcRenderer.invoke('products:archive', payload),
  },

sales: {
  create: (payload: unknown) =>
    ipcRenderer.invoke('sales:create', payload),

  /* suspender venta */
  suspend: (payload: unknown) =>
    ipcRenderer.invoke('sales:suspend', payload),

  /* ventas suspendidas */
  listSuspended: (payload: unknown) =>
    ipcRenderer.invoke('sales:suspended-list', payload),

  getSuspended: (payload: unknown) =>
    ipcRenderer.invoke('sales:suspended-get', payload),

  deleteSuspended: (payload: unknown) =>
    ipcRenderer.invoke('sales:suspended-delete', payload),

  /* historial */
  listRecent: (payload: unknown) =>
    ipcRenderer.invoke('sales:recent', payload),

  /* detalle venta */
  getDetail: (payload: unknown) =>
    ipcRenderer.invoke('sales:detail', payload),

  return: (payload: unknown) => ipcRenderer.invoke('sales:return', payload),

  /* imprimir */
  printInvoice: (payload: unknown) =>
    ipcRenderer.invoke('sales:print-invoice', payload),
},

  expenses: {
    add: (payload: unknown) => ipcRenderer.invoke('expenses:add', payload),
    list: (payload: unknown) => ipcRenderer.invoke('expenses:list', payload),
  },

  cash: {
    open: (payload: unknown) => ipcRenderer.invoke('cash:open', payload),
    getOpen: (payload: unknown) => ipcRenderer.invoke('cash:get-open', payload),
    getStatus: (payload: unknown) => ipcRenderer.invoke('cash:get-status', payload),
    getOpenSuggestion: (payload: unknown) =>
      ipcRenderer.invoke('cash:get-open-suggestion', payload),
    close: (payload: unknown) => ipcRenderer.invoke('cash:close', payload),
  },

  reports: {
    salesByDay: (payload: unknown) => ipcRenderer.invoke('reports:sales-by-day', payload),
    topProducts: (payload: unknown) => ipcRenderer.invoke('reports:top-products', payload),
    dailyClose: (payload: unknown) => ipcRenderer.invoke('reports:daily-close', payload),
    summary: (payload: unknown) => ipcRenderer.invoke('reports:summary', payload),
    todaySummary: (payload: unknown) => ipcRenderer.invoke('reports:today-summary', payload),
    last7DaysSales: (payload: unknown) => ipcRenderer.invoke('reports:last-7-days-sales', payload),
  },

  users: {
    list: (payload: unknown) => ipcRenderer.invoke('users:list', payload),
    listBasic: (payload: unknown) => ipcRenderer.invoke('users:list-basic', payload),
    create: (payload: unknown) => ipcRenderer.invoke('users:create', payload),
    resetPassword: (payload: unknown) => ipcRenderer.invoke('users:reset-password', payload),

    // ✅ cambio obligatorio de contraseña
    changePassword: (payload: unknown) =>
      ipcRenderer.invoke('users:change-password', payload),
  },

  audit: {
    list: (payload: unknown) => ipcRenderer.invoke('audit:list', payload),
  },

  backups: {
    createManual: (payload: unknown) => ipcRenderer.invoke('backup:create-manual', payload),
    export: (payload: unknown) => ipcRenderer.invoke('backups:export', payload),
    restore: (payload: unknown) => ipcRenderer.invoke('backups:restore', payload),
  },
  cashdrawer: {
  listPorts: () => ipcRenderer.invoke('cashdrawer:list-ports'),
  listPrinters: () => ipcRenderer.invoke('cashdrawer:list-printers'),
  open: (payload: unknown) => ipcRenderer.invoke('cashdrawer:open', payload),
  },
});