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
} from '../services/sales';
import { Modal } from '../ui/Modal';
import { buildInvoiceHtml } from '../invoice/invoiceTemplate';
import { getConfig } from '../services/config';

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

  const [biz, setBiz] = useState<{ name?: string; logoDataUrl?: string }>({});

  const [suspendedOpen, setSuspendedOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [suspendedRows, setSuspendedRows] = useState<any[]>([]);
  const [recentRows, setRecentRows] = useState<any[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [saleDetail, setSaleDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
    const handleShortcut = async (e: KeyboardEvent) => {
      if (e.key !== 'F6') return;

      e.preventDefault();

      try {
        const defaultPort = localStorage.getItem('cashdrawer_port') || 'COM3';
        const defaultBaudRate = Number(localStorage.getItem('cashdrawer_baudrate') || '9600');

        const res = await (window as any).api.cashdrawer.open({
          port: defaultPort,
          baudRate: defaultBaudRate,
        });

        if (!res?.ok) {
          setMessage(res?.message || 'No se pudo abrir el cajón.');
          return;
        }

        setMessage(`Cajón abierto en ${res.port}`);
      } catch (err: any) {
        setMessage(err?.message || 'No se pudo abrir el cajón.');
      }
    };

    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  const onRootClick = (e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('input, textarea, select, button')) return;
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
    focusScanner();
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

  const handleSuspendSale = async () => {
    if (cart.length === 0) {
      setMessage('No hay productos para suspender.');
      return;
    }

    try {
      const res = await suspendSale({
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
      setCustomerName('');
      setCustomerId('');
      setMessage(`Venta suspendida correctamente.`);
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

      await deleteSuspendedSale(id);
      await loadSuspended();
      setSuspendedOpen(false);
      setMessage(`Venta reanudada correctamente.`);
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
      setDetailOpen(true);
    } catch (e: any) {
      setMessage(e?.message || 'No se pudo cargar el detalle.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleReprintFromDetail = async () => {
    if (!saleDetail) return;

    const html = buildInvoiceHtml({
      invoiceNumber: String(saleDetail.invoice_number ?? ''),
      createdAt: saleDetail.date ?? new Date().toISOString(),
      cashierName: saleDetail.user_name || saleDetail.user_email || 'Cajero',
      paymentMethod: saleDetail.payment_method || 'EFECTIVO',
      customerName: saleDetail.customer_name || 'Consumidor final',
      customerId: saleDetail.customer_id || '',
      subtotal: Number(saleDetail.subtotal ?? 0),
      discount: Number(saleDetail.discount ?? 0),
      total: Number(saleDetail.total ?? 0),
      cashReceived: 0,
      cashChange: 0,
      businessName: biz?.name || '',
      businessLogoDataUrl: biz?.logoDataUrl || '',
      items: (saleDetail.items ?? []).map((i: any) => ({
        name: i.name ?? i.description ?? 'Producto',
        description: i.description || '',
        qty: Number(i.qty ?? 0),
        unit_price: Number(i.unit_price ?? 0),
        line_total: Number(i.line_total ?? 0),
      })),
    });

    await printInvoice(html);
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

  const confirm = async (): Promise<void> => {
    if (isProcessing) return;
    if (cart.length === 0) return setMessage('El carrito está vacío.');

    if (paymentMethod === 'EFECTIVO' && cashReceived < total) {
      return setMessage(`Falta dinero. Debes recibir mínimo ${money(total)}.`);
    }

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
        customerName: customerName?.trim() || '',
        customerId: customerId?.trim() || '',
        cashReceived: paymentMethod === 'EFECTIVO' ? cashReceived : 0,
        cashChange: paymentMethod === 'EFECTIVO' ? change : 0,
      });

      const html = buildInvoiceHtml({
        invoiceNumber: String(res.invoiceNumber ?? ''),
        createdAt: new Date().toISOString(),
        cashierName: user?.name || user?.email || 'Cajero',
        paymentMethod,
        customerName: customerName?.trim() || 'Consumidor final',
        customerId: customerId?.trim() || '',
        subtotal,
        discount,
        total,
        cashReceived: paymentMethod === 'EFECTIVO' ? cashReceived : 0,
        cashChange: paymentMethod === 'EFECTIVO' ? change : 0,
        businessName: biz?.name || '',
        businessLogoDataUrl: biz?.logoDataUrl || '',
        items: cart.map((i: any) => ({
          name: i.name,
          description: i.description || '',
          qty: Number(i.qty ?? 0),
          unit_price: Number(i.unit_price ?? 0),
          line_total: Number(i.line_total ?? 0),
        })),
      });

      await printInvoice(html);

      clearCart();
      setCustomerName('');
      setCustomerId('');
      setMessage(`Venta realizada. Factura #${String(res.invoiceNumber ?? '')}`);
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

      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Punto de venta</div>
          <h2 className="dashboard__title">Cobro rápido y control del carrito</h2>
          <p className="dashboard__text">
            Busca productos, escanea códigos, agrega ítems libres y finaliza ventas con distintos métodos de pago.
          </p>
        </div>
      </div>

      <div className="pos">
        <section className="pos__left card">
          <div
            className="card"
            style={{
              marginBottom: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {biz?.logoDataUrl ? (
              <img
                src={biz.logoDataUrl}
                alt="logo"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  objectFit: 'contain',
                  background: 'rgba(255,255,255,.06)',
                  padding: 6,
                }}
              />
            ) : (
              <div className="sidebar__logo">S</div>
            )}

            <div>
              <div style={{ fontWeight: 1000, fontSize: 18 }}>
                Bienvenido{biz?.name ? ` a ${biz.name}` : ''}
              </div>
              <div className="sidebar__subtitle">Powered by Sistetecni POS</div>
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
                <div className="pos__product-title">{displayName(p)}</div>
                <div className="pos__product-sub">
                  <span>{String(p?.sku ?? p?.barcode ?? p?.cpu ?? '').trim() || '—'}</span>
                  <span>Stock: {p.stock}</span>
                </div>
                <div className="pos__product-price">{money(Number(p.sale_price ?? 0))}</div>
              </button>
            ))}

            {products.length === 0 && (
              <div style={{ opacity: 0.85, padding: 10 }}>No hay productos para mostrar.</div>
            )}
          </div>
        </section>

        <section className="pos__right card">
          <div className="pos__right-header">
            <h3 style={{ margin: 0 }}>Carrito</h3>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn--ghost" onClick={clearCart} disabled={isProcessing}>
                Vaciar
              </button>
              <button className="btn btn--ghost" onClick={clearCart} disabled={isProcessing}>
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
                Ventas recientes
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
            <input
              placeholder="Nombre del cliente (opcional)"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <input
              placeholder="Documento o identificación (opcional)"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            />
          </div>

          <div className="pos__cart">
            {cart.map((i) => (
              <div key={i.cart_id} className="pos__cart-row">
                <div className="pos__cart-info">
                  <div className="pos__cart-name">{i.name}</div>
                  <div className="pos__cart-meta">
                    <span>{money(i.unit_price)} c/u</span>
                    {i.stock != null && <span>Disp: {i.stock}</span>}
                  </div>
                </div>

                <div className="pos__qty">
                  <button className="qtybtn" onClick={() => setQty(i.cart_id, i.qty - 1)} disabled={isProcessing}>
                    −
                  </button>
                  <input
                    className="qtyinput"
                    type="number"
                    min={1}
                    max={i.stock ?? undefined}
                    value={i.qty}
                    disabled={isProcessing}
                    onChange={(e) => setQty(i.cart_id, Number(e.target.value || 1))}
                  />
                  <button className="qtybtn" onClick={() => setQty(i.cart_id, i.qty + 1)} disabled={isProcessing}>
                    +
                  </button>
                </div>

                <div className="pos__line-total">{money(i.line_total)}</div>

                <button className="btn btn--ghost" onClick={() => removeItem(i.cart_id)} disabled={isProcessing}>
                  Eliminar
                </button>
              </div>
            ))}

            {cart.length === 0 && <div className="pos__empty">Agrega productos para iniciar una venta.</div>}
          </div>

          <div className="pos__pay card" style={{ marginTop: 12 }}>
            <div className="pos__pay-row">
              <span>Subtotal</span>
              <b>{money(subtotal)}</b>
            </div>

            <div className="pos__pay-row" style={{ alignItems: 'center', gap: 10 }}>
              <span>Descuento</span>
              <input
                style={{ width: 160 }}
                type="number"
                min={0}
                value={discount}
                disabled={isProcessing}
                onChange={(e) => setDiscount(Math.max(0, Number(e.target.value || 0)))}
                placeholder="0"
              />
            </div>

            <div className="pos__pay-method">
              <div style={{ fontWeight: 800, marginBottom: 8 }}>Método de pago</div>
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

            {paymentMethod === 'EFECTIVO' && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Pago en efectivo</div>

                <div className="pos__pay-row" style={{ alignItems: 'center', gap: 10 }}>
                  <span>Efectivo recibido</span>
                  <input
                    style={{ width: 180 }}
                    inputMode="numeric"
                    value={cashReceivedStr}
                    disabled={isProcessing}
                    onChange={(e) => setCashReceivedStr(e.target.value)}
                    placeholder="Ej: 20000"
                  />
                </div>

                <div style={{ marginTop: 10 }}>
                  <div style={{ opacity: 0.85 }}>Cambio a devolver</div>
                  <div style={{ fontSize: 26, fontWeight: 900 }}>{money(change)}</div>
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

            <button className="pos__confirm" onClick={confirm} disabled={!canConfirm}>
              {isProcessing ? 'Procesando...' : 'Cobrar'}
            </button>

            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn--ghost"
                onClick={handleSuspendSale}
                disabled={isProcessing || cart.length === 0}
              >
                Suspender venta
              </button>

              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 13 }}>
                Atajo rápido: presiona <b>F6</b> para abrir el cajón.
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

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
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
          {suspendedRows.length === 0 && (
            <div style={{ opacity: 0.8 }}>No hay ventas suspendidas.</div>
          )}

          {suspendedRows.map((row: any) => (
            <div
              key={row.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.03)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  {row.temp_number || row.tempNumber || 'Venta suspendida'}
                </div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
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
          {recentRows.length === 0 && (
            <div style={{ opacity: 0.8 }}>No hay ventas recientes.</div>
          )}

          {recentRows.map((row: any) => (
            <div
              key={row.id}
              style={{
                padding: 12,
                borderRadius: 14,
                border: '1px solid rgba(255,255,255,.08)',
                background: 'rgba(255,255,255,.03)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div>
                <div style={{ fontWeight: 800 }}>
                  #{row.invoice_number || row.invoiceNumber || row.id}
                </div>
                <div style={{ opacity: 0.8, fontSize: 13 }}>
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
          <div style={{ opacity: 0.8 }}>No hay detalle disponible.</div>
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

            <div style={{ display: 'grid', gap: 8 }}>
              {(saleDetail.items ?? []).map((item: any) => (
                <div
                  key={item.id}
                  style={{
                    padding: 10,
                    borderRadius: 12,
                    border: '1px solid rgba(255,255,255,.08)',
                    background: 'rgba(255,255,255,.03)',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {item.name || item.description || 'Producto'}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13 }}>
                    {item.qty} × {money(Number(item.unit_price ?? 0))} = {money(Number(item.line_total ?? 0))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => void handleReprintFromDetail()}>
                Reimprimir
              </button>
              <button className="btn btn--ghost" onClick={() => void handleReturnSale()}>
                Devolver venta
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};