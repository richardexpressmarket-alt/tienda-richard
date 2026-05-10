import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Printer, Search, Filter } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminPrecios() {
  const [productos, setProductos]         = useState([])
  const [categorias, setCategorias]       = useState([])
  const [busqueda, setBusqueda]           = useState('')
  const [filtroCat, setFiltroCat]         = useState('')
  const [cargando, setCargando]           = useState(true)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [todosMarcados, setTodosMarcados] = useState(true)

  useEffect(() => {
    cargar()
    const canal = supabase
      .channel('precios-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, () => cargar())
      .subscribe()
    return () => supabase.removeChannel(canal)
  }, [])

  async function cargar() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('productos').select('*, categorias(nombre)').eq('activo', true).order('nombre'),
      supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setProductos(prods || [])
    setCategorias(cats || [])
    setSeleccionados(new Set((prods || []).map(p => p.id)))
    setCargando(false)
  }

  const filtrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat  = filtroCat ? p.categoria_id === filtroCat : true
    return matchBusq && matchCat
  })

  const paraImprimir = filtrados.filter(p => seleccionados.has(p.id))

  function toggleProducto(id) {
    setSeleccionados(prev => {
      const nuevo = new Set(prev)
      nuevo.has(id) ? nuevo.delete(id) : nuevo.add(id)
      return nuevo
    })
  }

  function toggleTodos() {
    if (todosMarcados) {
      setSeleccionados(new Set())
      setTodosMarcados(false)
    } else {
      setSeleccionados(new Set(filtrados.map(p => p.id)))
      setTodosMarcados(true)
    }
  }

  function handleImprimir() {
    const conPrecio = paraImprimir.filter(p => Number(p.precio_oferta || p.precio) > 0)
    if (conPrecio.length === 0) return toast.error('No hay productos con precio para imprimir')
    if (conPrecio.length < paraImprimir.length) {
      toast(`Se omitieron ${paraImprimir.length - conPrecio.length} productos sin precio`, { icon: '⚠️' })
    }
    const etiquetas = conPrecio.map(p => `
      <div class="etiqueta">
        <div class="nombre">${p.nombre}</div>
        <div class="unidad">${p.unidad}</div>
        <div class="precio">S/ ${Number(p.precio_oferta || p.precio).toFixed(2)}</div>
        ${p.precio_oferta ? `<div class="tachado">Antes: S/ ${Number(p.precio).toFixed(2)}</div>` : ''}
      </div>
    `).join('')
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas de Precios</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; background: white; padding: 5mm; }
            .grid { display: grid; grid-template-columns: repeat(4, 5cm); gap: 2mm; }
            .etiqueta { width: 5cm; height: 4cm; border: 1px solid #333; border-radius: 4px; padding: 6px 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; page-break-inside: avoid; break-inside: avoid; }
            .nombre { font-size: 8pt; font-weight: bold; color: #1A1A1A; line-height: 1.2; margin-bottom: 3px; word-break: break-word; }
            .unidad { font-size: 7pt; color: #555; margin-bottom: 5px; }
            .precio { font-size: 16pt; font-weight: 900; color: #FF6B00; }
            .tachado { font-size: 7pt; color: #999; text-decoration: line-through; margin-top: 2px; }
            @media print { body { padding: 3mm; } @page { size: A4; margin: 3mm; } }
          </style>
        </head>
        <body>
          <div class="grid">${etiquetas}</div>
          <script>window.onload = function() { setTimeout(function() { window.print(); }, 500); }</script>
        </body>
      </html>
    `)
    ventana.document.close()
    toast.success(`${conPrecio.length} etiquetas listas ✅`)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
            Etiquetas de precios<span style={{ color: 'var(--naranja)' }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginTop: 3 }}>
            Selecciona → Imprime en A4 → Recorta y coloca en la repisa ✂️
          </p>
        </div>
        <button onClick={handleImprimir} className="btn-primary" style={{ gap: 8 }}>
          <Printer size={16} /> Imprimir {paraImprimir.filter(p => Number(p.precio_oferta || p.precio) > 0).length} etiquetas
        </button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft: 32 }} />
        </div>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <button onClick={toggleTodos} className="btn-ghost" style={{ fontSize: 13, gap: 6 }}>
          <Filter size={14} />
          {todosMarcados ? 'Deseleccionar todos' : 'Seleccionar todos'}
        </button>
      </div>

      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 14 }}>
        {paraImprimir.length} de {filtrados.length} productos seleccionados
      </p>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
          {filtrados.map(p => {
            const marcado   = seleccionados.has(p.id)
            const sinPrecio = Number(p.precio_oferta || p.precio) === 0
            return (
              <div key={p.id} onClick={() => toggleProducto(p.id)}
                style={{ border: `2px solid ${marcado ? 'var(--naranja)' : 'var(--borde)'}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', background: marcado ? 'var(--naranja-light)' : 'var(--blanco)', transition: 'all 0.15s', position: 'relative', userSelect: 'none', opacity: sinPrecio ? 0.5 : 1 }}>
                <div style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: '50%', background: marcado ? 'var(--naranja)' : 'var(--borde)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {marcado && <span style={{ color: 'white', fontSize: 11, fontWeight: 700 }}>✓</span>}
                </div>
                <div style={{ textAlign: 'center', paddingRight: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--texto)', lineHeight: 1.3, marginBottom: 4 }}>{p.nombre}</p>
                  <p style={{ fontSize: 10, color: 'var(--texto-suave)', marginBottom: 6 }}>{p.unidad}</p>
                  {sinPrecio ? (
                    <p style={{ fontSize: 11, color: '#C62828' }}>Sin precio — no se imprimirá</p>
                  ) : (
                    <p style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 900, color: 'var(--naranja)' }}>
                      S/ {Number(p.precio_oferta || p.precio).toFixed(2)}
                    </p>
                  )}
                </div>
                <p style={{ fontSize: 10, color: 'var(--texto-suave)', textAlign: 'center', marginTop: 5 }}>
                  {p.categorias?.nombre || 'Sin categoría'}
                </p>
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--naranja-light)', borderRadius: 12, border: '1px solid var(--naranja-mid)' }}>
        <p style={{ fontSize: 13, color: 'var(--naranja-dark)', fontWeight: 500, marginBottom: 4 }}>💡 Cómo imprimir</p>
        <p style={{ fontSize: 12, color: 'var(--naranja-dark)', lineHeight: 1.6 }}>
          1. Selecciona los productos · 2. Clic en <strong>"Imprimir etiquetas"</strong> · 3. Elige <strong>A4</strong> y <strong>Márgenes mínimos</strong> · 4. Imprime y recorta ✂️
        </p>
      </div>
    </div>
  )
}
