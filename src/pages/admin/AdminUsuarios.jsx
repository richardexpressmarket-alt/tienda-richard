import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Pencil, X, Search, Phone, Mail, Upload, Shield, Bell, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = ['admin', 'vendedor', 'comprador']

export default function AdminUsuarios() {
  const [usuarios, setUsuarios]       = useState([])
  const [cargando, setCargando]       = useState(true)
  const [busqueda, setBusqueda]       = useState('')
  const [editando, setEditando]       = useState(null)
  const [nuevoRol, setNuevoRol]       = useState('')
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoEmail, setNuevoEmail]   = useState('')
  const [nuevoTelefono, setNuevoTelefono] = useState('')
  const [notasSoporte, setNotasSoporte]   = useState('')
  const [recibirAlertas, setRecibirAlertas] = useState(true)
  const [avatarUrl, setAvatarUrl]     = useState('')
  const [subiendoFoto, setSubiendoFoto] = useState(false)
  const [guardando, setGuardando]     = useState(false)
  const fileRef = useRef()

  useEffect(() => { cargar() }, [])

  async function cargar() {
    const { data } = await supabase
      .from('perfiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsuarios(data || [])
    setCargando(false)
  }

  function abrirEditar(u) {
    setEditando(u)
    setNuevoRol(u.rol || 'comprador')
    setNuevoNombre(u.nombre || '')
    setNuevoEmail(u.email || '')
    setNuevoTelefono(u.telefono || '')
    setNotasSoporte(u.notas_soporte || '')
    setRecibirAlertas(u.recibir_alertas !== false)
    setAvatarUrl(u.avatar_url || '')
  }

  async function handleSubirAvatar(e) {
    const file = e.target.files?.[0]
    if (!file || !editando) return
    setSubiendoFoto(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `perfiles/avatar_${editando.id}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      toast.success('Foto cargada lista para guardar')
    } catch (err) {
      toast.error('Error subiendo foto: ' + err.message)
    }
    setSubiendoFoto(false)
  }

  async function handleGuardar() {
    if (!nuevoRol) return toast.error('Selecciona un rol')
    setGuardando(true)

    const { error } = await supabase
      .from('perfiles')
      .update({
        rol: nuevoRol,
        nombre: nuevoNombre,
        email: nuevoEmail || null,
        telefono: nuevoTelefono || null,
        notas_soporte: notasSoporte || null,
        recibir_alertas: recibirAlertas,
        avatar_url: avatarUrl || null
      })
      .eq('id', editando.id)

    if (error) {
      toast.error('Error al actualizar: ' + error.message)
      setGuardando(false)
      return
    }

    toast.success(`Perfil de "${nuevoNombre || 'Usuario'}" actualizado ✅`)
    setEditando(null)
    setGuardando(false)
    cargar()
  }

  const colorRol = { admin: 'badge-naranja', vendedor: 'badge-verde', comprador: 'badge-gris' }

  const filtrados = usuarios.filter(u => {
    if (!busqueda.trim()) return true
    const t = busqueda.toLowerCase()
    return (u.nombre || '').toLowerCase().includes(t) ||
           (u.email || '').toLowerCase().includes(t) ||
           (u.telefono || '').toLowerCase().includes(t)
  })

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, marginBottom: 20 }}>
        Usuarios y Soporte<span style={{ color: 'var(--naranja)' }}>.</span>
      </h1>

      <div className="card" style={{ padding: '12px 16px', marginBottom: 16, background: 'var(--naranja-light)', border: '1px solid var(--naranja-mid)' }}>
        <p style={{ fontSize: 13, color: 'var(--naranja-dark)' }}>
          💡 Aquí puedes administrar roles, cambiar fotos de perfil, actualizar correos/teléfonos de tus clientes y llevar notas de soporte técnico.
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--texto-suave)' }} />
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar usuario por nombre, correo o teléfono..." style={{ paddingLeft: 36 }} />
      </div>

      {cargando ? <div className="spinner" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtrados.map(u => (
            <div key={u.id} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
              {u.avatar_url ? (
                <img src={u.avatar_url} alt={u.nombre} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 16, color: 'var(--naranja)', flexShrink: 0 }}>
                  {(u.nombre || 'U')[0].toUpperCase()}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{u.nombre || 'Sin nombre'}</p>
                <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>
                  {u.email ? `✉️ ${u.email} · ` : ''}
                  {u.telefono ? `📱 ${u.telefono} · ` : ''}
                  Registrado: {new Date(u.created_at).toLocaleDateString('es-PE')}
                </p>
                {u.notas_soporte && (
                  <p style={{ fontSize: 11, color: '#7c3aed', marginTop: 2, fontWeight: 600 }}>
                    🛠️ Soporte: {u.notas_soporte}
                  </p>
                )}
              </div>
              <span className={`badge ${colorRol[u.rol] || 'badge-gris'}`}>{u.rol}</span>
              <button onClick={() => abrirEditar(u)} className="btn-ghost" style={{ padding: '7px 10px', flexShrink: 0 }}>
                <Pencil size={14} /> Configurar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal editar usuario y soporte */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 18 }}>Configurar Cuenta y Soporte</h2>
              <button onClick={() => setEditando(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--texto-suave)' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Avatar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" style={{ width: 60, height: 60, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--naranja)' }} />
                ) : (
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, color: 'var(--naranja)' }}>
                    {(nuevoNombre || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" onChange={handleSubirAvatar} style={{ display: 'none' }} />
                  <button type="button" onClick={() => fileRef.current.click()} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
                    <Upload size={14} /> {subiendoFoto ? 'Subiendo...' : 'Cambiar foto de perfil'}
                  </button>
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}>Nombre completo</label>
                <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)} placeholder="Nombre del usuario" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}><Mail size={12}/> Correo electrónico</label>
                  <input type="email" value={nuevoEmail} onChange={e => setNuevoEmail(e.target.value)} placeholder="correo@gmail.com" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}><Phone size={12}/> WhatsApp / Teléfono</label>
                  <input type="text" value={nuevoTelefono} onChange={e => setNuevoTelefono(e.target.value)} placeholder="924545856" />
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, display: 'block' }}><FileText size={12}/> Notas de Soporte Técnico / Cuentas asignadas</label>
                <textarea rows={2} value={notasSoporte} onChange={e => setNotasSoporte(e.target.value)} placeholder="Ej: Miembro en equipo Canva #2, reposición aplicada..." style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid var(--borde)', fontSize: 12 }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={recibirAlertas} onChange={e => setRecibirAlertas(e.target.checked)} style={{ width: 16, height: 16 }} />
                Recibir notificaciones de compra y alertas de vencimiento por correo
              </label>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'block' }}>Rol en el sistema</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {ROLES.map(r => (
                    <button key={r} onClick={() => setNuevoRol(r)}
                      style={{
                        padding: '10px 14px', borderRadius: 10, border: `2px solid ${nuevoRol === r ? 'var(--naranja)' : 'var(--borde)'}`,
                        background: nuevoRol === r ? 'var(--naranja-light)' : 'var(--blanco)',
                        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600, color: nuevoRol === r ? 'var(--naranja)' : 'var(--texto)' }}>
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                          {r === 'admin' && 'Acceso total al panel'}
                          {r === 'vendedor' && 'Solo punto de venta'}
                          {r === 'comprador' && 'Cliente de la tienda'}
                        </p>
                      </div>
                      {nuevoRol === r && (
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--naranja)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <span style={{ color: 'white', fontSize: 11 }}>✓</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setEditando(null)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
                  Cancelar
                </button>
                <button onClick={handleGuardar} className="btn-primary" disabled={guardando}
                  style={{ flex: 1, justifyContent: 'center', opacity: guardando ? 0.7 : 1 }}>
                  {guardando ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
