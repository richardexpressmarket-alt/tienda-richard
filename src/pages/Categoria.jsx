import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Navbar from '../components/Navbar'
import ProductoCard from '../components/ProductoCard'
import { ChevronLeft, Package } from 'lucide-react'

export default function Categoria() {
  const { id } = useParams()
  const [categoria, setCategoria] = useState(null)
  const [productos, setProductos] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => { cargar() }, [id])

  async function cargar() {
    setCargando(true)
    const [{ data: cat }, { data: prods }] = await Promise.all([
      supabase.from('categorias').select('*').eq('id', id).single(),
      supabase.from('productos').select('*').eq('categoria_id', id).eq('activo', true).order('nombre'),
    ])
    setCategoria(cat)
    setProductos(prods || [])
    setCargando(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--fondo)' }}>
      <Navbar />
      <div className="page-wrap" style={{ padding: '24px 16px' }}>

        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--texto-suave)', marginBottom: 20, padding: '6px 0' }}>
          <ChevronLeft size={16} /> Volver al inicio
        </Link>

        {categoria && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            {categoria.imagen_url ? (
              <img src={categoria.imagen_url} alt={categoria.nombre} style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', border: '1px solid var(--borde)' }} />
            ) : (
              <div style={{ width: 64, height: 64, borderRadius: 14, background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={28} color="var(--naranja)" />
              </div>
            )}
            <div>
              <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800 }}>
                {categoria.nombre}<span style={{ color: 'var(--naranja)' }}>.</span>
              </h1>
              {categoria.descripcion && <p style={{ fontSize: 14, color: 'var(--texto-suave)', marginTop: 3 }}>{categoria.descripcion}</p>}
            </div>
          </div>
        )}

        {cargando ? <div className="spinner" /> : productos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--texto-suave)' }}>
            <Package size={48} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <p>No hay productos en esta categoría aún</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 13, color: 'var(--texto-suave)', marginBottom: 16 }}>{productos.length} productos</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
              {productos.map(p => <ProductoCard key={p.id} producto={p} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
