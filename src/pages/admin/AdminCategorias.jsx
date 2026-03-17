import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Plus, Pencil, Trash2, Upload, X, Package, Download } from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

const vacioForm = { nombre: '', descripcion: '', orden: 0, activo: true }

export default function AdminCategorias() {
  const [categorias, setCategorias] = useState([])
  const [form, setForm]             = useState(vacioForm)
  const [editando, setEditando]     = useState(null)
  const [modalAbierto, setModalAbierto] = useState(false)
  const [subiendo, setSubiendo]     = useState(false)
  const [cargando, setCargando]     = useState(true)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [imagenFile, setImagenFile] = useState(null)
  const inputRef = useRef()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('categorias').select('*').order('orden')
    setCategorias(data || [])
    setCargando(false)
  }

  function abrirNuevo() {
    setForm(vacioForm); setEditando(null)
    setImagenPreview(null); setImagenFile(null)
    setModalAbierto(true)
  }

  function abrirEditar(cat) {
    setForm({ nombre: cat.nombre, descripcion: cat.descripcion || '', orden: cat.orden || 0, activo: cat.activo })
    setEditando(cat)
    setImagenPreview(cat.imagen_url || null)
    setImagenFile(null)
    setModalAbierto(true)
  }

  function handleImagen(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error('La imagen no debe superar 10MB')
    setImagenFile(file)
    setImagenPreview(URL.createObjectURL(file))
  }

  async function subirImagen(file, nombre) {
    const ext = file.name.split('.').pop()
    const nombreLimpio = nombre
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 40)
    const path = `categorias/${Date.now()}_${nombreLimpio}.${ext}`
    const { error } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleGuardar() {
    if (!form.nombre.trim()) return toast.error('El nombre es obligatorio')
    setSubiendo(true)
    try {
      let imagen_url = editando?.imagen_url || null
      if (imagenFile) imagen_url = await subirImagen(imagenFile, form.nombre)
      const payload = { ...form, imagen_url }
      if (editando) {
        const { error } = await supabase.from('categorias').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('Categoría actualizada')
      } else {
        const { error } = await supabase.from('categorias').insert(payload)
        if (error) throw error
        toast.success('Categoría creada')
      }
      setModalAbierto(false)
      cargar()
    } catch (e) {
      toast.error('Error al guardar: ' + e.message)
    }
    setSubiendo(false)
  }

  async function handleEliminar(cat) {
    if (!confirm(`¿Eliminar la categoría "${cat.nombre}"?`)) return
    const { error } = await supabase.from('categorias').delete().eq('id', cat.id)
    if (error) return toast.error('Error al eliminar')
    toast.success('Categoría eliminada')
    cargar()
  }

  function handleExportar() {
    if (categorias.length === 0) return toast.error('No hay categorías para exportar')
    exportarCSV('categorias', [
      ['Nombre', 'Descripción', 'Orden', 'Activa'],
      ...categorias.map(c => [
        c.nombre, c.descripcion || '', c.orden, c.activo ? 'Sí' : 'No'
      ])
    ])
    toast.success('Excel exportado ✅')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Categorías<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
            <Download size={14} /> Excel
          </button>
          <button onClick={abrirNuevo} className="btn-primary">
            <Plus size={16} /> Nueva categoría
          </button>
        </div>
      </div>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {categorias.map(cat => (
            <div key={cat.id} className="card" style={{ overflow: 'hidden' }}>
              <div style={{ aspectRatio: '16/9', background: 'var(--fondo)', overflow: 'hidden' }}>
                {cat.imagen_url
                  ? <img src={cat.imagen_url} alt={cat.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package size={32} color="var(--borde)" />
                    </div>
                }
              </div>
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <p style={{ fontWeight: 600, fontSize: 15 }}>{cat.nombre}</p>
                  <span className={`badge ${cat.activo ? 'badge-verde' : 'badge-gris'}`}>{cat.activo ? 'Activa' : 'Inactiva'}</span>
                </div>
                {cat.descripcion && <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 10 }}>{cat.descripcion}</p>}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button onClick={() => abrirEditar(cat)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center', padding: '7px' }}>
                    <Pencil size={14} /> Editar
                  </button>
                  <button onClick={() => handleEliminar(cat)} className="btn-danger" style={{ justifyContent: 'center', padding: '7px 10px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalAbierto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>
                {editando ? 'Editar categoría' : 'Nueva categoría'}
              </h2>
              <button onClick={() => setModalAbierto(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre *</label>
                <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Abarrotes" />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Descripción</label>
                <input value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Ej: Arroz, azúcar, aceite..." />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Orden</label>
                <input type="number" value={form.orden} onChange={e => setForm({ ...form, orden: Number(e.target.value) })} min={0} />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block' }}>Imagen de la categoría</label>
                <input ref={inputRef} type="file" accept="image/*" onChange={handleImagen} style={{ display: 'none' }} />
                {imagenPreview ? (
                  <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--borde)', aspectRatio: '16/9' }}>
                    <img src={imagenPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => { setImagenPreview(null); setImagenFile(null) }}
                      style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }}>
                      <X size={14} />
                    </button>
                    <button onClick={() => inputRef.current.click()}
                      style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: 'white', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Upload size={12} /> Cambiar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => inputRef.current.click()}
                    style={{ width: '100%', aspectRatio: '16/9', border: '2px dashed var(--borde)', borderRadius: 10, background: 'var(--fondo)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--texto-suave)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--naranja)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--borde)'}>
                    <Upload size={24} />
                    <span style={{ fontSize: 13 }}>Subir imagen</span>
                    <span style={{ fontSize: 11 }}>JPG, PNG — máx. 10MB</span>
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <input type="checkbox" id="activo" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} style={{ width: 16, height: 16 }} />
                <label htmlFor="activo" style={{ fontSize: 13, cursor: 'pointer' }}>Categoría activa (visible en la tienda)</label>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setModalAbierto(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={handleGuardar} className="btn-primary" disabled={subiendo} style={{ flex: 1, justifyContent: 'center', opacity: subiendo ? 0.7 : 1 }}>
                  {subiendo ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear categoría'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
