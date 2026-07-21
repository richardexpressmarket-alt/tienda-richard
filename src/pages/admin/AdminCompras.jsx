import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, 
  BarChart3, Calendar, Package, DollarSign,
  ShoppingCart, RefreshCw, Plus, Edit3
} from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

// --------------------------------------------------------
// COMPONENTE: Buscador con autocompletado
// --------------------------------------------------------
const BuscadorProductos = ({ item, productosDB, onSelect }) => {
  const prodVinculado = productosDB.find(p => p.id === item.producto_db_id)
  const [busqueda, setBusqueda] = useState(prodVinculado ? prodVinculado.nombre : '')
  const [mostrarOpciones, setMostrarOpciones] = useState(false)

  useEffect(() => {
    if (item.producto_db_id) {
       const p = productosDB.find(x => x.id === item.producto_db_id)
       if (p) setBusqueda(p.nombre)
    } else {
       setBusqueda(item.nombreOriginal || '') // En modo manual toma el nombre temporal
    }
  }, [item.producto_db_id, item.nombreOriginal, productosDB])

  const filtrados = productosDB.filter(p => 
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        type="text"
        placeholder="🔍 Buscar producto en almacén..."
        value={busqueda}
        onChange={e => {
          setBusqueda(e.target.value)
          setMostrarOpciones(true)
          onSelect(null, e.target.value) 
        }}
        onFocus={() => setMostrarOpciones(true)}
        onBlur={() => setTimeout(() => setMostrarOpciones(false), 200)}
        style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid var(--borde)', borderRadius: 4 }}
      />
      
      {mostrarOpciones && filtrados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--fondo)', border: '1px solid var(--borde)', maxHeight: 150, overflowY: 'auto', zIndex: 10, borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          {filtrados.map(p => (
            <div
              key={p.id}
              onClick={() => {
                setBusqueda(p.nombre)
                onSelect(p.id, p.nombre)
                setMostrarOpciones(false)
              }}
              style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
              onMouseEnter={(e) => e.target.style.background = '#f59e0b22'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
              <div style={{ fontSize: 10, color: 'var(--texto-suave)' }}>Stock actual: {p.stock} unid.</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminCompras() {
  const [tabActual, setTabActual] = useState('registro')
  const [cargando, setCargando] = useState(false)
  
  // Datos Globales
  const [productosDB, setProductosDB] = useState([])
  const [comprasHistorial, setComprasHistorial] = useState([])
  
  // Estados para Registro (IA y Manual)
  const [modoIngreso, setModoIngreso] = useState(null) // 'ia' o 'manual'
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [procesandoPdf, setProcesandoPdf] = useState(false)
  
  const [datosFactura, setDatosFactura] = useState({
    proveedor: '', 
    ruc: '', 
    numero_comprobante: '', 
    fecha: new Date().toISOString().split('T')[0], 
    subtotal: 0, 
    igv: 0, 
    otros_cargos: 0, 
    total: 0, 
    items: []
  })

  // Filtros de Fecha
  const [desde, setDesde] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  })

  useEffect(() => {
    cargarProductos()
    cargarHistorial()
  }, [desde, hasta])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setProductosDB(data || [])
  }

  async function cargarHistorial() {
    setCargando(true)
    const { data } = await supabase
      .from('compras')
      .select('*, compra_items(*, productos(nombre))')
      .gte('fecha_compra', desde + 'T00:00:00')
      .lte('fecha_compra', hasta + 'T23:59:59')
      .order('fecha_compra', { ascending: false })
    
    setComprasHistorial(data || [])
    setCargando(false)
  }

  // --------------------------------------------------------
  // LÓGICA DE PROCESAMIENTO
  // --------------------------------------------------------
  const convertirPdfABase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = (error) => reject(error)
    })
  }

  const handleSubirPDF = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.type !== 'application/pdf' && !file.type.startsWith('image/')) {
      return toast.error('Se permiten archivos PDF o Imágenes')
    }

    setModoIngreso('ia')
    setPdfFile(file)
    setPdfUrl(URL.createObjectURL(file))
    await procesarDocumentoConGemini(file)
  }

  const iniciarModoManual = () => {
    setPdfFile(null)
    setPdfUrl('')
    setModoIngreso('manual')
    setDatosFactura({
      proveedor: '', ruc: '', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], 
      subtotal: 0, igv: 0, otros_cargos: 0, total: 0, 
      items: [{
        id_temp: Date.now(), nombreOriginal: '', cantidad: 1, precio_total_linea: 0, producto_db_id: null, estado: 'pendiente'
      }]
    })
  }

  const resetearIngreso = () => {
    setModoIngreso(null)
    setPdfFile(null)
    setPdfUrl('')
    setDatosFactura({ proveedor: '', ruc: '', numero_comprobante: '', fecha: '', subtotal: 0, igv: 0, otros_cargos: 0, total: 0, items: [] })
  }

  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No se encontró VITE_GEMINI_API_KEY.')

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      // PROMPT MODIFICADO: Extrae precio_total_linea en vez de unitario
      const prompt = `Analiza detenidamente este comprobante. 
      REGLAS MATEMÁTICAS ESTRICTAS:
      1. Convierte SIEMPRE las docenas a unidades (Ej: "1 1/2 DO" = 18).
      2. Extrae el PRECIO TOTAL PAGADO POR ESA LÍNEA DE PRODUCTOS y guárdalo en "precio_total_linea". (No extraigas el precio unitario, extrae la suma total de esa fila).
      
      Extrae los datos y responde ÚNICAMENTE en formato JSON plano:
      {
        "proveedor": "Nombre comercial",
        "ruc": "RUC",
        "numero_comprobante": "Serie y correlativo",
        "fecha": "YYYY-MM-DD",
        "subtotal": 0.00,
        "igv": 0.00,
        "otros_cargos": 0.00, 
        "total": 0.00,
        "items": [
          {
            "nombreOriginal": "Descripción detallada",
            "cantidad": 1,
            "precio_total_linea": 0.00
          }
        ]
      }`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Pdf } }, { text: prompt }] }] })
        }
      )

      if (!response.ok) throw new Error('Error en el servidor de IA')

      const data = await response.json()
      const jsonLimpio = data.candidates?.[0]?.content?.parts?.[0]?.text.replace(/```json/g, '').replace(/```/g, '').trim()
      const resultado = JSON.parse(jsonLimpio)

      const itemsProcesados = (resultado.items || []).map(item => {
        const coincidencia = productosDB.find(p => 
          p.nombre.toLowerCase().includes(item.nombreOriginal.toLowerCase()) || item.nombreOriginal.toLowerCase().includes(p.nombre.toLowerCase())
        )
        return {
          id_temp: Date.now() + Math.random(),
          nombreOriginal: item.nombreOriginal,
          cantidad: Number(item.cantidad) || 1,
          precio_total_linea: Number(item.precio_total_linea) || 0,
          producto_db_id: coincidencia ? coincidencia.id : null,
          estado: coincidencia ? 'vinculado' : 'pendiente'
        }
      })

      setDatosFactura({
        proveedor: resultado.proveedor || '', ruc: resultado.ruc || '', numero_comprobante: resultado.numero_comprobante || '',
        fecha: resultado.fecha || new Date().toISOString().split('T')[0], subtotal: Number(resultado.subtotal) || 0,
        igv: Number(resultado.igv) || 0, otros_cargos: Number(resultado.otros_cargos) || 0, total: Number(resultado.total) || 0,
        items: itemsProcesados
      })
      toast.success('Documento procesado correctamente')
    } catch (error) {
      toast.error('Error al leer el PDF: ' + error.message)
    } finally {
      setProcesandoPdf(false)
    }
  }

  // --------------------------------------------------------
  // GESTIÓN DE ITEMS
  // --------------------------------------------------------
  const agregarFilaManual = () => {
    setDatosFactura(prev => ({
      ...prev,
      items: [...prev.items, { id_temp: Date.now(), nombreOriginal: '', cantidad: 1, precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }]
    }))
  }

  const quitarFila = (idTemp) => {
    setDatosFactura(prev => ({ ...prev, items: prev.items.filter(i => i.id_temp !== idTemp) }))
  }

  const emparejarProducto = (idTemp, idDB, textoBuscador) => {
    setDatosFactura(prev => ({
      ...prev,
      items: prev.items.map(item => item.id_temp === idTemp 
        ? { ...item, producto_db_id: idDB, nombreOriginal: textoBuscador || item.nombreOriginal, estado: idDB ? 'vinculado' : 'pendiente' } 
        : item
      )
    }))
  }

  const cambiarDatoFactura = (campo, valor) => {
    setDatosFactura(prev => ({ ...prev, [campo]: valor }))
  }

  const cambiarDatoItem = (idTemp, campo, valor) => {
    setDatosFactura(prev => ({
      ...prev,
      items: prev.items.map(i => i.id_temp === idTemp ? { ...i, [campo]: valor } : i)
    }))
  }

  const guardarCompra = async () => {
    if (!datosFactura.proveedor) return toast.error('Falta el nombre del proveedor')
    if (datosFactura.items.length === 0) return toast.error('No hay productos en el registro')
    
    const pendientes = datosFactura.items.filter(i => !i.producto_db_id)
    if (pendientes.length > 0) return toast.error('Hay productos sin vincular al almacén. Asígnales un producto.')

    setCargando(true)
    try {
      const payloadCompra = {
        proveedor: datosFactura.proveedor,
        ruc: datosFactura.ruc || '00000000000',
        total: datosFactura.total,
        fecha_compra: datosFactura.fecha,
        numero_comprobante: datosFactura.numero_comprobante || 'S/N'
      }
      
      const { data: compraData, error: errCompra } = await supabase.from('compras').insert(payloadCompra).select().single()
      if (errCompra) throw errCompra

      for (const item of datosFactura.items) {
        // Calculamos el precio unitario dinámicamente antes de guardar
        const unitarioReal = Number(item.precio_total_linea) / (Number(item.cantidad) || 1)

        await supabase.from('compra_items').insert({
          compra_id: compraData.id,
          producto_id: item.producto_db_id,
          cantidad: item.cantidad,
          precio_unitario: unitarioReal,
          subtotal: item.precio_total_linea
        })

        const prodDB = productosDB.find(p => p.id === item.producto_db_id)
        if (prodDB) {
          await supabase.from('productos')
            .update({ stock: prodDB.stock + Number(item.cantidad) })
            .eq('id', prodDB.id)
        }
      }

      toast.success('Compra registrada y stock actualizado')
      resetearIngreso()
      cargarHistorial()
      cargarProductos()
      setTabActual('historial')
    } catch (error) {
      toast.error('Error al guardar: ' + error.message)
    } finally {
      setCargando(false)
    }
  }

  // --------------------------------------------------------
  // ANÁLISIS DE DATOS
  // --------------------------------------------------------
  let gastoTotal = 0
  let productosComprados = 0
  const productosStats = {}

  comprasHistorial.forEach(compra => {
    gastoTotal += Number(compra.total || 0)
    compra.compra_items?.forEach(item => {
      const cant = Number(item.cantidad || 0)
      productosComprados += cant
      const p = item.productos
      if (p) {
        if (!productosStats[item.producto_id]) productosStats[item.producto_id] = { nombre: p.nombre, cantidad: 0, gasto: 0 }
        productosStats[item.producto_id].cantidad += cant
        productosStats[item.producto_id].gasto += (cant * Number(item.precio_unitario))
      }
    })
  })

  const diasTranscurridos = Math.max(1, Math.ceil((new Date(hasta + 'T23:59:59') - new Date(desde + 'T00:00:00')) / (1000 * 60 * 60 * 24)))
  const topComprados = Object.values(productosStats).sort((a, b) => b.gasto - a.gasto)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Gestión de Compras<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('registro')} className={tabActual === 'registro' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}>
            <UploadCloud size={16} /> Registro
          </button>
          <button onClick={() => setTabActual('historial')} className={tabActual === 'historial' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}>
            <FileText size={16} /> Historial
          </button>
          <button onClick={() => setTabActual('analisis')} className={tabActual === 'analisis' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}>
            <BarChart3 size={16} /> Análisis
          </button>
        </div>
      </div>

      {tabActual === 'registro' && (
        <div style={{ display: 'grid', gridTemplateColumns: modoIngreso === 'ia' ? '1fr 1fr' : '1fr', gap: 20, minHeight: 'calc(100vh - 120px)' }}>
          
          {/* VISTA INICIAL DE SELECCIÓN */}
          {!modoIngreso && (
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>¿Cómo deseas registrar la compra?</h2>
              <div style={{ display: 'flex', gap: 20 }}>
                <div className="card" style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40 }} onClick={() => document.getElementById('file-upload').click()}>
                   <UploadCloud size={48} style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Escanear Comprobante</h3>
                   <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Sube un PDF o foto y la Inteligencia Artificial extraerá los datos.</p>
                   <input id="file-upload" type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleSubirPDF} />
                </div>
                <div className="card" style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40 }} onClick={iniciarModoManual}>
                   <Edit3 size={48} style={{ margin: '0 auto 16px', color: '#10b981' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ingreso Manual</h3>
                   <p style={{ fontSize: 12, color: 'var(--texto-suave)' }}>No tengo comprobante o quiero ingresar los productos manualmente.</p>
                </div>
              </div>
            </div>
          )}

          {/* VISOR DE PDF (Solo en Modo IA) */}
          {modoIngreso === 'ia' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Documento Adjunto</h3>
                <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Cambiar/Quitar</button>
              </div>
              <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="Vista Previa" />
              </div>
            </div>
          )}

          {/* FORMULARIO DE REGISTRO (Común para IA y Manual) */}
          {modoIngreso && (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: modoIngreso === 'manual' ? '0 auto' : 0, maxWidth: modoIngreso === 'manual' ? 700 : '100%', width: '100%' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {modoIngreso === 'ia' ? 'Datos Extraídos (Gemini AI)' : 'Formulario de Ingreso Manual'}
                  {procesandoPdf && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                </h3>
                {modoIngreso === 'manual' && (
                  <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Cancelar</button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {procesandoPdf ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
                    <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                    <p>Analizando comprobante y calculando valores...</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)' }}>RUC Emisor</label>
                        <input type="text" value={datosFactura.ruc} onChange={e => cambiarDatoFactura('ruc', e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)' }}>Fecha Emisión</label>
                        <input type="date" value={datosFactura.fecha} onChange={e => cambiarDatoFactura('fecha', e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)' }}>Proveedor</label>
                        <input type="text" value={datosFactura.proveedor} onChange={e => cambiarDatoFactura('proveedor', e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)' }}>N° Boleta/Factura</label>
                        <input type="text" value={datosFactura.numero_comprobante} onChange={e => cambiarDatoFactura('numero_comprobante', e.target.value)} placeholder="Ej: B001-000234 (Dejar vacío si no aplica)" style={{ width: '100%', fontSize: 13 }} />
                      </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed var(--borde)' }} />

                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <h4 style={{ fontSize: 13, fontWeight: 700 }}>Relación con Almacén</h4>
                        {modoIngreso === 'manual' && (
                          <button onClick={agregarFilaManual} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#10b981' }}>
                            <Plus size={14} /> Agregar Fila
                          </button>
                        )}
                      </div>
                      
                      {datosFactura.items.map((item) => {
                        // CÁLCULO MATEMÁTICO EN VIVO (Read-Only)
                        const unitarioDerivado = (Number(item.precio_total_linea) / (Number(item.cantidad) || 1)).toFixed(4)

                        return (
                        <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: item.estado === 'vinculado' ? '#10b98108' : '#f59e0b08', position: 'relative' }}>
                          {modoIngreso === 'manual' && datosFactura.items.length > 1 && (
                            <button onClick={() => quitarFila(item.id_temp)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#D00', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>X</button>
                          )}
                          
                          {modoIngreso === 'ia' && (
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginBottom: 4 }}>Descripción PDF: <b>{item.nombreOriginal}</b></p>
                          )}
                          
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, marginTop: modoIngreso === 'manual' ? 12 : 0 }}>
                            <BuscadorProductos item={item} productosDB={productosDB} onSelect={(id, texto) => emparejarProducto(item.id_temp, id, texto)} />
                            
                            {item.estado === 'vinculado' ? (
                              <CheckCircle size={20} color="#10b981" style={{ minWidth: 20 }} />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
                                <AlertCircle size={18} /> PENDIENTE
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10 }}>Cantidad (Unidades)</label>
                              <input type="number" value={item.cantidad} onChange={e => cambiarDatoItem(item.id_temp, 'cantidad', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '4px 8px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10, fontWeight: 700, color: '#D00' }}>Total Pagado (S/)</label>
                              <input type="number" step="any" value={item.precio_total_linea} onChange={e => cambiarDatoItem(item.id_temp, 'precio_total_linea', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '4px 8px', border: '1px solid #D00' }} />
                            </div>
                          </div>
                          
                          <div style={{ marginTop: 8, textAlign: 'right' }}>
                            <span style={{ fontSize: 11, background: 'var(--fondo)', padding: '2px 8px', borderRadius: 4, color: 'var(--texto-suave)', border: '1px solid var(--borde)' }}>
                              Precio Unitario Calculado: <b style={{ color: 'var(--texto)' }}>S/ {unitarioDerivado}</b>
                            </span>
                          </div>
                        </div>
                      )})}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed var(--borde)' }} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--fondo)', padding: 12, borderRadius: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Subtotal (Op. Gravadas):</span>
                        <input type="number" step="any" value={datosFactura.subtotal} onChange={e => cambiarDatoFactura('subtotal', e.target.value)} style={{ width: 80, fontSize: 12, textAlign: 'right', padding: '2px 4px' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>I.G.V. (18%):</span>
                        <input type="number" step="any" value={datosFactura.igv} onChange={e => cambiarDatoFactura('igv', e.target.value)} style={{ width: 80, fontSize: 12, textAlign: 'right', padding: '2px 4px' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>Otros Cargos (Transporte, etc.):</span>
                        <input type="number" step="any" value={datosFactura.otros_cargos} onChange={e => cambiarDatoFactura('otros_cargos', e.target.value)} style={{ width: 80, fontSize: 12, textAlign: 'right', padding: '2px 4px' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4, borderTop: '1px solid var(--borde)', paddingTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Total Final:</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-suave)' }}>S/</span>
                          <input type="number" step="any" value={datosFactura.total} onChange={e => cambiarDatoFactura('total', e.target.value)} style={{ width: 100, fontSize: 16, fontWeight: 800, color: 'var(--naranja)', textAlign: 'right', padding: '4px 8px' }} />
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </div>

              <div style={{ padding: '16px', borderTop: '1px solid var(--borde)', background: 'var(--fondo)' }}>
                <button 
                  onClick={guardarCompra} 
                  disabled={procesandoPdf || datosFactura.items.length === 0} 
                  className="btn-primary" 
                  style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                >
                  Registrar Compra y Aumentar Stock
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TABS DE HISTORIAL Y ANÁLISIS PERMANECEN IGUAL... */}
      {/* (Todo el código inferior del Historial y Análisis es exactamente el mismo que ya tenías) */}
      
      {tabActual === 'historial' && (
        <div>
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Calendar size={16} color="var(--texto-suave)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Desde</label>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <label style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Hasta</label>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cargando ? <div className="spinner" style={{ margin: '40px auto' }} /> : comprasHistorial.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>No hay compras registradas en este rango.</div>
            ) : (
              comprasHistorial.map(compra => (
                <div key={compra.id} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700 }}>{compra.proveedor}</h3>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>RUC: {compra.ruc} | Fecha: {compra.fecha_compra}</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>
                      <Package size={12} style={{ display: 'inline', marginRight: 4 }} />
                      {compra.compra_items?.length} productos reabastecidos
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#D00' }}>- S/ {Number(compra.total).toFixed(2)}</p>
                    <span style={{ fontSize: 10, background: '#10b98122', color: '#10b981', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>Procesado</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {tabActual === 'analisis' && (
        <div className="analisis-container">
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <Calendar size={16} color="var(--texto-suave)" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
                <span>-</span>
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px' }} />
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #D00' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Total Invertido</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4, color: '#D00' }}>
                S/ {gastoTotal.toFixed(2)}
              </h3>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Unidades Compradas</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4 }}>
                {productosComprados}
              </h3>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Gasto Diario Promedio</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 800, marginTop: 4, color: 'var(--naranja)' }}>
                S/ {promedioGastoDiario.toFixed(2)}
              </h3>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} color="var(--naranja)" />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top Productos y Proyección de Venta</h3>
            </div>
            <div style={{ padding: '12px 0' }}>
              {topComprados.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--texto-suave)', padding: 20 }}>Sin compras en este periodo</p>
              ) : (
                topComprados.slice(0, 10).map((p, idx) => {
                  const costoPromedio = p.gasto / p.cantidad;
                  const precioSugeridoVenta = costoPromedio * 1.30; 
                  
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--borde)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--texto-suave)', width: 20 }}>{idx + 1}</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Unidades: {p.cantidad}</p>
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Costo Promedio: S/ {costoPromedio.toFixed(4)}</p>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', marginBottom: 2 }}>Precio Venta Sugerido (+30%)</p>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#10b981' }}>S/ {precioSugeridoVenta.toFixed(2)}</p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
