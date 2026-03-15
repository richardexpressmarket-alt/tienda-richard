import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Store, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verPass, setVerPass] = useState(false)
  const [cargando, setCargando] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return toast.error('Completa todos los campos')
    setCargando(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(false)
    if (error) return toast.error('Correo o contraseña incorrectos')
    toast.success('¡Bienvenido!')
    const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', (await supabase.auth.getUser()).data.user.id).single()
    if (perfil?.rol === 'admin') navigate('/admin')
    else if (perfil?.rol === 'vendedor') navigate('/vendedor')
    else navigate('/')
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>

        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 56, height: 56, background: 'var(--naranja)', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
            <Store size={28} color="white" />
          </div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800 }}>Richard Express<span style={{ color: 'var(--naranja)' }}>.</span></h1>
          <p style={{ fontSize: 14, color: 'var(--texto-suave)', marginTop: 6 }}>Ingresa con tu cuenta de trabajo</p>
        </div>

        <div className="card" style={{ padding: '28px 24px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Correo electrónico</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <input type={verPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setVerPass(!verPass)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--texto-suave)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {verPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={cargando}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15, marginTop: 4, borderRadius: 10, opacity: cargando ? 0.7 : 1 }}>
              {cargando ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link to="/" style={{ fontSize: 13, color: 'var(--texto-suave)' }}>← Volver a la tienda</Link>
<button onClick={() => setModo(modo === 'login' ? 'registro' : 'login')} 
  style={{ fontSize: 13, color: 'var(--naranja)', background: 'none', border: 'none', cursor: 'pointer', marginTop: 8 }}>
  {modo === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
</button>
        </div>
      </div>
    </div>
  )
}
