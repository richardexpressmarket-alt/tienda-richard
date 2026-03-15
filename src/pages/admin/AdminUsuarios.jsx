import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Users, Pencil, X } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['admin', 'vendedor', 'comprador']

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [editando, setEditando] = useState(null)
  const [nuevoRol, setNuevoRol] = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase.from('perfiles').select('*').order('created_at', { ascending: false })
    setUsuarios(data || [])
    setCargando(false)
  }

  function abrirEditar(u) {
    setEditando(u)
    setNuevoRol(u.rol)
    setNuevoNombre(u.nombre || '')
  }

  async function handleGuardar() {
    const { error } = await supabase.from('perfiles').update({ rol: nuevoRol, nombre: nuevoNombre }).eq('id', editando.id)
    if (error) return toast.error('Error al actualizar')
    toast.success('Usuario actualizado')
    setEditando(null)
    cargar()
  }

  const colorRol = { admin: 'badge-naranja', vendedor: 'badge-verde', comprador: 'badge-gris' }

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        Usuarios<span style={{ color: 'var(--naranja)' }}>.</span>
      </h1>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)' }}>
        <p style={{ fontSize: 13, color: 'var(--naranja-dark)' }}>
          💡 Para agregar nuevos usuarios, deben registrarse desde el login. Aquí puedes cambiar sus roles.
        </p>
      </div>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {usuarios.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, color: 'var(--naranja)', flexShrink: 0 }}>
                {(u.nombre || 'U')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{u.nombre || 'Sin nombre'}</p>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Registrado: {new Date(u.created_at).toLocaleDateString('es-PE')}</p>
              </div>
              <span className={`badge ${colorRol[u.rol] || 'badge-gris'}`}>{u.rol}</span>
              <button onClick={() => abrirEditar(u)} className="btn-ghost" style={{ padding: '7px 10px', flexShrink: 0 }}>
                <Pencil size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 400, padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>Editar usuario</h2>
              <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre</label>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Rol</label>
                <select value={nuevoRol} onChange={e => setNuevoRol(e.target.value)}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditando(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
                <button onClick={handleGuardar} className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Guardar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
