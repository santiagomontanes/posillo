# Arquitectura
- Electron main: seguridad con contextIsolation=true y nodeIntegration=false.
- Comunicación renderer-main por preload + IPC.
- SQLite en proceso main con better-sqlite3.
- Renderer React+Vite con páginas por módulo POS.
- PDF de factura generado por PDFKit en carpeta appData/invoices.
