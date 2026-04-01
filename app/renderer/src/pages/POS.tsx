import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getProductByBarcode, listPosProducts } from '../services/products';
import {
  createSale,
  printInvoice,
  suspendSale,
  listSuspendedSales,
  getSuspendedSale,
  deleteSuspendedSale,
  listRecentSales,
  getSaleDetail,
  returnSale,
  createCreditNote,
  createDebitNote,
  listElectronicEvents,
} from '../services/sales';
import { Modal } from '../ui/Modal';
import { buildInvoiceHtml } from '../invoice/invoiceTemplate';
import { getConfig } from '../services/config';
import { ipc } from '../services/ipcClient';

type CartItem = {
  cart_id: string;
  product_id: string | null;
  description?: string;
  name: string;
  qty: number;
  unit_price: number;
  line_total: number;
  stock: number | null;
  unit_cost: number;
};

const money = (n: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));
};

const limitarATresPalabras = (texto: string): string => {
  if (!texto) return '';
  const palabras = texto.trim().split(/\s+/);
  return palabras.length > 3
    ? `${palabras.slice(0, 3).join(' ')}...`
    : texto;
};

export const POS = ({ user }: { user: any }) => {
  const scanRef = useRef<HTMLInputElement | null>(null);
  const [scanValue, setScanValue] = useState('');
  const scanTimer = useRef<number | null>(null);

  const focusScanner = (): void => {
    setTimeout(() => scanRef.current?.focus(), 0);
  };

  const [q, setQ] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPayment] = useState('EFECTIVO');
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const [freeOpen, setFreeOpen] = useState(false);
  const [freeDescription, setFreeDescription] = useState('');
  const [freePrice, setFreePrice] = useState(0);
  const [freeCost, setFreeCost] = useState(0);
  const [freeQty, setFreeQty] = useState(1);

  const [cashReceivedStr, setCashReceivedStr] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [generateElectronicInvoice, setGenerateElectronicInvoice] = useState(false);

  const [biz, setBiz] = useState<{
    name?: string;
    logoDataUrl?: string;
    nit?: string;
    phone?: string;
  }>({});

  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [suspendedRows, setSuspendedRows] = useState<any[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [creditNoteOpen, setCreditNoteOpen] = useState(false);
  const [creditNoteMode, setCreditNoteMode] = useState<'full' | 'partial'>('full');
  const [creditReasonCode, setCreditReasonCode] = useState('1');
  const [creditReasonText, setCreditReasonText] = useState('');
  const [creditAmount, setCreditAmount] = useState(0);

  const [debitNoteOpen, setDebitNoteOpen] = useState(false);
  const [debitReasonCode, setDebitReasonCode] = useState('4');
  const [debitReasonText, setDebitReasonText] = useState('');
  const [debitAmount, setDebitAmount] = useState(0);

  const [electronicEvents, setElectronicEvents] = useState<any[]>([]);
  const [noteBusy, setNoteBusy] = useState(false);

  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'printer' | 'serial'>(
    ((localStorage.getItem('cashdrawer_mode') as 'printer' | 'serial') || 'printer'),
  );
  const [drawerPort, setDrawerPort] = useState(localStorage.getItem('cashdrawer_port') || 'COM3');
  const [drawerBaudRate, setDrawerBaudRate] = useState(
    Number(localStorage.getItem('cashdrawer_baudrate') || '9600'),
  );
  const [drawerPrinterName, setDrawerPrinterName] = useState(
    localStorage.getItem('cashdrawer_printer_name') || '',
  );
  const [drawerPorts, setDrawerPorts] = useState<any[]>([]);
  const [drawerPrinters, setDrawerPrinters] = useState<any[]>([]);

  const [askPrint, setAskPrint] = useState(false);
  const [pendingInvoice, setPendingInvoice] = useState<any>(null);

  useEffect(() => {
    focusScanner();
  }, []);

  useEffect(() => {
    void listPosProducts(q).then(setProducts).catch(() => setProducts([]));
  }, [q]);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await getConfig();
        setBiz(cfg?.business ?? {});
      } catch {
        setBiz({});
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const ports = await ipc.cashdrawer.listPorts();
        setDrawerPorts(Array.isArray(ports) ? ports : []);

        const printers = await ipc.cashdrawer.listPrinters();
        setDrawerPrinters(Array.isArray(printers) ? printers : []);

        if (!localStorage.getItem('cashdrawer_printer_name') && Array.isArray(printers) && printers.length > 0) {
          const preferred =
            printers.find((p: any) => String(p?.name || '').toLowerCase().includes('ncr')) ||
            printers.find((p: any) => String(p?.name || '').toLowerCase().includes('generic')) ||
            printers[0];

          if (preferred?.name) {
            setDrawerPrinterName(preferred.name);
            localStorage.setItem('cashdrawer_printer_name', preferred.name);
          }
        }
      } catch {}
    })();
  }, []);

  const onRootClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, button, a')) return;
    focusScanner();
  };

  const subtotal = useMemo(() => cart.reduce((a, c) => a + c.line_total, 0), [cart]);
  const total = Math.max(0, subtotal - discount);

  const cashReceived = useMemo(() => {
    const cleaned = cashReceivedStr.replace(/[^\d]/g, '');
    return cleaned ? Number(cleaned) : 0;
  }, [cashReceivedStr]);

  const change = useMemo(() => Math.max(cashReceived - total, 0), [cashReceived, total]);
  const missing = useMemo(() => Math.max(total - cashReceived, 0), [cashReceived, total]);

  const mustHaveCash = paymentMethod === 'EFECTIVO';
  const canConfirm = cart.length > 0 && !isProcessing && (!mustHaveCash || cashReceived >= total);

  const displayName = (p: any): string => {
    const n = String(p?.name ?? '').trim();
    if (n) return n;
    const legacy = `${p?.brand ?? ''} ${p?.model ?? ''}`.trim();
    return legacy || 'Producto';
  };

  const productIcon = (p: any): string => {
    const text = `${p?.name ?? ''} ${p?.category ?? ''} ${p?.description ?? ''}`.toLowerCase();

    if (text.includes('laptop') || text.includes('portátil') || text.includes('notebook')) return 'ri-laptop-line';
    if (text.includes('pc') || text.includes('computador') || text.includes('cpu')) return 'ri-computer-line';
    if (text.includes('monitor') || text.includes('pantalla')) return 'ri-computer-line';
    if (text.includes('teclado')) return 'ri-keyboard-line';
    if (text.includes('mouse')) return 'ri-mouse-line';
    if (text.includes('impresora')) return 'ri-printer-line';
    if (text.includes('disco') || text.includes('ssd') || text.includes('hdd')) return 'ri-hard-drive-3-line';
    if (text.includes('memoria') || text.includes('ram')) return 'ri-save-3-line';
    return 'ri-box-3-line';
  };

  const setQty = (cartId: string, qty: number): void => {
    setCart((current) =>
      current.map((item) => {
        if (item.cart_id !== cartId) return item;

        if (item.stock == null) {
          const safeQty = Math.max(1, qty);
          return { ...item, qty: safeQty, line_total: safeQty * item.unit_price };
        }

        const safeQty = Math.max(1, Math.min(qty, item.stock));
        if (qty > item.stock) {
          setMessage(`Stock insuficiente para ${item.name}. Máximo disponible: ${item.stock}.`);
        }

        return { ...item, qty: safeQty, line_total: safeQty * item.unit_price };
      }),
    );
  };

  const addFromProduct = (p: any): void => {
    setMessage('');

    setCart((current) => {
      const found = current.find((x) => x.product_id === p.id);
      const stock = p.stock == null ? null : Number(p.stock);
      const unitPrice = Number(p.sale_price ?? 0);

      if (found) {
        if (stock != null && stock > 0 && found.qty + 1 > stock) {
          setMessage(`Stock insuficiente para ${displayName(p)}. Máximo disponible: ${stock}.`);
          return current;
        }

        return current.map((x) =>
          x.product_id === p.id
            ? { ...x, qty: x.qty + 1, line_total: (x.qty + 1) * x.unit_price }
            : x,
        );
      }

      return [
        ...current,
        {
          cart_id: `${p.id}-${Date.now()}`,
          product_id: p.id,
          name: displayName(p),
          description: '',
          qty: 1,
          unit_price: unitPrice,
          line_total: unitPrice,
          stock,
          unit_cost: Number(p.unit_cost ?? 0),
        },
      ];
    });
  };

  useEffect(() => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);

    const code = scanValue.trim();
    if (!code) return;

    scanTimer.current = window.setTimeout(async () => {
      try {
        if (code.length < 6) return;

        const p = await getProductByBarcode(code);
        if (!p) {
          setMessage(`No existe producto con código: ${code}`);
          return;
        }

        addFromProduct(p);
        setScanValue('');
        setMessage('');
      } catch (err: any) {
        setMessage(err?.message || 'Error leyendo código de barras.');
      } finally {
        focusScanner();
      }
    }, 250);

    return () => {
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    };
  }, [scanValue]);

  const onScanKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;

    const code = scanValue.trim();
    setScanValue('');
    if (!code) return;

    try {
      const p = await getProductByBarcode(code);
      if (!p) {
        setMessage(`No existe producto con código: ${code}`);
        return;
      }

      addFromProduct(p);
      setMessage('');
    } catch (err: any) {
      setMessage(err?.message || 'Error leyendo código de barras.');
    } finally {
      focusScanner();
    }
  };

  const addFreeItem = (): void => {
    const description = freeDescription.trim();
    if (!description) return setMessage('La descripción del ítem libre es obligatoria.');
    if (freePrice < 0) return setMessage('El precio unitario no puede ser negativo.');
    if (freeQty < 1) return setMessage('La cantidad debe ser mínimo 1.');
    if (freeCost < 0) return setMessage('El costo unitario no puede ser negativo.');

    const id = `free-${Date.now()}`;

    setCart((current) => [
      ...current,
      {
        cart_id: id,
        product_id: null,
        description,
        name: description,
        qty: freeQty,
        unit_price: freePrice,
        line_total: freeQty * freePrice,
        stock: null,
        unit_cost: freeCost,
      },
    ]);

    setFreeDescription('');
    setFreePrice(0);
    setFreeCost(0);
    setFreeQty(1);
    setFreeOpen(false);
    setMessage('');
    focusScanner();
  };

  const removeItem = (cartId: string): void => {
    setCart((current) => current.filter((i) => i.cart_id !== cartId));
  };

  const clearCart = (): void => {
    setCart([]);
    setDiscount(0);
    setCashReceivedStr('');
    setMessage('');
    setGenerateElectronicInvoice(false);
    focusScanner();
  };

  const clearCustomerData = (): void => {
    setCustomerName('');
    setCustomerId('');
    setCustomerEmail('');
    setCustomerPhone('');
    setCustomerAddress('');
  };

  const loadSuspended = async () => {
    try {
      const rows = await listSuspendedSales();
      setSuspendedRows(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron cargar las suspendidas.');
    }
  };

  const loadRecent = async () => {
    try {
      const rows = await listRecentSales(30);
      setRecentRows(Array.isArray(rows) ? rows : []);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudieron cargar las ventas recientes.');
    }
  };

  const loadElectronicEvents = async (saleId: string) => {
    try {
      const rows = await listElectronicEvents(saleId);
      setElectronicEvents(Array.isArray(rows) ? rows : []);
    } catch {
      setElectronicEvents([]);
    }
  };

  const handleSuspendSale = async () => {
    if (cart.length === 0) {
      setMessage('No hay productos para suspender.');
      return;
    }

    try {
      await suspendSale({
        userId: user.id,
        items: cart.map((item) => ({
          product_id: item.product_id,
          name: item.name,
          description: item.description ?? '',
          qty: item.qty,
          unit_price: item.unit_price,
          line_total: item.line_total,
          stock: item.stock,
          unit_cost: item.unit_cost,
        })),
        subtotal,
        discount,
        total,
        paymentMethod,
        customerName: customerName?.trim() || '',
        customerId: customerId?.trim() || '',
        notes: '',
      });

      clearCart();
      clearCustomerData();
      setMessage('Venta suspendida correctamente.');
      await loadSuspended();
      setSuspendedOpen(true);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo suspender la venta.');
    }
  };

  const handleResumeSuspended = async (id: string) => {
    try {
      const detail = await getSuspendedSale(id);
      if (!detail) {
        setMessage('Venta suspendida no encontrada.');
        return;
      }

      const items = Array.isArray(detail.items) ? detail.items : [];

      setCart(
        items.map((item: any) => ({
          cart_id: `${item.product_id ?? 'free'}-${item.id}-${Date.now()}`,
          product_id: item.product_id ?? null,
          description: item.description ?? '',
          name: String(item.name ?? ''),
          qty: Number(item.qty ?? 0),
          unit_price: Number(item.unit_price ?? 0),
          line_total: Number(item.line_total ?? 0),
          stock: item.stock == null ? null : Number(item.stock),
          unit_cost: Number(item.unit_cost ?? 0),
        })),
      );

      setDiscount(Number(detail.discount ?? 0));
      setPayment(String(detail.payment_method ?? 'EFECTIVO'));
      setCustomerName(String(detail.customer_name ?? ''));
      setCustomerId(String(detail.customer_id ?? ''));
      setCustomerEmail('');
      setCustomerPhone('');
      setCustomerAddress('');
      setGenerateElectronicInvoice(false);

      await deleteSuspendedSale(id);
      await loadSuspended();
      setSuspendedOpen(false);
      setMessage('Venta reanudada correctamente.');
      focusScanner();
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo reanudar la venta.');
    }
  };

  const openSaleDetail = async (id: string) => {
    try {
      setDetailLoading(true);
      const detail = await getSaleDetail(id);
      setSaleDetail(detail);
      setElectronicEvents(Array.isArray(detail?.electronic_events) ? detail.electronic_events : []);
      if (!Array.isArray(detail?.electronic_events)) {
        await loadElectronicEvents(id);
      }
      setDetailOpen(true);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshOpenSaleDetail = async () => {
    if (!saleDetail?.id) return;
    await openSaleDetail(String(saleDetail.id));
  };

  const handleReprintFromDetail = async () => {
    if (!saleDetail || !saleDetail.invoice_number) {
      setMessage('No se pudo obtener el número de factura.');
      return;
    }

    const html = buildInvoiceHtml({
      invoiceNumber: String(saleDetail?.invoice_number ?? ''),
      createdAt: saleDetail?.date ?? new Date().toISOString(),
      cashierName: saleDetail?.user_name ?? saleDetail?.user_email ?? 'Cajero',
      paymentMethod: saleDetail?.payment_method ?? 'EFECTIVO',
      customerName: saleDetail?.customer_name ?? 'Consumidor final',
      customerId: saleDetail?.customer_id ?? '',
      subtotal: Number(saleDetail?.subtotal ?? 0),
      discount: Number(saleDetail?.discount ?? 0),
      total: Number(saleDetail?.total ?? 0),
      cashReceived: 0,
      cashChange: 0,
      businessName: biz?.name ?? '',
      businessLogoDataUrl: biz?.logoDataUrl ?? '',
      businessNit: biz?.nit ?? '',
      businessPhone: biz?.phone ?? '',
      items: (saleDetail?.items ?? []).map((item: any) => ({
        name: item?.name ?? item?.description ?? 'Producto',
        description: item?.description ?? '',
        qty: Number(item?.qty ?? 0),
        unit_price: Number(item?.unit_price ?? 0),
        line_total: Number(item?.line_total ?? 0),
      })),
    });

    setPendingInvoice({
      html,
      invoiceNumber: saleDetail?.invoice_number ?? '',
      electronicInvoiceUrl: saleDetail?.factus_public_url ?? saleDetail?.electronic_invoice_url ?? '',
      electronicInvoiceNumber: saleDetail?.factus_bill_number ?? '',
    });

    setAskPrint(true);
  };

  const handleReturnSale = async () => {
    if (!saleDetail?.id) return;

    try {
      const detailItems = Array.isArray(saleDetail.items) ? saleDetail.items : [];

      const res = await returnSale({
        saleId: saleDetail.id,
        userId: user.id,
        reason: 'Devolución desde POS',
        items: detailItems.map((item: any) => ({
          sale_item_id: item.id,
          qty: Number(item.qty ?? 0),
        })),
      });

      setMessage(`Devolución realizada por ${money(Number(res?.totalReturned ?? 0))}.`);
      setDetailOpen(false);
      await loadRecent();
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo realizar la devolución.');
    }
  };

  const handleCreateCreditNote = async () => {
    if (!saleDetail?.id) return;

    try {
      setNoteBusy(true);

      if (creditNoteMode === 'partial' && Number(creditAmount || 0) <= 0) {
        setMessage('Ingresa un valor válido para la nota crédito parcial.');
        return;
      }

      const res = await createCreditNote({
        saleId: String(saleDetail.id),
        reasonCode: creditReasonCode,
        reasonText: creditReasonText.trim() || 'Nota crédito generada desde POS',
        mode: creditNoteMode,
        amount: creditNoteMode === 'partial' ? Number(creditAmount || 0) : Number(saleDetail.total ?? 0),
      });

      const noteNumber =
        res?.data?.data?.credit_note?.number ??
        res?.data?.credit_note?.number ??
        'generada';

      setMessage(`Nota crédito ${noteNumber} creada correctamente.`);
      setCreditNoteOpen(false);
      setCreditReasonCode('1');
      setCreditReasonText('');
      setCreditAmount(0);
      setCreditNoteMode('full');
      await refreshOpenSaleDetail();
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear la nota crédito.');
    } finally {
      setNoteBusy(false);
    }
  };

  const handleCreateDebitNote = async () => {
    if (!saleDetail?.id) return;

    try {
      setNoteBusy(true);

      if (Number(debitAmount || 0) <= 0) {
        setMessage('Ingresa un valor válido para la nota débito.');
        return;
      }

      const res = await createDebitNote({
        saleId: String(saleDetail.id),
        reasonCode: debitReasonCode,
        reasonText: debitReasonText.trim() || 'Nota débito generada desde POS',
        amount: Number(debitAmount || 0),
      });

      const noteNumber =
        res?.data?.data?.debit_note?.number ??
        res?.data?.debit_note?.number ??
        'generada';

      setMessage(`Nota débito ${noteNumber} creada correctamente.`);
      setDebitNoteOpen(false);
      setDebitReasonCode('4');
      setDebitReasonText('');
      setDebitAmount(0);
      await refreshOpenSaleDetail();
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo crear la nota débito.');
    } finally {
      setNoteBusy(false);
    }
  };

  const handleOpenDrawer = async () => {
    if (drawerBusy) return;

    setDrawerBusy(true);
    setMessage('');

    try {
      localStorage.setItem('cashdrawer_mode', drawerMode);
      localStorage.setItem('cashdrawer_port', drawerPort);
      localStorage.setItem('cashdrawer_baudrate', String(drawerBaudRate));
      localStorage.setItem('cashdrawer_printer_name', drawerPrinterName);

      const payload =
        drawerMode === 'serial'
          ? {
              mode: 'serial' as const,
              port: drawerPort,
              baudRate: drawerBaudRate,
              commandHex: '1B700019FA',
              timeoutMs: 5000,
            }
          : {
              mode: 'printer' as const,
              printerName: drawerPrinterName,
              commandHex: '1B700019FA',
              timeoutMs: 7000,
            };

      const res = await ipc.cashdrawer.open(payload);

      if (!res?.ok) {
        setMessage(res?.message || 'No se pudo abrir el cajón.');
        return;
      }

      setMessage(
        drawerMode === 'serial'
          ? `Cajón abierto por ${res.port || drawerPort}`
          : `Cajón abierto por impresora ${res.printerName || drawerPrinterName}`,
      );
    } catch (err: any) {
      setMessage(err?.message || 'No se pudo abrir el cajón.');
    } finally {
      setDrawerBusy(false);
      focusScanner();
    }
  };

  useEffect(() => {
    const handleShortcut = async (e: KeyboardEvent) => {
      if (e.key !== 'F6') return;
      e.preventDefault();
      await handleOpenDrawer();
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, [drawerBusy, drawerMode, drawerPort, drawerBaudRate, drawerPrinterName]);

  const confirm = async (): Promise<void> => {
    if (isProcessing) return;
    if (cart.length === 0) return setMessage('El carrito está vacío.');

    if (paymentMethod === 'EFECTIVO' && cashReceived < total) {
      return setMessage(`Falta dinero. Debes recibir mínimo ${money(total)}.`);
    }

    const finalCustomer = showCustomer
      ? {
          customerName: customerName?.trim(),
          customerId: customerId?.trim(),
          customerEmail: customerEmail?.trim(),
          customerPhone: customerPhone?.trim(),
          customerAddress: customerAddress?.trim(),
        }
      : {
          customerName: 'Consumidor Final',
          customerId: '222222222222',
          customerEmail: 'cliente@correo.com',
          customerPhone: '3000000000',
          customerAddress: 'No especificada',
        };

    setIsProcessing(true);
    setMessage('');

    try {
      const saleItems = cart.map((item) => ({
        product_id: item.product_id,
        name: item.name,
        description: item.product_id ? '' : item.description ?? item.name,
        qty: item.qty,
        unit_price: item.unit_price,
        line_total: item.line_total,
        unit_cost: item.unit_cost,
      }));

      const res = await createSale({
        userId: user.id,
        items: saleItems,
        subtotal,
        discount,
        total,
        paymentMethod,
        ...finalCustomer,
        cashReceived: paymentMethod === 'EFECTIVO' ? cashReceived : 0,
        cashChange: paymentMethod === 'EFECTIVO' ? change : 0,
        generateElectronicInvoice,
      });

      const html = buildInvoiceHtml({
        invoiceNumber: String(res.invoiceNumber ?? ''),
        createdAt: new Date().toISOString(),
        cashierName: user?.name || user?.email || 'Cajero',
        paymentMethod,
        customerName: finalCustomer.customerName,
        customerId: finalCustomer.customerId,
        subtotal,
        discount,
        total,
        cashReceived: paymentMethod === 'EFECTIVO' ? cashReceived : 0,
        cashChange: paymentMethod === 'EFECTIVO' ? change : 0,
        businessName: biz?.name || '',
        businessLogoDataUrl: biz?.logoDataUrl || '',
        businessNit: biz?.nit || '',
        businessPhone: biz?.phone || '',
        items: cart.map((i: any) => ({
          name: i.name,
          description: i.description || '',
          qty: Number(i.qty ?? 0),
          unit_price: Number(i.unit_price ?? 0),
          line_total: Number(i.line_total ?? 0),
        })),
      });

      let finalMessage = `Venta realizada. Factura #${String(res.invoiceNumber ?? '')}`;

      if (generateElectronicInvoice) {
        if (res?.factus?.data?.bill?.number) {
          finalMessage += ` · FE OK: ${res.factus.data.bill.number}`;
        } else if (res?.factusError) {
          finalMessage += ` · Error FE: ${res.factusError}`;
        }
      }

      setMessage(finalMessage);

      setPendingInvoice({
        html,
        invoiceNumber: String(res.invoiceNumber ?? ''),
        electronicInvoiceUrl: String(res?.factus?.data?.bill?.public_url ?? ''),
        electronicInvoiceNumber: String(res?.factus?.data?.bill?.number ?? ''),
      });

      setAskPrint(true);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo confirmar la venta.');
    } finally {
      setIsProcessing(false);
      focusScanner();
    }
  };

  const paymentOptions = ['EFECTIVO', 'NEQUI', 'DAVIPLATA', 'BANCOLOMBIA', 'TARJETA', 'ADDI', 'OTRO'];

  return (
    <div className="dashboard" onClick={onRootClick}>
      <input
        ref={scanRef}
        value={scanValue}
        onChange={(e) => setScanValue(e.target.value)}
        onKeyDown={onScanKeyDown}
        style={{
          position: 'absolute',
          opacity: 0,
          height: 1,
          width: 1,
          left: -9999,
        }}
      />

      <div className="pos">
        <section className="pos__left card">
          <div className="subcard pos-welcome">
            {biz?.logoDataUrl ? (
              <img
                src={biz.logoDataUrl}
                alt="logo"
                className="pos-welcome__logo"
              />
            ) : (
              <div className="sidebar__logo">S</div>
            )}

            <div className="pos-welcome__text">
              <div className="pos-welcome__title">
                Bienvenido{biz?.name ? ` a ${biz.name}` : ''}
              </div>
              <div className="pos-welcome__subtitle">Powered by Sistetecni POS</div>
            </div>
          </div>

          <div className="pos__search">
            <input
              placeholder="Buscar o escanear código"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== 'Enter') return;

                const code = q.trim();
                if (!code) return;

                try {
                  const p = await getProductByBarcode(code);

                  if (!p) {
                    setMessage(`No existe producto con código: ${code}`);
                    return;
                  }

                  addFromProduct(p);
                  setQ('');
                  setMessage('');
                } catch (err: any) {
                  setMessage(err?.message || 'Error leyendo código de barras.');
                }
              }}
            />

            <button className="btn" onClick={() => setFreeOpen(true)}>
              <i className="ri-add-circle-line" />
              Ítem libre
            </button>
          </div>

          <div className="pos__products">
            {products.map((p: any) => (
              <button
                key={p.id}
                className="pos__product"
                onClick={() => addFromProduct(p)}
                disabled={isProcessing || (p.stock ?? 0) <= 0}
                title={(p.stock ?? 0) <= 0 ? 'Sin stock' : 'Agregar'}
              >
                <div className="pos__product-head">
                  <div className="pos__product-title" title={displayName(p)}>
                    {limitarATresPalabras(displayName(p))}
                  </div>

                  <div className="pos__product-icon">
                    <i className={productIcon(p)} />
                  </div>
                </div>

                <div className="pos__product-sub">
                  <span>{String(p?.sku ?? p?.barcode ?? p?.cpu ?? '').trim() || '—'}</span>
                  <span>Stock: {p.stock}</span>
                </div>

                <div className="pos__product-price">{money(Number(p.sale_price ?? 0))}</div>
              </button>
            ))}

            {products.length === 0 && (
              <div className="pos__empty">No hay productos para mostrar.</div>
            )}
          </div>
        </section>

        <section className="pos__right card">
          <div className="pos__right-header">
            <h3 className="section-title" style={{ margin: 0 }}>Carrito</h3>

            <div className="actions-row">
              <button className="btn btn--ghost" onClick={clearCart} disabled={isProcessing}>
                <i className="ri-delete-bin-6-line" />
                Vaciar
              </button>

              <button className="btn btn--ghost" onClick={clearCart} disabled={isProcessing}>
                <i className="ri-close-circle-line" />
                Cancelar
              </button>

              <button
                className="btn btn--ghost"
                onClick={async () => {
                  await loadSuspended();
                  setSuspendedOpen(true);
                }}
                disabled={isProcessing}
              >
                <i className="ri-pause-circle-line" />
                Suspendidas
              </button>

              <button
                className="btn btn--ghost"
                onClick={async () => {
                  await loadRecent();
                  setRecentOpen(true);
                }}
                disabled={isProcessing}
              >
                <i className="ri-history-line" />
                Ventas recientes
              </button>
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            {!showCustomer && (
              <button
                className="btn btn--ghost"
                onClick={() => setShowCustomer(true)}
              >
                <i className="ri-user-add-line" />
                Agregar datos del cliente
              </button>
            )}

            {showCustomer && (
              <div className="subcard" style={{ display: 'grid', gap: 10 }}>
                <input
                  placeholder="Nombre del cliente"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <input
                  placeholder="Documento o identificación"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                />
                <input
                  placeholder="Correo electrónico"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
                <input
                  placeholder="Teléfono"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
                <input
                  placeholder="Dirección"
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                />

                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    setShowCustomer(false);
                    clearCustomerData();
                    setGenerateElectronicInvoice(false);
                  }}
                >
                  <i className="ri-user-unfollow-line" />
                  Quitar datos del cliente
                </button>
              </div>
            )}
          </div>

          <div className="pos__cart">
            {cart.map((i) => {
              const canDecrease = i.qty > 1;
              const canIncrease = i.stock == null ? true : i.qty < i.stock;

              return (
                <div key={i.cart_id} className="pos__cart-row">
                  <div className="pos__cart-info">
                    <div className="pos__cart-name">{i.name}</div>

                    <div className="pos__cart-meta">
                      <span>{money(i.unit_price)} c/u</span>
                      {i.stock != null && <span>Disp: {i.stock}</span>}
                    </div>
                  </div>

                  <div className="pos__qty">
                    <button
                      className="qtybtn"
                      onClick={() => setQty(i.cart_id, i.qty - 1)}
                      disabled={isProcessing || !canDecrease}
                    >
                      −
                    </button>

                    <input
                      className="qtyinput"
                      type="text"
                      inputMode="numeric"
                      value={i.qty}
                      disabled={isProcessing}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/[^\d]/g, '');
                        setQty(i.cart_id, Number(onlyNums || 1));
                      }}
                    />

                    <button
                      className="qtybtn"
                      onClick={() => setQty(i.cart_id, i.qty + 1)}
                      disabled={isProcessing || !canIncrease}
                    >
                      +
                    </button>
                  </div>

                  <div className="pos__line-total">{money(i.line_total)}</div>

                  <button
                    className="btn btn--ghost"
                    onClick={() => removeItem(i.cart_id)}
                    disabled={isProcessing}
                  >
                    <i className="ri-delete-bin-line" />
                  </button>
                </div>
              );
            })}

            {cart.length === 0 && (
              <div className="pos__empty">Agrega productos para iniciar una venta.</div>
            )}
          </div>

          <div className="pos__pay card" style={{ marginTop: 10 }}>
            <div className="pos__pay-row">
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>

            <div className="pos__pay-row" style={{ alignItems: 'center', gap: 10 }}>
              <span>Descuento</span>
              <input
                style={{ width: 140 }}
                type="number"
                min={0}
                value={discount}
                disabled={isProcessing}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value || 0)))}
                placeholder="0"
              />
            </div>

            <div className="pos__pay-method">
              <div className="section-title" style={{ marginBottom: 8 }}>Método de pago</div>

              <div className="pos__chips">
                {paymentOptions.map((opt) => (
                  <button
                    key={opt}
                    className={`chip ${paymentMethod === opt ? 'chip--active' : ''}`}
                    onClick={() => setPayment(opt)}
                    disabled={isProcessing}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="subcard"
              style={{
                marginTop: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>Factura electrónica</div>
                <div className="soft-text">
                  Actívala solo si el cliente la solicita.
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="checkbox"
                  checked={generateElectronicInvoice}
                  disabled={isProcessing}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setGenerateElectronicInvoice(checked);
                    if (checked) setShowCustomer(true);
                  }}
                />
                <span>Generar</span>
              </label>
            </div>

            {paymentMethod === 'EFECTIVO' && (
              <div style={{ marginTop: 10 }}>
                <div className="section-title" style={{ marginBottom: 8 }}>Pago en efectivo</div>

                <div className="pos__pay-row" style={{ alignItems: 'center', gap: 10 }}>
                  <span>Efectivo recibido</span>
                  <input
                    style={{ width: 160 }}
                    inputMode="numeric"
                    value={cashReceivedStr}
                    disabled={isProcessing}
                    onChange={(e) => setCashReceivedStr(e.target.value)}
                    placeholder="Ej: 20000"
                  />
                </div>

                <div style={{ marginTop: 8 }}>
                  <div className="soft-text">Cambio a devolver</div>
                  <div className="pos__total-amount">{money(change)}</div>
                </div>

                {missing > 0 && (
                  <div className="pos__msg" style={{ marginTop: 8 }}>
                    Falta: <b>{money(missing)}</b>
                  </div>
                )}
              </div>
            )}

            {message && <div className="pos__msg">{message}</div>}

            <div className="pos__total">
              <div>Total</div>
              <div className="pos__total-amount">{money(total)}</div>
            </div>

            <button
              className="pos__confirm"
              onClick={confirm}
              disabled={!canConfirm}
            >
              <i className="ri-bank-card-line" />
              {isProcessing ? 'Procesando...' : 'COBRAR'}
            </button>

            <div className="actions-row" style={{ marginTop: 10 }}>
              <button
                className="btn btn--ghost"
                onClick={handleSuspendSale}
                disabled={isProcessing || cart.length === 0}
              >
                <i className="ri-pause-mini-line" />
                Suspender venta
              </button>
            </div>

            <div className="subcard" style={{ marginTop: 10, display: 'grid', gap: 10 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Cajón de dinero</div>

              <div className="pos__chips">
                <button
                  className={`chip ${drawerMode === 'printer' ? 'chip--active' : ''}`}
                  onClick={() => {
                    setDrawerMode('printer');
                    localStorage.setItem('cashdrawer_mode', 'printer');
                  }}
                  disabled={drawerBusy}
                >
                  Por impresora
                </button>

                <button
                  className={`chip ${drawerMode === 'serial' ? 'chip--active' : ''}`}
                  onClick={() => {
                    setDrawerMode('serial');
                    localStorage.setItem('cashdrawer_mode', 'serial');
                  }}
                  disabled={drawerBusy}
                >
                  Por puerto COM
                </button>
              </div>

              {drawerMode === 'printer' ? (
                <div style={{ display: 'grid', gap: 6 }}>
                  <label style={{ fontSize: 12, opacity: 0.85 }}>Impresora que abrirá el cajón</label>
                  <select
                    value={drawerPrinterName}
                    onChange={(e) => {
                      setDrawerPrinterName(e.target.value);
                      localStorage.setItem('cashdrawer_printer_name', e.target.value);
                    }}
                    disabled={drawerBusy}
                  >
                    <option value="">Selecciona una impresora</option>
                    {drawerPrinters.map((p: any) => (
                      <option key={p.name} value={p.name}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12, opacity: 0.85 }}>Puerto COM</label>
                    <select
                      value={drawerPort}
                      onChange={(e) => {
                        setDrawerPort(e.target.value);
                        localStorage.setItem('cashdrawer_port', e.target.value);
                      }}
                      disabled={drawerBusy}
                    >
                      <option value="">Selecciona un puerto</option>
                      {drawerPorts.map((p: any) => (
                        <option key={p.path} value={p.path}>
                          {p.path} {p.friendlyName ? `- ${p.friendlyName}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ fontSize: 12, opacity: 0.85 }}>Baud rate</label>
                    <input
                      type="number"
                      value={drawerBaudRate}
                      onChange={(e) => {
                        const v = Number(e.target.value || 9600);
                        setDrawerBaudRate(v);
                        localStorage.setItem('cashdrawer_baudrate', String(v));
                      }}
                      disabled={drawerBusy}
                    />
                  </div>
                </div>
              )}

              <button className="btn btn--ghost" onClick={handleOpenDrawer} disabled={drawerBusy}>
                <i className="ri-door-open-line" />
                {drawerBusy ? 'Abriendo cajón...' : 'Abrir cajón'}
              </button>

              <div className="soft-text">
                También puedes usar el atajo <b>F6</b>.
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal open={freeOpen} onClose={isProcessing ? undefined : () => setFreeOpen(false)}>
        <h3>Agregar ítem libre</h3>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          <b>Descripción</b>
          <input
            value={freeDescription}
            onChange={(e) => setFreeDescription(e.target.value)}
            placeholder="Ej: Servicio formateo"
          />
        </label>

        <div className="grid grid-2">
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b>Precio unitario</b>
            <input
              type="number"
              min={0}
              value={freePrice}
              onChange={(e) => setFreePrice(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b>Costo unitario (opcional)</b>
            <input
              type="number"
              min={0}
              value={freeCost}
              onChange={(e) => setFreeCost(Math.max(0, Number(e.target.value || 0)))}
            />
          </label>
        </div>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          <b>Cantidad</b>
          <input
            type="number"
            min={1}
            value={freeQty}
            onChange={(e) => setFreeQty(Math.max(1, Number(e.target.value || 1)))}
          />
        </label>

        <div className="actions-row" style={{ marginTop: 12 }}>
          <button className="btn" onClick={addFreeItem} disabled={isProcessing}>
            Agregar
          </button>
          <button className="btn btn--ghost" onClick={() => setFreeOpen(false)} disabled={isProcessing}>
            Cancelar
          </button>
        </div>
      </Modal>

      <Modal open={suspendedOpen} onClose={() => setSuspendedOpen(false)}>
        <h3>Ventas suspendidas</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          {suspendedRows.length === 0 && <div className="soft-text">No hay ventas suspendidas.</div>}

          {suspendedRows.map((row: any) => (
            <div
              key={row.id}
              className="subcard"
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>{row.temp_number || row.tempNumber || 'Venta suspendida'}</div>
                <div className="soft-text">
                  Cliente: {row.customer_name || row.customerName || '—'} · Total: {money(Number(row.total ?? 0))}
                </div>
              </div>

              <button className="btn" onClick={() => void handleResumeSuspended(String(row.id))}>
                Reanudar
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={recentOpen} onClose={() => setRecentOpen(false)}>
        <h3>Ventas recientes</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          {recentRows.length === 0 && <div className="soft-text">No hay ventas recientes.</div>}

          {recentRows.map((row: any) => (
            <div
              key={row.id}
              className="subcard"
              style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>#{row.invoice_number || row.invoiceNumber || row.id}</div>
                <div className="soft-text">
                  {row.customer_name || row.customerName || 'Consumidor final'} · {money(Number(row.total ?? 0))}
                </div>
              </div>

              <button className="btn btn--ghost" onClick={() => void openSaleDetail(String(row.id))}>
                Ver detalle
              </button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={detailOpen} onClose={() => setDetailOpen(false)}>
        <h3>Detalle de venta</h3>

        {detailLoading ? (
          <div>Cargando...</div>
        ) : !saleDetail ? (
          <div className="soft-text">No hay detalle disponible.</div>
        ) : (
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <b>Factura:</b> #{saleDetail.invoice_number || saleDetail.invoiceNumber}
            </div>
            <div>
              <b>Cliente:</b> {saleDetail.customer_name || saleDetail.customerName || 'Consumidor final'}
            </div>
            <div>
              <b>Total:</b> {money(Number(saleDetail.total ?? 0))}
            </div>
            <div>
              <b>Factura electrónica:</b> {saleDetail.factus_bill_number || 'No generada'}
            </div>
            <div>
              <b>Estado FE:</b> {saleDetail.factus_status || '—'}
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              {(saleDetail.items ?? []).map((item: any) => (
                <div key={item.id} className="subcard">
                  <div style={{ fontWeight: 700 }}>{item.name || item.description || 'Producto'}</div>
                  <div className="soft-text">
                    {item.qty} × {money(Number(item.unit_price ?? 0))} = {money(Number(item.line_total ?? 0))}
                  </div>
                </div>
              ))}
            </div>

            <div className="actions-row">
              <button className="btn" onClick={() => void handleReprintFromDetail()}>
                Reimprimir
              </button>

              <button
                className="btn btn--ghost"
                onClick={() => {
                  setCreditReasonCode('1');
                  setCreditReasonText('');
                  setCreditAmount(Number(saleDetail?.total ?? 0));
                  setCreditNoteMode('full');
                  setCreditNoteOpen(true);
                }}
                disabled={!saleDetail?.factus_bill_id}
              >
                Nota crédito
              </button>

              <button
                className="btn btn--ghost"
                onClick={() => {
                  setDebitReasonCode('4');
                  setDebitReasonText('');
                  setDebitAmount(0);
                  setDebitNoteOpen(true);
                }}
                disabled={!saleDetail?.factus_bill_id}
              >
                Nota débito
              </button>

              <button className="btn btn--ghost" onClick={() => void handleReturnSale()}>
                Devolver venta
              </button>
            </div>

            <div className="subcard" style={{ display: 'grid', gap: 8 }}>
              <div style={{ fontWeight: 800 }}>Historial electrónico</div>

              {electronicEvents.length === 0 ? (
                <div className="soft-text">No hay eventos electrónicos asociados.</div>
              ) : (
                electronicEvents.map((ev: any) => (
                  <div
                    key={ev.id}
                    className="subcard"
                    style={{ display: 'grid', gap: 6, background: 'rgba(255,255,255,.02)' }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {ev.event_type === 'CREDIT_NOTE' ? 'Nota crédito' : ev.event_type === 'DEBIT_NOTE' ? 'Nota débito' : ev.event_type}
                      {ev.provider_number ? ` · ${ev.provider_number}` : ''}
                    </div>
                    <div className="soft-text">
                      Estado: {ev.status || '—'} · Motivo: {ev.reason_text || ev.reason_code || '—'}
                    </div>
                    {ev.amount != null && (
                      <div className="soft-text">Valor: {money(Number(ev.amount ?? 0))}</div>
                    )}
                    {ev.provider_public_url ? (
                      <a
                        href={ev.provider_public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn--ghost"
                        style={{ width: 'fit-content', textDecoration: 'none' }}
                      >
                        Abrir documento
                      </a>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={creditNoteOpen} onClose={noteBusy ? undefined : () => setCreditNoteOpen(false)}>
        <h3>Emitir nota crédito</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <b>Tipo</b>
            <select
              value={creditNoteMode}
              onChange={(e) => setCreditNoteMode(e.target.value as 'full' | 'partial')}
              disabled={noteBusy}
            >
              <option value="full">Total</option>
              <option value="partial">Parcial por valor</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <b>Código motivo</b>
            <select
              value={creditReasonCode}
              onChange={(e) => setCreditReasonCode(e.target.value)}
              disabled={noteBusy}
            >
              <option value="1">1 - Devolución parcial o total</option>
              <option value="2">2 - Anulación</option>
              <option value="3">3 - Rebaja o descuento</option>
              <option value="4">4 - Ajuste de precio</option>
            </select>
          </label>

          {creditNoteMode === 'partial' && (
            <label style={{ display: 'grid', gap: 6 }}>
              <b>Valor</b>
              <input
                type="number"
                min={1}
                value={creditAmount}
                onChange={(e) => setCreditAmount(Math.max(0, Number(e.target.value || 0)))}
                disabled={noteBusy}
              />
            </label>
          )}

          <label style={{ display: 'grid', gap: 6 }}>
            <b>Motivo / observación</b>
            <textarea
              value={creditReasonText}
              onChange={(e) => setCreditReasonText(e.target.value)}
              disabled={noteBusy}
              rows={4}
            />
          </label>

          <div className="actions-row">
            <button className="btn" onClick={() => void handleCreateCreditNote()} disabled={noteBusy}>
              {noteBusy ? 'Procesando...' : 'Emitir nota crédito'}
            </button>
            <button className="btn btn--ghost" onClick={() => setCreditNoteOpen(false)} disabled={noteBusy}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={debitNoteOpen} onClose={noteBusy ? undefined : () => setDebitNoteOpen(false)}>
        <h3>Emitir nota débito</h3>

        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <b>Código motivo</b>
            <select
              value={debitReasonCode}
              onChange={(e) => setDebitReasonCode(e.target.value)}
              disabled={noteBusy}
            >
              <option value="1">1 - Intereses</option>
              <option value="2">2 - Gastos por cobrar</option>
              <option value="3">3 - Cambio de valor</option>
              <option value="4">4 - Otros ajustes</option>
            </select>
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <b>Valor</b>
            <input
              type="number"
              min={1}
              value={debitAmount}
              onChange={(e) => setDebitAmount(Math.max(0, Number(e.target.value || 0)))}
              disabled={noteBusy}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <b>Motivo / observación</b>
            <textarea
              value={debitReasonText}
              onChange={(e) => setDebitReasonText(e.target.value)}
              disabled={noteBusy}
              rows={4}
            />
          </label>

          <div className="actions-row">
            <button className="btn" onClick={() => void handleCreateDebitNote()} disabled={noteBusy}>
              {noteBusy ? 'Procesando...' : 'Emitir nota débito'}
            </button>
            <button className="btn btn--ghost" onClick={() => setDebitNoteOpen(false)} disabled={noteBusy}>
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={askPrint} onClose={() => setAskPrint(false)}>
        <h3>¿Imprimir factura?</h3>

        <div className="actions-row" style={{ marginTop: 16, marginBottom: 12 }}>
          <button
            className="btn"
            onClick={async () => {
              await printInvoice(pendingInvoice.html);

              if (paymentMethod === 'EFECTIVO') {
                await handleOpenDrawer();
              }

              clearCart();
              clearCustomerData();
              setAskPrint(false);
              setPendingInvoice(null);

              focusScanner();
            }}
          >
            Imprimir POS
          </button>

          <button
            className="btn btn--ghost"
            onClick={async () => {
              clearCart();
              clearCustomerData();
              setAskPrint(false);
              setPendingInvoice(null);

              if (paymentMethod === 'EFECTIVO') {
                await handleOpenDrawer();
              }

              focusScanner();
            }}
          >
            No imprimir
          </button>
        </div>

        {pendingInvoice?.electronicInvoiceUrl ? (
          <div className="subcard" style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontWeight: 800 }}>
              Factura electrónica: {pendingInvoice?.electronicInvoiceNumber || 'Generada'}
            </div>

            <a
              href={pendingInvoice.electronicInvoiceUrl}
              target="_blank"
              rel="noreferrer"
              className="btn"
              style={{ textAlign: 'center', textDecoration: 'none' }}
            >
              Abrir / Imprimir FE
            </a>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};