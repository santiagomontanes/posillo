import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import PDFDocument from 'pdfkit';

export const generateInvoicePdf = async (invoice: any): Promise<string> => {
  const dir = path.join(app.getPath('userData'), 'invoices');
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${invoice.invoiceNumber}.pdf`);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(18).text('Sistetecni - Factura', { align: 'center' });
    doc.moveDown().fontSize(10).text(`Factura: ${invoice.invoiceNumber}`);
    doc.text(`Fecha: ${new Date().toLocaleString()}`);
    doc.text(`Cliente: ${invoice.customerName || 'Consumidor final'}`);
    doc.moveDown();
    invoice.items.forEach((it: any) => {
      doc.text(`${it.name} x${it.qty}  ${it.line_total}`);
    });
    doc.moveDown();
    doc.text(`Subtotal: ${invoice.subtotal}`);
    doc.text(`Descuento: ${invoice.discount}`);
    doc.fontSize(12).text(`TOTAL: ${invoice.total}`);
    doc.end();
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return filePath;
};
