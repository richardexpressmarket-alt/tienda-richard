import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { CheckCircle, XCircle, Trash2, ChevronDown, ChevronUp, MapPin, Store, Phone, User, Download } from 'lucide-react'
import toast from 'react-hot-toast'

const ESTADOS = { pendiente: 'badge-naranja', procedido: 'badge-verde', no_procede: 'badge-rojo' }
const LABELS  = { pendiente: 'Pendiente', procedido: 'Procedido', no_procede: 'No procede' }

export default function AdminPedidos() {
  const [pedidos, setPedidos]     = useState([])
  const [cargando, setCargando]   = useState(true)
  const [expandido, setExpandido] = useState(null)
  const [filtro, setFiltro]       = useState('pendiente')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .order('created_at', { ascending: false })
    setPedidos(data || [])
    setCargando(false)
  }

  async function proceder(pedido) {
    if (!confirm(`¿Confirmar pedido de ${pedido.nombre_cliente}? Esto descontará el stock.`)) return
    try {
      // 1 — Crear venta
      const { data: venta, error: errV } = await supabase
        .from('ventas')
        .insert({
          tipo: 'online',
          total: pedido.total,
          estado: 'completada',
          nombre_cliente: pedido.nombre_cliente,
          telefono_cliente: pedido.telefono_cliente,
          notas: pedido.tipo_entrega === 'delivery'
            ? `Delivery: ${pedido.direccion} ${pedido.referencia || ''}`
            : 'Recojo en tienda',
        })
        .select()
        .single()
      if (errV) throw errV

      // 2 — Crear items de venta (el trigger descuenta stock automáticamente)
      const items = pedido.items.map(i => ({
        venta_id: venta.id,
        producto_id: i.id,
        nombre_producto: i.nombre,
        precio_unitario: i.precio,
        cantidad: i.cantidad,
        subtotal: i.subtotal,
      }))
      const { error: errI } = await supabase.from('venta_items').insert(items)
      if (errI) throw errI

      // 3 — Marcar pedido como procedido
      await supabase.from('pedidos').update({ estado: 'procedido' }).eq('id', pedido.id)
      toast.success('✅ Pedido confirmado y stock actualizado')
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
  }

  async function noProcede(pedido) {
    if (!confirm(`¿Marcar pedido de ${pedido.nombre_cliente} como "No procede"?`)) return
    await supabase.from('pedidos').update({ estado: 'no_procede' }).eq('id', pedido.id)
    toast.success('Pedido marcado como no procede')
    cargar()
  }

  async function eliminar(pedido) {
    if (!confirm(`¿Eliminar pedido de ${pedido.nombre_cliente}? Esta acción no se puede deshacer.`)) return
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    toast.success('Pedido eliminado')
    cargar()
  }

  function exportarExcel() {
    const filtrados = pedidosFiltrados
    if (filtrados.length === 0) return toast.error('No hay pedidos para exportar')
    const filas = [
      ['Fecha', 'Cliente', 'Teléfono', 'Entrega', 'Dirección', 'Productos', 'Total', 'Estado'],
      ...filtrados.map(p => [
        new Date(p.created_at).toLocaleString('es-PE'),
        p.nombre_cliente,
        p.telefono_cliente || '',
        p.tipo_entrega,
        p.direccion || '',
        p.items.map(i => `${i.nombre} x${i.cantidad}`).join(' | '),
        `S/ ${Number(p.total).toFixed(2)}`,
        LABELS[p.estado]
      ])
    ]
    const csv = filas.map(f => f.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `pedidos_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exportado correctamente')
  }

  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro)
  const conteos = {
    pendiente:  pedidos.filter(p => p.estado === 'pendiente').length,
    procedido:  pedidos.filter(p => p.estado === 'procedido').length,
    no_procede: pedidos.filter(p => p.estado === 'no_procede').length,
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Pedidos WhatsApp<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <button onClick={exportarExcel} className="btn-ghost" style={{ fontSize: 13 }}>
          <Download size={14} /> Exportar Excel
        </button>
      </div>

      {/* Contadores */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { key: 'pendiente',  label: 'Pendientes',   color: 'var(--naranja)' },
          { key: 'procedido',  label: 'Procedidos',   color: '#2E7D32' },
          { key: 'no_procede', label: 'No proceden',  color: '#C62828' },
        ].map(({ key, label, color }) => (
          <button key={key} onClick={() => setFiltro(key)}
            style={{ padding: '14px', borderRadius: 12, border: `2px solid ${filtro === key ? color : 'var(--borde)'}`, background: filtro === key ? color + '12' : 'var(--blanco)', cursor: 'pointer', textAlign: 'center', transition: 'all 0.18s' }}>
            <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, color }}>{conteos[key]}</p>
            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginTop: 2 }}>{label}</p>
          </button>
        ))}
      </div>

      {/* Filtro todos */}
      <div style={{ marginBottom: 16 }}>
        <button onClick={() => setFiltro('todos')}
          style={{ fontSize: 13, color: filtro === 'todos' ? 'var(--naranja)' : 'var(--texto-suave)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: filtro === 'todos' ? 'underline' : 'none' }}>
          Ver todos ({pedidos.length})
        </button>
      </div>

      {cargando ? <div className="spinner" /> : pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <p>No hay pedidos {filtro !== 'todos' ? `"${LABELS[filtro]}"` : ''}</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pedidosFiltrados.map(p => (
            <div key={p.id} className="card" style={{ overflow: 'hidden' }}>
              {/* Cabecera */}
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <User size={14} color="var(--texto-suave)" />
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre_cliente}</p>
                    <span className={`badge ${ESTADOS[p.estado]}`}>{LABELS[p.estado]}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {p.telefono_cliente && (
                      <span style={{ fontSize: 12, color: 'var(--texto-suave)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Phone size={11} /> {p.telefono_cliente}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--texto-suave)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {p.tipo_entrega === 'delivery' ? <MapPin size={11} /> : <Store size={11} />}
                      {p.tipo_entrega === 'delivery' ? `Delivery: ${p.direccion}` : 'Recojo en tienda'}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                      {new Date(p.created_at).toLocaleString('es-PE')}
                    </span>
                  </div>
                </div>

                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 18, color: 'var(--naranja)', flexShrink: 0 }}>
                  S/ {Number(p.total).toFixed(2)}
                </p>

                <button onClick={() => setExpandido(expandido === p.id ? null : p.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, flexShrink: 0 }}>
                  {expandido === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  Ver productos
                </button>
              </div>

              {/* Detalle productos */}
              {expandido === p.id && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '12px 16px', background: 'var(--fondo)' }}>
                  {p.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                      {item.imagen_url && (
                        <img src={item.imagen_url} alt={item.nombre} style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                      )}
                      <p style={{ flex: 1, fontSize: 13 }}>{item.nombre}</p>
                      <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>x{item.cantidad}</p>
                      <p style={{ fontSize: 13, fontWeight: 600 }}>S/ {Number(item.subtotal).toFixed(2)}</p>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
                    <p style={{ fontWeight: 700 }}>Total: <span style={{ color: 'var(--naranja)' }}>S/ {Number(p.total).toFixed(2)}</span></p>
                  </div>
                </div>
              )}

              {/* Acciones */}
              {p.estado === 'pendiente' && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '12px 16px', display: 'flex', gap: 10 }}>
                  <button onClick={() => proceder(p)} className="btn-primary" style={{ flex: 1, justifyContent: 'center', gap: 6, padding: '10px' }}>
                    <CheckCircle size={15} /> Proceder
                  </button>
                  <button onClick={() => noProcede(p)} className="btn-danger" style={{ flex: 1, justifyContent: 'center', gap: 6, padding: '10px', background: '#FFF0F0', color: '#C62828' }}>
                    <XCircle size={15} /> No procede
                  </button>
                </div>
              )}

              {p.estado !== 'pendiente' && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '10px 16px', display: 'flex', justifyContent: 'flex-end' }}>
                  <button onClick={() => eliminar(p)} className="btn-danger" style={{ fontSize: 12 }}>
                    <Trash2 size={13} /> Eliminar pedido
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
