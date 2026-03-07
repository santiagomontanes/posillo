import { useEffect, useRef, useState } from 'react';
import { archiveProduct, listProducts, saveProduct, updateProduct } from '../services/products';
import { Modal } from '../ui/Modal';

const base = {
  name: '',
  barcode: '',
  category: '',
  unit: '',
  purchase_price: 0,
  sale_price: 0,
  stock: 1,
  min_stock: 0,
  notes: '',
};

const numericKeys = ['purchase_price', 'sale_price', 'stock', 'min_stock'] as const;

const FIELDS: Array<{
  key: keyof typeof base;
  label: string;
  placeholder?: string;
  type?: 'text' | 'number';
}> = [
  { key: 'name', label: 'Nombre', placeholder: 'Nombre del producto' },
  { key: 'barcode', label: 'Código de barras', placeholder: 'Escanea o escribe el código' },
  { key: 'category', label: 'Categoría', placeholder: 'Ej: bebidas, tecnología, aseo' },
  { key: 'unit', label: 'Unidad', placeholder: 'Ej: und, kg, caja, lb' },
  { key: 'purchase_price', label: 'Precio de compra', type: 'number' },
  { key: 'sale_price', label: 'Precio de venta', type: 'number' },
  { key: 'stock', label: 'Stock', type: 'number' },
  { key: 'min_stock', label: 'Stock mínimo', type: 'number' },
  { key: 'notes', label: 'Notas', placeholder: 'Observaciones opcionales' },
];

const isInvalid = (data: any) =>
  data.stock < 0 || data.min_stock < 0 || data.purchase_price < 0 || data.sale_price < 0;

const money = (n: number): string =>
  new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(Number(n || 0));

