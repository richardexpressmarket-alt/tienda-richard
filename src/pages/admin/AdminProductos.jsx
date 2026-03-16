import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Upload, X, Package, Search, Download } from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

const vacioForm = {
  nombre: '', descripcion: '', precio: '', precio_oferta: '',
  unidad: 'unidad', cantidad_unidad: '', stock: 0, stock_minimo: 5,
  categoria_id: '', activo: true, codigo_barras: ''
}

const UNIDADES = ['unidad', 'kg', 'g', 'lt', 'ml', 'docena', 'paquete', 'caja', 'bolsa']

export default function AdminProductos() {
  const [productos, setProductos] = useState([])
  const [categorias, setCategorias] = useState([])
  const [form, setForm] = useState(vacioForm)
  const [editando, setEditando] = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [cargando, setCargando] = useState(true)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [imagenFile, setImagenFile] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCat, setFiltroCat] = useState('')
  const inputRef = useRef()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('productos').select('*, categorias(nombre)').order('nombre'),
      supabase.from('categorias').select('id, nombre').eq('activo', true).order('nombre'),
    ])
    setProductos(prods || [])
    setCategorias(cats || [])
    setCargando(false)
  }

  // Genera la etiqueta de unidad con cantidad: "3 kg", "500 ml", etc.
  function etiquetaUnidad(unidad, cantidad) {
    if (!cantidad) return unidad
    return `${cantidad} ${unidad}`
  }

  function abrirNuevo() {
    setForm(vacioForm)
    setEditando(null)
    setImagenPreview(null)
    setImagenFile(null)
    setModalAbierto(true)
  }

  function abrirEditar(p) {
    // Separar cantidad y unidad si ya tiene formato "3 kg"
    const partes = p.unidad ? p.unidad.split(' ') : []
    const tieneNumero = partes.length === 2 && !isNaN(partes[0])
    setForm({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      precio: p.precio,
      precio_oferta: p.precio_oferta || '',
      unidad: tieneNumero ? partes[1] : p.unidad,
      cantidad_unidad: tieneNumero ? partes[0] : '',
      stock: p.stock,
      stock_minimo: p.stock_minimo,
      categoria_id: p.categoria_id || '',
      activo: p.activo,
      codigo_barras: p.codigo_barras || ''
    })
    setEditando(p)
    setImagenPreview(p.imagen_url || null)
    setImagenFile(null)
    setModalAbierto(true)
  }

  function handleImagen(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error('Imagen máx. 10MB')
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  async function subirImagen(file, nombre) {
    const ext = file.name.split('.').pop()
    const path = `productos/${Date.now()}_${nombre.replace(/\s/g, '_')}.${ext}`
    const { error } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    if (!form.precio || isNaN(form.precio)) return toast.error('El precio debe ser un número')

    // Construir unidad final con cantidad
    const unidadFinal = etiquetaUnidad(form.unidad, form.cantidad_unidad)

    // Verificar duplicado: mismo nombre + misma unidad (ignorando mayúsculas)
    const duplicado = productos.find(p => {
      if (editando && p.id === editando.id) return false
      const mismoNombre = p.nombre.toLowerCase().trim() === form.nombre.toLowerCase().trim()
      const mismaUnidad = p.unidad?.toLowerCase().trim() === unidadFinal.toLowerCase().trim()
      return mismoNombre && mismaUnidad
    })

    if (duplicado) {
      return toast.error(`Ya existe "${form.nombre}" con unidad "${unidadFinal}"`, { duration: 4000 })
    }

    setSubiendo(true)
    try {
      let imagen_url = editando?.imagen_url || null
      if (imagenFile) imagen_url = await subirImagen(imagenFile, form.nombre)

      const payload = {
        nombre: form.nombre.trim(),
        descripcion: form.descripcion,
        precio: Number(form.precio),
        precio_oferta: form.precio_oferta ? Number(form.precio_oferta) : null,
        unidad: unidadFinal,
        stock: Number(form.stock),
        stock_minimo: Number(form.stock_minimo),
        categoria_id: form.categoria_id || null,
        activo: form.activo,
        codigo_barras: form.codigo_barras || null,
        imagen_url,
        updated_at: new Date().toISOString()
      }

      if (editando) {
        const { error } = await supabase.from('productos').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('Producto actualizado')
      } else {
        const { error } = await supabase.from('productos').insert(payload)
        if (error) throw error
        toast.success('Producto creado ✅')
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      toast.error('Error: ' + e.message)
    }
    setSubiendo(false)
  }

  async function handleEliminar(p) {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return
    const { error } = await supabase.from('productos').delete().eq('id', p.id)
    if (error) return toast.error('Error al eliminar')
    toast.success('Producto eliminado')
    cargar()
  }
function handleExportar() {
  if (productos.length === 0) return toast.error('No hay productos para exportar')
  exportarCSV('productos', [
    ['Nombre', 'Categoría', 'Precio (S/)', 'Precio Oferta', 'Unidad', 'Stock', 'Stock Mínimo', 'Código Barras', 'Activo'],
    ...productos.map(p => [
      p.nombre,
      p.categorias?.nombre || 'Sin categoría',
      Number(p.precio).toFixed(2),
      p.precio_oferta ? Number(p.precio_oferta).toFixed(2) : '',
      p.unidad,
      p.stock,
      p.stock_minimo,
      p.codigo_barras || '',
      p.activo ? 'Sí' : 'No'
    ])
  ])
  toast.success('Excel exportado ✅')
}
  const filtrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase())
    const matchCat = filtroCat ? p.categoria_id === filtroCat : true
    return matchBusq && matchCat
  })

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Productos<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
            <Download size={14} /> Excel
          </button>
          <button onClick={abrirNuevo} className="btn-primary"><Plus size={16} /> Nuevo producto</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar producto..." style={{ paddingLeft: 32 }} />
        </div>
        <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)} style={{ minWidth: 160 }}>
          <option value="">Todas las categorías</option>
          {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 14 }}>{filtrados.length} productos</p>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              {p.imagen_url
                ? <img src={p.imagen_url} alt={p.nombre} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                : <div style={{ width: 52, height: 52, borderRadius: 10, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Package size={22} color="var(--borde)" />
                  </div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{p.nombre}</p>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                  {p.categorias?.nombre || 'Sin categoría'} · <span style={{ color: 'var(--naranja)', fontWeight: 500 }}>{p.unidad}</span>
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, color: 'var(--naranja)' }}>S/ {Number(p.precio).toFixed(2)}</p>
                <p style={{ fontSize: 12, color: p.stock <= p.stock_minimo ? '#E65100' : 'var(--texto-suave)' }}>Stock: {p.stock}</p>
              </div>
              <span className={`badge ${p.activo ? 'badge-verde' : 'badge-gris'}`} style={{ flexShrink: 0 }}>{p.activo ? 'Activo' : 'Inactivo'}</span>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={() => abrirEditar(p)} className="btn-ghost" style={{ padding: '7px 10px' }}><Pencil size={14} /></button>
                <button onClick={() => handleEliminar(p)} className="btn-danger" style={{ padding: '7px 10px' }}><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: '24px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Arroz" />
              </div>

              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" />
              </div>

              {/* Unidad + Cantidad juntas */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>
                  Unidad de medida
                  <span style={{ fontSize: 11, color: 'var(--texto-suave)', marginLeft: 8 }}>
                    Vista previa: <strong style={{ color: 'var(--naranja)' }}>{etiquetaUnidad(form.unidad, form.cantidad_unidad)}</strong>
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={form.cantidad_unidad}
                    onChange={e => setForm({ ...form, cantidad_unidad: e.target.value })}
                    placeholder="Ej: 3"
                    style={{ width: 100, flexShrink: 0 }}
                  />
                  <select value={form.unidad} onChange={e => setForm({ ...form, unidad: e.target.value })} style={{ flex: 1 }}>
                    {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginTop: 5 }}>
                  Deja el número vacío si no aplica (ej: solo "unidad" o "paquete")
                </p>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Precio (S/) *</label>
                <input type="number" min="0" step="0.01" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0.00" />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Precio oferta (S/)</label>
                <input type="number" min="0" step="0.01" value={form.precio_oferta} onChange={e => setForm({ ...form, precio_oferta: e.target.value })} placeholder="Dejar vacío si no hay" />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Categoría</label>
                <select value={form.categoria_id} onChange={e => setForm({ ...form, categoria_id: e.target.value })}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Stock actual</label>
                <input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Stock mínimo (alerta)</label>
                <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm({ ...form, stock_minimo: e.target.value })} />
              </div>

              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Código de barras (opcional)</label>
                <input value={form.codigo_barras} onChange={e => setForm({ ...form, codigo_barras: e.target.value })} placeholder="Para uso futuro con lector" />
              </div>

              {/* Imagen */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Foto del producto</label>
                <input ref={inputRef} type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} />
                {imagenPreview ? (
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--borde)', height: 160 }}>
                    <img src={imagenPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => { setImagenPreview(null); setImagenFile(null) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                      <X size={14} />
                    </button>
                    <button onClick={() => inputRef.current.click()}
                      style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'white', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Upload size={12} /> Cambiar foto
                    </button>
                  </div>
                ) : (
                  <button onClick={() => inputRef.current.click()}
                    style={{ width: '100%', height: 120, border: '2px dashed var(--borde)', borderRadius: 10, background: 'var(--fondo)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--texto-suave)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--naranja)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borde)'}>
                    <Upload size={22} />
                    <span style={{ fontSize: 13 }}>Subir foto del producto</span>
                  </button>
                )}
              </div>

              <div style={{ gridColumn: '1/-1', display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="activop" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} style={{ width: 16, height: 16 }} />
                <label htmlFor="activop" style={{ fontSize: 13, cursor: 'pointer' }}>Producto activo (visible en la tienda)</label>
              </div>

              <div style={{ gridColumn: '1/-1', display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalAbierto(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={handleGuardar} className="btn-primary" disabled={subiendo} style={{ flex: 1, justifyContent: 'center', opacity: subiendo ? 0.7 : 1 }}>
                  {subiendo ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
