import { useEffect, useRef, useState } from 'react';
import { archiveProduct, listProducts, saveProduct, updateProduct } from '../services/products';
import { Modal } from '../ui/Modal';

// ✅ Producto genérico (cualquier negocio)
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
  { key: 'name', label: 'Nombre', placeholder: 'nombre del producto' },
  { key: 'barcode', label: 'Código de barras', placeholder: 'escanea el codigo de barras' },
  { key: 'category', label: 'Categoría', placeholder: ' (opcional)' },
  { key: 'unit', label: 'Unidad', placeholder: 'Ej: und, kg, lb, caja (opcional)' },

  { key: 'purchase_price', label: 'Precio de compra', type: 'number' },
  { key: 'sale_price', label: 'Precio de venta', type: 'number' },
  { key: 'stock', label: 'Stock', type: 'number' },
  { key: 'min_stock', label: 'Stock mínimo', type: 'number' },

  { key: 'notes', label: 'Notas', placeholder: 'Opcional' },
];

const isInvalid = (data: any) =>
  data.stock < 0 || data.min_stock < 0 || data.purchase_price < 0 || data.sale_price < 0;

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
    // barcode es opcional (hay negocios sin código de barras)
    return null;
  };

  return (
    <div>
      {/* ======= NUEVO PRODUCTO ======= */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Nuevo producto</h3>

        <div className="grid grid-2">
          {FIELDS.map((f) => (
            <label key={String(f.key)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
              <input
                disabled={busy}
                type={f.type ?? ((numericKeys as readonly string[]).includes(String(f.key)) ? 'number' : 'text')}
                placeholder={f.placeholder ?? ''}
                value={form[f.key] ?? ''}
                onChange={(e) => onChange(setForm, form, String(f.key), e.target.value)}
              />
            </label>
          ))}

          <button
            disabled={busy}
            onClick={async () => {
              const req = validateRequired(form);
              if (req) return alert(req);
              if (isInvalid(form)) return alert('Valores inválidos: stock y precios no pueden ser negativos.');

              setBusy(true);
              try {
                // 🔎 normaliza strings
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

      {/* ======= LISTA / BUSCAR ======= */}
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
          <input
            disabled={busy}
            placeholder="Buscar por nombre, código de barras o categoría"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button disabled={busy} onClick={() => void load(q)}>
            Buscar
          </button>
        </div>

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
                  <td>{p.sale_price}</td>
                  <td className={low ? 'low-stock' : ''}>
                    {stk}
                    {min > 0 ? <span style={{ opacity: 0.8 }}> / min {min}</span> : null}
                  </td>
                  <td>
                    <button
                      disabled={busy}
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

      {/* ======= MODAL EDITAR ======= */}
      <Modal open={Boolean(editing)} onClose={busy ? undefined : () => setEditing(null)}>
        <h3>Editar producto</h3>

        <div className="grid grid-2">
          {FIELDS.map((f) => (
            <label key={String(f.key)} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{f.label}</span>
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

        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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
          <button disabled={busy} onClick={() => setEditing(null)}>
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
};