export const Inventory = ({ role }: { role: string }) => {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState<any>(base);
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<any>(base);
  const [busy, setBusy] = useState(false);
  const loadId = useRef(0);

  const load = async (query = q): Promise<void> => {
    const id = ++loadId.current;
    try {
      const data = await listProducts(query);
      if (id === loadId.current) setItems(data);
    } catch (e: any) {
      if (id === loadId.current) alert(e?.message || 'No se pudo cargar el inventario.');
    }
  };

  useEffect(() => {
    void load(q);
  }, [q]);

  useEffect(
    () => () => {
      loadId.current += 1;
      setEditing(null);
    },
    [],
  );

  useEffect(() => {
    if (!editing) setEditForm(base);
  }, [editing]);

  const onChange = (setter: any, data: any, key: string, value: string) => {
    setter({
      ...data,
      [key]: (numericKeys as readonly string[]).includes(key) ? Number(value) : value,
    });
  };

  const validateRequired = (data: any): string | null => {
    if (!String(data?.name ?? '').trim()) return 'El nombre del producto es obligatorio.';
    return null;
  };

  return (
    <div className="dashboard">
      <div className="card dashboard__hero">
        <div>
          <div className="dashboard__eyebrow">Inventario</div>
          <h2 className="dashboard__title">Gestión de productos</h2>
          <p className="dashboard__text">
            Administra productos, stock, precios y niveles mínimos de inventario.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="dashboard__section-title">Nuevo producto</div>

        <div className="grid grid-2">
          {FIELDS.map((f) => (
            <label key={String(f.key)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{f.label}</span>
              <input
                disabled={busy}
                type={f.type ?? ((numericKeys as readonly string[]).includes(String(f.key)) ? 'number' : 'text')}
                placeholder={f.placeholder ?? ''}
                value={form[f.key] ?? ''}
                onChange={(e) => onChange(setForm, form, String(f.key), e.target.value)}
              />
            </label>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <button
            disabled={busy}
            onClick={async () => {
              const req = validateRequired(form);
              if (req) return alert(req);
              if (isInvalid(form)) return alert('Valores inválidos: stock y precios no pueden ser negativos.');

              setBusy(true);
              try {
                const payload = {
                  ...form,
                  name: String(form.name || '').trim(),
                  barcode: String(form.barcode || '').trim(),
                  category: String(form.category || '').trim(),
                  unit: String(form.unit || '').trim(),
                  notes: String(form.notes || '').trim(),
                };

                await saveProduct(payload);
                setForm(base);
                await load(q);
              } catch (e: any) {
                alert(e?.message || 'No se pudo guardar el producto.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar producto
          </button>
        </div>
      </div>

      <div className="card">
        <div
          style={{
            display: 'flex',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <input
            disabled={busy}
            placeholder="Buscar por nombre, código o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ minWidth: 280, flex: 1 }}
          />
          <button disabled={busy} className="btn btn--ghost" onClick={() => void load(q)}>
            Buscar
          </button>
        </div>

        <div className="dashboard__section-title">Listado de productos</div>

        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Código</th>
              <th>Precio</th>
              <th>Stock</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {items.map((p: any) => {
              const min = Number(p.min_stock ?? 0);
              const stk = Number(p.stock ?? 0);
              const low = min > 0 ? stk <= min : stk <= 1;

              return (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 800 }}>{p.name ?? '—'}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      {(p.category ? `${p.category}` : '')}
                      {(p.unit ? (p.category ? ` • ${p.unit}` : `${p.unit}`) : '')}
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.barcode || '—'}</td>
                  <td>{money(Number(p.sale_price ?? 0))}</td>
                  <td className={low ? 'low-stock' : ''}>
                    {stk}
                    {min > 0 ? <span style={{ opacity: 0.8 }}> / min {min}</span> : null}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        disabled={busy}
                        className="btn btn--ghost"
                        onClick={() => {
                          setEditing(p);
                          setEditForm({ ...base, ...p });
                        }}
                      >
                        Editar
                      </button>

                      {role === 'ADMIN' && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            const prevItems = items;
                            setItems(prevItems.filter((x: any) => x.id !== p.id));
                            setBusy(true);
                            try {
                              await archiveProduct(p.id);
                              await load(q);
                            } catch (e: any) {
                              setItems(prevItems);
                              alert(e?.message || 'No se pudo archivar el producto.');
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Archivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={5} style={{ padding: 14, opacity: 0.8 }}>
                  No hay productos para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={Boolean(editing)} onClose={busy ? undefined : () => setEditing(null)}>
        <h3>Editar producto</h3>

        <div className="grid grid-2">
          {FIELDS.map((f) => (
            <label key={String(f.key)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>{f.label}</span>
              <input
                disabled={busy}
                type={f.type ?? ((numericKeys as readonly string[]).includes(String(f.key)) ? 'number' : 'text')}
                placeholder={f.placeholder ?? ''}
                value={editForm[f.key] ?? ''}
                onChange={(e) => onChange(setEditForm, editForm, String(f.key), e.target.value)}
              />
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button
            disabled={busy}
            onClick={async () => {
              const req = validateRequired(editForm);
              if (req) return alert(req);
              if (isInvalid(editForm)) return alert('Valores inválidos: stock y precios no pueden ser negativos.');

              setBusy(true);
              try {
                if (!editing?.id) {
                  alert('Missing product id');
                  return;
                }

                const payload = {
                  ...editForm,
                  id: editing.id,
                  name: String(editForm.name || '').trim(),
                  barcode: String(editForm.barcode || '').trim(),
                  category: String(editForm.category || '').trim(),
                  unit: String(editForm.unit || '').trim(),
                  notes: String(editForm.notes || '').trim(),
                };

                await updateProduct(payload);
                setEditing(null);
                await load(q);
              } catch (e: any) {
                alert(e?.message || 'No se pudo actualizar el producto.');
              } finally {
                setBusy(false);
              }
            }}
          >
            Guardar cambios
          </button>
          <button disabled={busy} className="btn btn--ghost" onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
};