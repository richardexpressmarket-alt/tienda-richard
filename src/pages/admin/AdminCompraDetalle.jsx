import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { ChevronLeft, Pencil, Plus, Search, X, Package, Trash2, Save, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminCompraDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [compra, setCompra]             = useState(null)
  const [items, setItems]               = useState([])
  const [cargando, setCargando]         = useState(true)
  const [editandoCompra, setEditandoCompra] = useState(false)
  const [formCompra, setFormCompra]     = useState({})
  const [editandoItem, setEditandoItem] = useState(null)
  const [formItem, setFormItem]         = useState({})
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productosExistentes, setProductosExistentes] = useState([])
  const [mostrarBuscador, setMostrarBuscador] = useState(null)
  const [guardando, setGuardando]       = useState(false)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setCargando(true)
    const [{ data: c }, { data: it }] = await Promise.all([
      supabase.from('compras').select('*').eq('id', id).single(),
      supabase.from('compra_items').select('*, productos(id, nombre, precio, stock, unidad)').eq('compra_id', id).order('created_at'),
    ])
    setCompra(c)
    setFormCompra({
      fecha_compra: c?.fecha_compra || '',
      hora_compra:  c?.hora_compra  || '',
      empresa:      c?.empresa      || '',
      ruc:          c?.ruc          || '',
      numero_boleta: c?.numero_boleta || '',
      total:        c?.total        || '',
      notas:        c?.notas        || '',
    })
    setItems(it || [])
    setCargando(false)
  }

  async function buscarProductos(q) {
    setBusquedaProducto(q)
    if (q.trim().length < 1) { setProductosExistentes([]); return }
    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio, stock, unidad')
      .ilike('nombre', `%${q}%`)
      .limit(8)
    setProductosExistentes(data || [])
  }

  async function guardarCompra() {
    setGuardando(true)
    const { error } = await supabase.from('compras').update({
      ...formCompra,
      total: formCompra.total ? Number(formCompra.total) : null,
    }).eq('id', id)
    if (error) { toast.error('Error al guardar'); setGuardando(false); return }
    toast.success('Boleta actualizada ✅')
    setEditandoCompra(false)
    setGuardando(false)
    cargar()
  }

  async function guardarItem() {
    if (!formItem.nombre_producto) return toast.error('El nombre es obligatorio')
    setGuardando(true)
    const precioSugerido = formItem.precio_unitario
      ? Math.round(Number(formItem.precio_unitario) * 1.30 * 100) / 100
      : null
    const payload = {
      nombre_producto: formItem.nombre_producto,
      cantidad:        formItem.cantidad        ? Number(formItem.cantidad)        : null,
      precio_unitario: formItem.precio_unitario ? Number(formItem.precio_unitario) : null,
      subtotal:        formItem.subtotal        ? Number(formItem.subtotal)        : null,
      precio_sugerido: precioSugerido,
      producto_id:     formItem.producto_id     || null,
    }
    if (editandoItem === 'nuevo') {
      const { error } = await supabase.from('compra_items').insert({ ...payload, compra_id: id })
      if (error) { toast.error('Error: ' + error.message); setGuardando(false); return }
      toast.success('Producto agregado ✅')
    } else {
      const { error } = await supabase.from('compra_items').update(payload).eq('id', editandoItem)
      if (error) { toast.error('Error: ' + error.message); setGuardando(false); return }
      toast.success('Producto actualizado ✅')
    }
    setEditandoItem(null)
    setFormItem({})
    setGuardando(false)
    cargar()
  }

  async function eliminarItem(itemId) {
    if (!confirm('¿Eliminar este producto de la boleta?')) return
    await supabase.from('compra_items').delete().eq('id', itemId)
    toast.success('Producto eliminado')
    cargar()
  }

  async function eliminarCompra() {
    if (!confirm('¿Eliminar esta boleta completa? No se puede deshacer.')) return
    await supabase.from('compras').delete().eq('id', id)
    toast.success('Boleta eliminada')
    navigate('/admin/compras')
  }

  function abrirEditar(item) {
    setEditandoItem(item.id)
    setFormItem({
      nombre_producto: item.nombre_producto || '',
      cantidad:        item.cantidad        || '',
      precio_unitario: item.precio_unitario || '',
      subtotal:        item.subtotal        || '',
      producto_id:     item.producto_id     || null,
    })
    setMostrarBuscador(null)
    setBusquedaProducto('')
    setProductosExistentes([])
  }

  function abrirNuevo() {
    setEditandoItem('nuevo')
    setFormItem({ nombre_producto: '', cantidad: '', precio_unitario: '', subtotal: '', producto_id: null })
    setMostrarBuscador(null)
    setBusquedaProducto('')
    setProductosExistentes([])
  }

  function vincularProductoExistente(prod, itemId) {
    // Navega a productos con parámetros para abrir editar automáticamente
    navigate(`/admin/productos?editar=${prod.id}&desde=compra&compra=${id}`)
  }

  function irNuevoProducto() {
    navigate(`/admin/productos?nuevo=true&desde=compra&compra=${id}`)
  }

  if (cargando) return <div style={{ padding: 24 }}><div className="spinner" /></div>
  if (!compra)  return <div style={{ padding: 24 }}>Boleta no encontrada</div>

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button onClick={() => navigate('/admin/compras')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: 'var(--texto-suave)' }}>
          <ChevronLeft size={16} /> Volver
        </button>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 22, fontWeight: 800, flex: 1 }}>
          {compra.empresa || 'Boleta sin empresa'}<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <button onClick={eliminarCompra} className="btn-danger" style={{ fontSize: 12 }}>
          <Trash2 size={13} /> Eliminar boleta
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Imagen boleta */}
        {compra.imagen_url && (
          <div className="card" style={{ overflow: 'hidden', gridRow: 'span 2' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontWeight: 600, fontSize: 14 }}>Imagen de la boleta</p>
              <a href={compra.imagen_url} target="_blank" rel="noreferrer"
                style={{ fontSize: 12, color: 'var(--naranja)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <ExternalLink size={12} /> Ver completa
              </a>
            </div>
            <img src={compra.imagen_url} alt="boleta"
              style={{ width: '100%', maxHeight: 400, objectFit: 'contain', background: 'var(--fondo)', padding: 8 }} />
          </div>
        )}

        {/* Datos de la boleta */}
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600 }}>Datos de la boleta</h2>
            <button onClick={() => setEditandoCompra(!editandoCompra)} className="btn-ghost" style={{ fontSize: 12, padding: '5px 10px' }}>
              <Pencil size={12} /> {editandoCompra ? 'Cancelar' : 'Editar'}
            </button>
          </div>

          {editandoCompra ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Empresa', key: 'empresa', placeholder: 'Nombre del proveedor' },
                { label: 'RUC', key: 'ruc', placeholder: 'Número de RUC' },
                { label: 'N° Boleta', key: 'numero_boleta', placeholder: 'Número de boleta' },
                { label: 'Fecha', key: 'fecha_compra', type: 'date' },
                { label: 'Hora', key: 'hora_compra', placeholder: 'HH:MM' },
                { label: 'Total (S/)', key: 'total', type: 'number', placeholder: '0.00' },
                { label: 'Notas', key: 'notas', placeholder: 'Observaciones' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 4, display: 'block', color: 'var(--texto-suave)' }}>{label}</label>
                  <input type={type || 'text'} value={formCompra[key] || ''} onChange={e => setFormCompra({ ...formCompra, [key]: e.target.value })} placeholder={placeholder} style={{ fontSize: 13 }} />
                </div>
              ))}
              <button onClick={guardarCompra} className="btn-primary" disabled={guardando} style={{ justifyContent: 'center', marginTop: 4 }}>
                <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Empresa', valor: compra.empresa },
                { label: 'RUC', valor: compra.ruc },
                { label: 'N° Boleta', valor: compra.numero_boleta },
                { label: 'Fecha', valor: compra.fecha_compra ? new Date(compra.fecha_compra + 'T12:00:00').toLocaleDateString('es-PE') : null },
                { label: 'Hora', valor: compra.hora_compra },
                { label: 'Total', valor: compra.total ? `S/ ${Number(compra.total).toFixed(2)}` : null },
                { label: 'Notas', valor: compra.notas },
              ].map(({ label, valor }) => (
                <div key={label} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)', minWidth: 80 }}>{label}:</span>
                  <span style={{ fontSize: 13, fontWeight: valor ? 500 : 400, color: valor ? 'var(--texto)' : 'var(--texto-suave)' }}>
                    {valor || '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>
            Productos de la boleta
            <span style={{ fontSize: 12, color: 'var(--texto-suave)', marginLeft: 8, fontWeight: 400 }}>{items.length} items</span>
          </h2>
          <button onClick={abrirNuevo} className="btn-primary" style={{ fontSize: 12, padding: '7px 12px' }}>
            <Plus size={13} /> Agregar producto
          </button>
        </div>

        {/* Cabecera tabla */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px', gap: 8, padding: '8px 20px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}>
          {['Producto', 'Cantidad', 'Precio compra', 'Subtotal', 'Precio sugerido (+30%)', 'Acciones'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--texto-suave)' }}>
            <Package size={32} style={{ margin: '0 auto 8px', opacity: 0.2 }} />
            <p style={{ fontSize: 13 }}>No se detectaron productos. Agrégalos manualmente.</p>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px', gap: 8, padding: '12px 20px', borderBottom: '1px solid var(--borde)', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{item.nombre_producto || '—'}</p>
                  {item.productos && (
                    <span style={{ fontSize: 11, background: 'var(--naranja-light)', color: 'var(--naranja-dark)', padding: '2px 8px', borderRadius: 20, fontWeight: 500 }}>
                      ✓ Vinculado: {item.productos.nombre}
                    </span>
                  )}
                </div>
                <p style={{ fontSize: 13 }}>{item.cantidad ?? '—'}</p>
                <p style={{ fontSize: 13 }}>{item.precio_unitario ? `S/ ${Number(item.precio_unitario).toFixed(2)}` : '—'}</p>
                <p style={{ fontSize: 13, fontWeight: 600 }}>{item.subtotal ? `S/ ${Number(item.subtotal).toFixed(2)}` : '—'}</p>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>
                  {item.precio_sugerido ? `S/ ${Number(item.precio_sugerido).toFixed(2)}` : '—'}
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => abrirEditar(item)} className="btn-ghost" style={{ padding: '5px 8px', fontSize: 11 }}>
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setMostrarBuscador(mostrarBuscador === item.id ? null : item.id)}
                    className="btn-ghost" style={{ padding: '5px 8px', fontSize: 11, color: 'var(--naranja)' }} title="Vincular a producto existente">
                    <Search size={12} />
                  </button>
                  <button onClick={() => eliminarItem(item.id)} className="btn-danger" style={{ padding: '5px 8px' }}>
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Buscador de producto existente inline */}
              {mostrarBuscador === item.id && (
                <div style={{ padding: '12px 20px', background: 'var(--naranja-light)', borderBottom: '1px solid var(--naranja-mid)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--naranja-dark)' }}>Vincular "{item.nombre_producto}" a un producto existente:</p>
                    <button onClick={() => setMostrarBuscador(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', marginLeft: 'auto' }}>
                      <X size={16} color="var(--texto-suave)" />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
                      <input value={busquedaProducto} onChange={e => buscarProductos(e.target.value)}
                        placeholder="Buscar producto en tu inventario..." style={{ paddingLeft: 30, fontSize: 13, background: 'var(--blanco)' }} autoFocus />
                    </div>
                    <button onClick={irNuevoProducto} className="btn-primary" style={{ fontSize: 12, padding: '7px 12px', flexShrink: 0 }}>
                      <Plus size={13} /> Producto nuevo
                    </button>
                  </div>
                  {productosExistentes.length > 0 && (
                    <div style={{ background: 'var(--blanco)', borderRadius: 8, border: '1px solid var(--borde)', overflow: 'hidden' }}>
                      {productosExistentes.map(prod => (
                        <button key={prod.id} onClick={() => vincularProductoExistente(prod, item.id)}
                          style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', borderBottom: '1px solid var(--borde)', cursor: 'pointer', textAlign: 'left' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--naranja-light)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                          <Package size={15} color="var(--naranja)" />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: 13, fontWeight: 600 }}>{prod.nombre}</p>
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                              {prod.unidad} · Stock: {prod.stock} · S/ {Number(prod.precio).toFixed(2)}
                            </p>
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontSize: 11, color: 'var(--naranja)', fontWeight: 500 }}>Precio sugerido:</p>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#2E7D32' }}>
                              S/ {(Number(item.precio_unitario || prod.precio) * 1.30).toFixed(2)}
                            </p>
                          </div>
                          <ExternalLink size={14} color="var(--naranja)" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modal editar/nuevo item */}
      {editandoItem && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 17 }}>
                {editandoItem === 'nuevo' ? 'Agregar producto' : 'Editar producto'}
              </h2>
              <button onClick={() => setEditandoItem(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} color="var(--texto-suave)" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, display: 'block' }}>Nombre del producto *</label>
                <input value={formItem.nombre_producto} onChange={e => setFormItem({ ...formItem, nombre_producto: e.target.value })} placeholder="Ej: Arroz Extra" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, display: 'block' }}>Cantidad</label>
                  <input type="number" min="0" step="0.01" value={formItem.cantidad} onChange={e => setFormItem({ ...formItem, cantidad: e.target.value })} placeholder="0" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, display: 'block' }}>Precio unitario (S/)</label>
                  <input type="number" min="0" step="0.01" value={formItem.precio_unitario}
                    onChange={e => {
                      const pu = e.target.value
                      const sub = formItem.cantidad ? (Number(pu) * Number(formItem.cantidad)).toFixed(2) : formItem.subtotal
                      setFormItem({ ...formItem, precio_unitario: pu, subtotal: sub })
                    }} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, display: 'block' }}>Subtotal (S/)</label>
                  <input type="number" min="0" step="0.01" value={formItem.subtotal} onChange={e => setFormItem({ ...formItem, subtotal: e.target.value })} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, marginBottom: 5, display: 'block' }}>Precio sugerido (+30%)</label>
                  <input readOnly value={formItem.precio_unitario ? `S/ ${(Number(formItem.precio_unitario) * 1.30).toFixed(2)}` : '—'}
                    style={{ background: '#E8F5E9', color: '#2E7D32', fontWeight: 600, cursor: 'default' }} />
                </div>
              </div>

              <div style={{ background: 'var(--naranja-light)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--naranja-dark)', lineHeight: 1.5 }}>
                💡 El precio sugerido es el precio de compra + 30% de margen. Puedes ajustarlo editando el producto en el inventario.
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setEditandoItem(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={guardarItem} className="btn-primary" disabled={guardando} style={{ flex: 1, justifyContent: 'center' }}>
                  <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
