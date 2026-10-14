import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth, useTienda } from '../store'
import Navbar from '../components/Navbar'
import { User, Camera, Clock, CheckCircle, AlertTriangle, RefreshCw, Mail, Phone, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function MiCuenta() {
  const { usuario, perfil, setPerfil } = useAuth()
  const { tiendaActual } = useTienda()
  const esMiller = tiendaActual === 'miller'
  const navigate = useNavigate()
  const fileRef = useRef()

  const [nombre, setNombre]             = useState('')
  const [telefono, setTelefono]         = useState('')
  const [avatarUrl, setAvatarUrl]       = useState('')
  const [recibirAlertas, setRecibirAlertas] = useState(true)
  const [misServicios, setMisServicios] = useState([])
  const [guardando, setGuardando]       = useState(false)
  const [subiendo, setSubiendo]         = useState(false)

  useEffect(() => {
    if (!usuario) { navigate('/login'); return }
    if (perfil) {
      setNombre(perfil.nombre || '')
      setTelefono(perfil.telefono || '')
      setAvatarUrl(perfil.avatar_url || '')
      setRecibirAlertas(perfil.recibir_alertas !== false)
    }
    cargarMisSuscripciones()
  }, [usuario, perfil])

  async function cargarMisSuscripciones() {
    if (!usuario?.email) return
    const { data } = await supabase
      .from('venta_items')
      .select('*, ventas(created_at, total)')
      .ilike('cliente_correo', usuario.email)
      .order('fecha_vencimiento', { ascending: true })
    setMisServicios(data || [])
  }

  async function subirFoto(e) {
    const file = e.target.files?.[0]
    if (!file || !usuario) return
    setSubiendo(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `perfiles/user_${usuario.id}_${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('imagenes').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('imagenes').getPublicUrl(path)
      setAvatarUrl(data.publicUrl)
      toast.success('Foto cargada. Dale a Guardar para confirmar.')
    } catch (err) { toast.error('Error al subir: ' + err.message) }
    setSubiendo(false)
  }

  async function guardarPerfil() {
    if (!usuario) return
    setGuardando(true)
    const payload = {
      nombre,
      telefono,
      email: usuario.email,
      avatar_url: avatarUrl,
      recibir_alertas: recibirAlertas
    }
    const { data, error } = await supabase.from('perfiles').update(payload).eq('id', usuario.id).select().single()
    if (error) { toast.error('Error: ' + error.message); setGuardando(false); return }
    setPerfil(data)
    toast.success('¡Tu cuenta ha sido actualizada! ✅')
    setGuardando(false)
  }

  const diasRestantes = (fecha) => {
    if (!fecha) return 999
    const hoy = new Date(); hoy.setHours(0,0,0,0)
    const venc = new Date(fecha + 'T00:00:00')
    return Math.ceil((venc - hoy) / 86400000)
  }

  return (
    <div style={{ minHeight: '100vh', background: esMiller ? 'radial-gradient(circle at top, #1e1b4b, #0f172a 70%)' : 'var(--fondo)', color: esMiller ? '#f8fafc' : 'var(--texto)' }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '28px 16px' }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginBottom: 20 }}>
          Mi Cuenta y Suscripciones
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Tarjeta de Configuración de Perfil */}
          <div className="card" style={{ padding: 22, background: esMiller ? 'rgba(30,41,59,0.85)' : '#fff', color: esMiller ? '#fff' : 'inherit' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Datos de tu Perfil</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid #06b6d4' }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#7c3aed', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>
                  {(nombre || usuario?.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div>
                <input ref={fileRef} type="file" accept="image/*" onChange={subirFoto} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current.click()} className="btn-ghost" style={{ fontSize: 12, color: esMiller ? '#06b6d4' : 'inherit' }}>
                  <Camera size={14} /> {subiendo ? 'Subiendo...' : 'Cambiar foto'}
                </button>
                <p style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>{usuario?.email}</p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Nombre completo</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>WhatsApp</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 987654321" />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input type="checkbox" checked={recibirAlertas} onChange={e => setRecibirAlertas(e.target.checked)} style={{ width: 16, height: 16 }} />
                Recibir avisos en mi correo cuando mi servicio esté próximo a vencer
              </label>

              <button onClick={guardarPerfil} disabled={guardando} className="btn-primary" style={{ justifyContent: 'center', marginTop: 6, background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)', border: 'none' }}>
                <Save size={15} /> {guardando ? 'Guardando...' : 'Guardar configuración'}
              </button>
            </div>
          </div>

          {/* Tarjeta de Suscripciones y Fechas de Vencimiento */}
          <div className="card" style={{ padding: 22, background: esMiller ? 'rgba(30,41,59,0.85)' : '#fff', color: esMiller ? '#fff' : 'inherit' }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock size={18} color="#06b6d4" /> Mis Servicios y Vencimientos
            </h2>

            {misServicios.length === 0 ? (
              <p style={{ fontSize: 13, opacity: 0.7, textAlign: 'center', padding: '30px 0' }}>
                No tienes servicios digitales vinculados al correo <b>{usuario?.email}</b> todavía.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {misServicios.map(s => {
                  const dias = diasRestantes(s.fecha_vencimiento)
                  const porVencer = dias <= 5
                  return (
                    <div key={s.id} style={{ padding: 12, borderRadius: 10, border: `1px solid ${porVencer ? '#f87171' : 'rgba(148,163,184,0.3)'}`, background: porVencer ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p style={{ fontWeight: 700, fontSize: 14 }}>{s.nombre_producto}</p>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 12, background: porVencer ? '#ef4444' : '#10b981', color: '#fff' }}>
                          {dias < 0 ? 'Vencido' : `${dias} días restantes`}
                        </span>
                      </div>
                      <p style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
                        📅 Adquirido: {s.ventas?.created_at ? new Date(s.ventas.created_at).toLocaleDateString('es-PE') : 'N/A'} · ⏳ <b>Vence: {s.fecha_vencimiento}</b>
                      </p>
                      <a
                        href={`https://wa.me/51924545856?text=${encodeURIComponent(`¡Hola Miller Digital! Quiero renovar mi servicio de *${s.nombre_producto}* asociado a mi correo${usuario.email}`)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, fontWeight: 700, color: '#06b6d4', textDecoration: 'none' }}>
                        <RefreshCw size={12} /> Solicitar Renovación por WhatsApp →
                      </a>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
