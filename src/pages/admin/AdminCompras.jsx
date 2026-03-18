import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { exportarCSV } from '../../lib/exportar'
import { Plus, Upload, FileText, ChevronRight, TrendingUp, ShoppingCart, Building2, Download, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

export default function AdminCompras() {
  const [compras, setCompras]     = useState([])
  const [cargando, setCargando]   = useState(true)
  const [subiendo, setSubiendo]   = useState(false)
  const [anio, setAnio]           = useState(new Date().getFullYear())
  const [stats, setStats]         = useState(null)
  const navigate = useNavigate()

  useEffect(() => { cargar() }, [anio])

  async function cargar() {
    setCargando(true)
    const { data } = await supabase
      .from('compras')
      .select('*, compra_items(*)')
      .gte('fecha_compra', `${anio}-01-01`)
      .lte('fecha_compra', `${anio}-12-31`)
      .order('fecha_compra', { ascending: false })
    setCompras(data || [])
    calcularStats(data || [])
    setCargando(false)
  }

  function calcularStats(data) {
    if (data.length === 0) { setStats(null); return }
    const totalGastado = data.reduce((a, c) => a + Number(c.total || 0), 0)
    const porEmpresa = {}
    data.forEach(c => {
      const emp = c.empresa || 'Sin empresa'
      if (!porEmpresa[emp]) porEmpresa[emp] = { nombre: emp, total: 0, compras: 0 }
      porEmpresa[emp].total += Number(c.total || 0)
      porEmpresa[emp].compras++
    })
    const empresasRanking = Object.values(porEmpresa).sort((a, b) => b.total - a.total).slice(0, 5)
    const porProducto = {}
    data.forEach(c => {
      c.compra_items?.forEach(item => {
        const n = item.nombre_producto || 'Sin nombre'
        if (!porProducto[n]) porProducto[n] = { nombre: n, cantidad: 0, gasto: 0 }
        porProducto[n].cantidad += Number(item.cantidad || 0)
        porProducto[n].gasto   += Number(item.subtotal || 0)
      })
    })
    const productosRanking = Object.values(porProducto).sort((a, b) => b.gasto - a.gasto).slice(0, 5)
    setStats({ totalGastado, totalCompras: data.length, empresasRanking, productosRanking })
  }

  async function handleSubirBoleta(e) {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error('Archivo máx. 10MB')
    setSubiendo(true)
    const toastId = toast.loading('Subiendo y escaneando boleta con IA...')
    try {
      // 1 — Subir imagen a Supabase Storage
      const ext  = file.name.split('.').pop()
      const path = `boletas/${Date.now()}_boleta.${ext}`
      const { error: errUp } = await supabase.storage.from('boletas').upload(path, file, { upsert: true })
      if (errUp) throw errUp
      const { data: urlData } = supabase.storage.from('boletas').getPublicUrl(path)
      const imagen_url = urlData.publicUrl

      // 2 — Convertir a base64 para Claude
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res(reader.result.split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const isPDF  = file.type === 'application/pdf'
      const media  = isPDF ? 'application/pdf' : file.type || 'image/jpeg'

      // 3 — Llamar a Claude API
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 2000,
          messages: [{
            role: 'user',
            content: [
              {
                type: isPDF ? 'document' : 'image',
                source: { type: 'base64', media_type: media, data: base64 }
              },
              {
                type: 'text',
                text: `Analiza esta boleta/factura de compra y extrae TODA la información posible. 
Responde SOLO con un JSON válido, sin texto adicional, sin markdown, sin backticks.
El JSON debe tener exactamente esta estructura:
{
  "fecha": "YYYY-MM-DD o null",
  "hora": "HH:MM o null",
  "empresa": "nombre de la empresa o null",
  "ruc": "número RUC o null",
  "numero_boleta": "número de boleta/factura o null",
  "total": número o null,
  "items": [
    {
      "nombre": "nombre del producto",
      "cantidad": número,
      "precio_unitario": número,
      "subtotal": número
    }
  ]
}
Si no puedes leer algún campo, ponlo como null. Los items que no puedas leer bien, ponlos con los campos que sí puedas leer y null en los demás.`
              }
            ]
          }]
        })
      })

      const aiData = await response.json()
      let parsed = null
      try {
        const texto = aiData.content?.[0]?.text || '{}'
        const limpio = texto.replace(/```json|```/g, '').trim()
        parsed = JSON.parse(limpio)
      } catch {
        parsed = {}
      }

      // 4 — Guardar compra en Supabase
      const { data: compra, error: errC } = await supabase.from('compras').insert({
        fecha_compra:   parsed.fecha || null,
        hora_compra:    parsed.hora  || null,
        empresa:        parsed.empresa || null,
        ruc:            parsed.ruc || null,
        numero_boleta:  parsed.numero_boleta || null,
        total:          parsed.total || null,
        imagen_url,
        escaneado:      true,
      }).select().single()
      if (errC) throw errC

      // 5 — Guardar items
      if (parsed.items?.length > 0) {
        const items = parsed.items.map(i => ({
          compra_id:       compra.id,
          nombre_producto: i.nombre || null,
          cantidad:        Number(i.cantidad) || null,
          precio_unitario: Number(i.precio_unitario) || null,
          subtotal:        Number(i.subtotal) || null,
          precio_sugerido: i.precio_unitario
            ? Math.round(Number(i.precio_unitario) * 1.30 * 100) / 100
            : null,
        }))
        await supabase.from('compra_items').insert(items)
      }

      toast.dismiss(toastId)
      toast.success(`¡Boleta escaneada! ${parsed.items?.length || 0} productos encontrados ✅`)
      cargar()
      navigate(`/admin/compras/${compra.id}`)
    } catch (e) {
      toast.dismiss(toastId)
      toast.error('Error: ' + e.message)
    }
    setSubiendo(false)
    e.target.value = ''
  }

  function handleExportar() {
    if (compras.length === 0) return toast.error('No hay compras para exportar')
    exportarCSV('compras', [
      ['Fecha', 'Empresa', 'RUC', 'N° Boleta', 'Total (S/)', 'Productos'],
      ...compras.map(c => [
        c.fecha_compra || '',
        c.empresa || '',
        c.ruc || '',
        c.numero_boleta || '',
        Number(c.total || 0).toFixed(2),
        c.compra_items?.length || 0
      ])
    ])
    toast.success('Excel exportado ✅')
  }

  const anios = [2024, 2025, 2026, 2027]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
            Compras<span style={{ color: 'var(--naranja)' }}>.</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginTop: 3 }}>
            Sube una boleta y la IA extrae toda la información automáticamente
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={handleExportar} className="btn-ghost" style={{ fontSize: 13 }}>
            <Download size={14} /> Excel
          </button>
          <label style={{ cursor: subiendo ? 'not-allowed' : 'pointer' }}>
            <input type="file" accept="image/*,.pdf" onChange={handleSubirBoleta} style={{ display: 'none' }} disabled={subiendo} />
            <span className="btn-primary" style={{ opacity: subiendo ? 0.7 : 1, pointerEvents: subiendo ? 'none' : 'auto' }}>
              <Upload size={16} /> {subiendo ? 'Escaneando...' : 'Subir boleta'}
            </span>
          </label>
        </div>
      </div>

      {/* Filtro por año */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {anios.map(a => (
          <button key={a} onClick={() => setAnio(a)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1.5px solid ${anio === a ? 'var(--naranja)' : 'var(--borde)'}`, background: anio === a ? 'var(--naranja-light)' : 'var(--blanco)', color: anio === a ? 'var(--naranja)' : 'var(--texto-suave)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
            {a}
          </button>
        ))}
      </div>

      {/* Estadísticas */}
      {stats && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
            {[
              { label: 'Total gastado', valor: `S/ ${stats.totalGastado.toFixed(2)}`, icon: TrendingUp, color: 'var(--naranja)' },
              { label: 'Boletas registradas', valor: stats.totalCompras, icon: FileText, color: '#7C3AED' },
            ].map(({ label, valor, icon: Icon, color }) => (
              <div key={label} className="card" style={{ padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{label}</p>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={16} color={color} />
                  </div>
                </div>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 22, color: 'var(--texto)' }}>{valor}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Top empresas */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Building2 size={15} color="var(--naranja)" />
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Top proveedores</h3>
              </div>
              {stats.empresasRanking.map((e, i) => (
                <div key={e.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 14, color: i === 0 ? 'var(--naranja)' : 'var(--texto-suave)', minWidth: 20 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{e.compras} compras</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--naranja)', flexShrink: 0 }}>S/ {e.total.toFixed(2)}</p>
                </div>
              ))}
            </div>

            {/* Top productos comprados */}
            <div className="card" style={{ padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <ShoppingCart size={15} color="#7C3AED" />
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>Productos más comprados</h3>
              </div>
              {stats.productosRanking.map((p, i) => (
                <div key={p.nombre} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 14, color: i === 0 ? '#7C3AED' : 'var(--texto-suave)', minWidth: 20 }}>#{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nombre}</p>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{p.cantidad} unidades</p>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED', flexShrink: 0 }}>S/ {p.gasto.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lista de boletas */}
      <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 700, marginBottom: 14 }}>
        Boletas {anio}<span style={{ color: 'var(--naranja)' }}>.</span>
      </h2>

      {cargando ? <div className="spinner" /> : compras.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
          <FileText size={40} style={{ margin: '0 auto 12px', opacity: 0.2 }} />
          <p>No hay boletas en {anio}</p>
          <p style={{ fontSize: 12, marginTop: 6 }}>Sube una boleta para empezar</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {compras.map(c => (
            <button key={c.id} onClick={() => navigate(`/admin/compras/${c.id}`)}
              style={{ width: '100%', background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 12, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--naranja)'; e.currentTarget.style.background = 'var(--naranja-light)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--borde)'; e.currentTarget.style.background = 'var(--blanco)' }}>
              {c.imagen_url ? (
                <img src={c.imagen_url} alt="boleta" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--borde)' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--fondo)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <FileText size={22} color="var(--texto-suave)" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{c.empresa || 'Empresa no detectada'}</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 3 }}>
                  {c.fecha_compra && <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>📅 {new Date(c.fecha_compra + 'T12:00:00').toLocaleDateString('es-PE')}</span>}
                  {c.ruc && <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>RUC: {c.ruc}</span>}
                  {c.numero_boleta && <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>N°: {c.numero_boleta}</span>}
                  <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{c.compra_items?.length || 0} productos</span>
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: 'var(--fuente-display)', fontWeight: 800, fontSize: 18, color: 'var(--naranja)' }}>
                  S/ {Number(c.total || 0).toFixed(2)}
                </p>
              </div>
              <ChevronRight size={16} color="var(--texto-suave)" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
