import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useTienda } from '../store'
import { Store, Cpu, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const { tiendaActual } = useTienda()
  const esMiller = tiendaActual === 'miller'

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [nombre, setNombre]     = useState('')
  const [telefono, setTelefono] = useState('')
  const [verPass, setVerPass]   = useState(false)
  const [modo, setModo]         = useState('login')
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return toast.error('Completa todos los campos')
    setCargando(true)

    if (modo === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setCargando(false); return toast.error('Correo o contraseña incorrectos') }
      toast.success('¡Bienvenido!')
      const { data: { user } } = await supabase.auth.getUser()

      // Aseguramos que el correo quede sincronizado en su perfil para sus suscripciones
      await supabase.from('perfiles').update({ email: user.email }).eq('id', user.id)

      const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single()
      if (perfil?.rol === 'admin') navigate('/admin')
      else if (perfil?.rol === 'vendedor') navigate('/vendedor')
      else navigate('/')
    } else {
      if (!nombre.trim()) { setCargando(false); return toast.error('Escribe tu nombre') }
      const { data: signUpData, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { nombre, telefono } }
      })
      if (error) { setCargando(false); return toast.error(error.message) }

      if (signUpData?.user) {
        await supabase.from('perfiles').upsert({
          id: signUpData.user.id,
          nombre: nombre.trim(),
          email: email.trim(),
          telefono: telefono.trim() || null,
          rol: 'comprador',
          recibir_alertas: true
        })
      }

      toast.success('¡Cuenta creada con éxito! Ya puedes ingresar 🎉')
      setModo('login')
    }
    setCargando(false)
  }

  const colorPrimario = esMiller ? '#06b6d4' : 'var(--naranja)'

  return (
    <div style={{
      minHeight: '100vh',
      background: esMiller ? 'radial-gradient(circle at top, #1e1b4b, #090d16 70%)' : 'var(--fondo)',
      color: esMiller ? '#f8fafc' : 'var(--texto)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div style={{ width: '100%', maxWidth: 410 }}>

        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 56, height: 56,
            background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px'
          }}>
            {esMiller ? <Cpu size={28} color="white" /> : <Store size={28} color="white" />}
          </div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800 }}>
            {esMiller ? 'Miller Digital' : 'Richard Express'}
            <span style={{ color: colorPrimario }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: esMiller ? '#94a3b8' : 'var(--texto-suave)', marginTop: 6 }}>
            {modo === 'login' ? 'Ingresa a tu cuenta para gestionar tus pedidos y suscripciones' : 'Crea tu cuenta gratis en segundos'}
          </p>
        </div>

        <div className="card" style={{
          padding: '28px 24px',
          background: esMiller ? 'rgba(30, 41, 59, 0.9)' : 'var(--blanco)',
          border: esMiller ? '1px solid rgba(124, 58, 237, 0.4)' : '1px solid var(--borde)',
          color: esMiller ? '#fff' : 'inherit'
        }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>

            {modo === 'registro' && (
              <>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Nombre completo *</label>
                  <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre y apellido" />
                </div>
                <div>
                  <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>WhatsApp (para avisos de renovación)</label>
                  <input type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej: 987654321" />
                </div>
              </>
            )}

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Correo electrónico *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Contraseña *</label>
              <div style={{ position: 'relative' }}>
                <input type={verPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setVerPass(!verPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--texto-suave)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={cargando}
              style={{
                width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4, borderRadius: 10,
                opacity: cargando ? 0.7 : 1,
                background: esMiller ? 'linear-gradient(135deg, #7c3aed, #06b6d4)' : 'var(--naranja)',
                border: 'none'
              }}>
              {cargando ? 'Procesando...' : modo === 'login' ? 'Ingresar' : 'Crear mi cuenta'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
            style={{ background: 'none', border: 'none', fontSize: 13, color: colorPrimario, fontWeight: 600, cursor: 'pointer' }}>
            {modo === 'login' ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
          <Link to="/" style={{ fontSize: 13, color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>← Volver a la tienda</Link>
        </div>

      </div>
    </div>
  )
}
