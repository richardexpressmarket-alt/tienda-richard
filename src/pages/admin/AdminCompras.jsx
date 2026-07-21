import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, 
  BarChart3, Calendar, Package, DollarSign,
  ShoppingCart, RefreshCw, FileSpreadsheet, Printer
} from 'lucide-react'
import { exportarCSV } from '../../lib/exportar'
import toast from 'react-hot-toast'

export default function AdminCompras() {
  const [tabActual, setTabActual] = useState('registro')
  const [cargando, setCargando] = useState(false)
  
  // Datos Globales
  const [productosDB, setProductosDB] = useState([])
  const [comprasHistorial, setComprasHistorial] = useState([])
  
  // Estados para Registro de PDF
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfUrl, setPdfUrl] = useState('')
  const [procesandoPdf, setProcesandoPdf] = useState(false)
  
  // Datos Extraídos por Gemini IA
  const [datosFactura, setDatosFactura] = useState({
    proveedor: '', ruc: '', fecha: new Date().toISOString().split('T')[0], total: 0, items: []
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
  // INTEGRACIÓN REAL CON API GEMINI (PROCESAMIENTO DE PDF)
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
    if (file.type !== 'application/pdf') return toast.error('Solo se permiten archivos PDF')

    setPdfFile(file)
    setPdfUrl(URL.createObjectURL(file))
    await procesarDocumentoConGemini(file)
  }

  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      
      // Validación estricta de la API Key
      if (!apiKey) {
        throw new Error('No se encontró VITE_GEMINI_API_KEY en las variables de entorno de Vercel.')
      }
      if (!apiKey.startsWith('AIza')) {
        throw new Error('CLAVE INVÁLIDA: Las claves de Google siempre deben empezar con "AIza". Revisa lo que pegaste en Vercel.')
      }

      const base64Pdf = await convertirPdfABase64(file)

      const prompt = `Analiza detenidamente este comprobante de compra (boleta o factura). Extrae los datos principales y responde ÚNICAMENTE en formato JSON plano (sin sintaxis adicional ni explicaciones fuera del JSON) con la siguiente estructura exacta:
      {
        "proveedor": "Nombre comercial o Razón Social de la empresa emisora",
        "ruc": "Número de RUC del emisor",
        "fecha": "YYYY-MM-DD",
        "total": 0.00,
        "items": [
          {
            "nombreOriginal": "Descripción detallada del artículo",
            "cantidad": 1,
            "precio_unitario": 0.00
          }
        ]
      }`

      // Usando el endpoint oficial v1 (más estable) con el modelo flash
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
                  { text: prompt }
                ]
              }
            ]
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        const errorMsg = errorData.error?.message || 'Error desconocido de Google'
        
        // Autodiagnóstico en caso de fallo de modelo
        if (errorMsg.includes('not found') || errorMsg.includes('not supported')) {
          try {
            const diagRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
            if (diagRes.ok) {
              const listData = await diagRes.json()
              const modelos = listData.models.map(m => m.name.replace('models/', '')).filter(m => m.includes('1.5')).join(', ')
              throw new Error(`Modelo no soportado por tu cuenta. Modelos disponibles para ti: ${modelos}`)
            }
          } catch (diagErr) {
            // Falla silenciosa del diagnóstico
          }
        }
        throw new Error(errorMsg)
      }

      const data = await response.json()
      const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!textoRespuesta) throw new Error('No se pudo extraer texto del PDF.')

      const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/```/g, '').trim()
      const resultado = JSON.parse(jsonLimpio)

      const itemsProcesados = (resultado.items || []).map(item => {
        const coincidencia = productosDB.find(p => 
          p.nombre.toLowerCase().includes(item.nombreOriginal.toLowerCase()) ||
          item.nombreOriginal.toLowerCase().includes(p.nombre.toLowerCase())
        )

        return {
          id_temp: Date.now() + Math.random(),
          nombreOriginal: item.nombreOriginal,
          cantidad: Number(item.cantidad) || 1,
          precio_unitario: Number(item.precio_unitario) || 0,
          producto_db_id: coincidencia ? coincidencia.id : null,
          estado: coincidencia ? 'vinculado' : 'pendiente'
        }
      })

      setDatosFactura({
        proveedor: resultado.proveedor || '',
        ruc: resultado.ruc || '',
        fecha: resultado.fecha || new Date().toISOString().split('T')[0],
        total: Number(resultado.total) || 0,
        items: itemsProcesados
      })

      toast.success('Documento procesado correctamente por IA')
    } catch (error) {
      toast.error('Error al leer el PDF: ' + error.message)
    } finally {
      setProcesandoPdf(false)
    }
  }

  const emparejarProducto = (idTemp, idDB) => {
    setDatosFactura(prev => ({
      ...prev,
      items: prev.items.map(item => item.id_temp === idTemp 
        ? { ...item, producto_db_id: idDB, estado: idDB ? 'vinculado' : 'pendiente' } 
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
    if (!datosFactura.proveedor || !datosFactura.ruc) return toast.error('Faltan datos del proveedor')
    if (datosFactura.items.length === 0) return toast.error('No hay productos en la factura')
    
    const pendientes = datosFactura.items.filter(i => !i.producto_db_id)
    if (pendientes.length > 0) {
      return toast.error('Hay productos sin vincular al almacén. Asígnales un producto.')
    }

    setCargando(true)
    try {
      const { data: compraData, error: errCompra } = await supabase
        .from('compras')
        .insert({
          proveedor: datosFactura.proveedor,
          ruc: datosFactura.ruc,
          total: datosFactura.total,
          fecha_compra: datosFactura.fecha,
          estado: 'completada'
        })
        .select()
        .single()
      
      if (errCompra) throw errCompra

      for (const item of datosFactura.items) {
        await supabase.from('compra_items').insert({
          compra_id: compraData.id,
          producto_id: item.producto_db_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          subtotal: item.cantidad * item.precio_unitario
        })

        const prodDB = productosDB.find(p => p.id === item.producto_db_id)
        if (prodDB) {
          await supabase.from('productos')
            .update({ stock: prodDB.stock + Number(item.cantidad) })
            .eq('id', prodDB.id)
        }
      }

      toast.success('Compra registrada y stock actualizado')
      setPdfFile(null)
      setPdfUrl('')
      setDatosFactura({ proveedor: '', ruc: '', fecha: '', total: 0, items: [] })
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
        if (!productosStats[item.producto_id]) {
          productosStats[item.producto_id] = { nombre: p.nombre, cantidad: 0, gasto: 0 }
        }
        productosStats[item.producto_id].cantidad += cant
        productosStats[item.producto_id].gasto += (cant * Number(item.precio_unitario))
      }
    })
  })

  const fInicio = new Date(desde + 'T00:00:00')
  const fFin = new Date(hasta + 'T23:59:59')
  const diasTranscurridos = Math.max(1, Math.ceil((fFin - fInicio) / (1000 * 60 * 60 * 24)))
  const promedioGastoDiario = gastoTotal / diasTranscurridos
  const topComprados = Object.values(productosStats).sort((a, b) => b.gasto - a.gasto)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>
          Gestión de Compras<span style={{ color: 'var(--naranja)' }}>.</span>
        </h1>
        
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('registro')} className={tabActual === 'registro' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}>
            <UploadCloud size={16} /> Procesar Factura
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
        <div style={{ display: 'grid', gridTemplateColumns: pdfUrl ? '1fr 1fr' : '1fr', gap: 20, height: 'calc(100vh - 120px)' }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Comprobante en PDF</h3>
              {!pdfUrl && (
                <label className="btn-primary" style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 12 }}>
                  <UploadCloud size={14} /> Subir PDF
                  <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleSubirPDF} />
                </label>
              )}
              {pdfUrl && (
                <button onClick={() => { setPdfFile(null); setPdfUrl(''); setDatosFactura({ items: [] }) }} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>
                  Quitar Documento
                </button>
              )}
            </div>

            <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {pdfUrl ? (
                <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="PDF Vista Previa" />
              ) : (
                <div style={{ textAlign: 'center', color: '#fff' }}>
                  <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                  <p>Sube una factura o boleta PDF para extraer sus datos automáticamente</p>
                  <label className="btn-primary" style={{ cursor: 'pointer', padding: '8px 16px', marginTop: 16, display: 'inline-flex' }}>
                    Seleccionar Archivo PDF
                    <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleSubirPDF} />
                  </label>
                </div>
              )}
            </div>
          </div>

          {pdfUrl && (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Lector Inteligente (Gemini AI)
                  {procesandoPdf && <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />}
                </h3>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {procesandoPdf ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>
                    <RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                    <p>Leyendo contenido de la boleta o factura...</p>
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
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed var(--borde)' }} />

                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Relación con Almacén</h4>
                      {datosFactura.items.map((item) => (
                        <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: item.estado === 'vinculado' ? '#10b98108' : '#f59e0b08' }}>
                          <p style={{ fontSize: 11, color: 'var(--texto-suave)', marginBottom: 4 }}>Descripción PDF: <b>{item.nombreOriginal}</b></p>
                          
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                            <select 
                              value={item.producto_db_id || ''} 
                              onChange={(e) => emparejarProducto(item.id_temp, e.target.value)}
                              style={{ flex: 1, fontSize: 13, padding: '6px 8px', border: '1px solid var(--borde)', borderRadius: 4 }}
                            >
                              <option value="">-- Seleccionar producto de tu Almacén --</option>
                              {productosDB.map(p => (
                                <option key={p.id} value={p.id}>{p.nombre} (Stock actual: {p.stock})</option>
                              ))}
                            </select>
                            
                            {item.estado === 'vinculado' ? (
                              <CheckCircle size={20} color="#10b981" />
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#f59e0b', fontSize: 11, fontWeight: 600 }}>
                                <AlertCircle size={18} /> PENDIENTE
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10 }}>Cantidad</label>
                              <input type="number" value={item.cantidad} onChange={e => cambiarDatoItem(item.id_temp, 'cantidad', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '4px 8px' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                              <label style={{ fontSize: 10 }}>P. Unitario (S/)</label>
                              <input type="number" step="any" value={item.precio_unitario} onChange={e => cambiarDatoItem(item.id_temp, 'precio_unitario', e.target.value)} style={{ width: '100%', fontSize: 12, padding: '4px 8px' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px dashed var(--borde)' }} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>Total en PDF:</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--texto-suave)' }}>S/</span>
                        <input type="number" step="any" value={datosFactura.total} onChange={e => cambiarDatoFactura('total', e.target.value)} style={{ width: 100, fontSize: 16, fontWeight: 800, color: 'var(--naranja)', textAlign: 'right', padding: '4px 8px' }} />
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

      {/* TAB 2: HISTORIAL */}
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

      {/* TAB 3: ANÁLISIS */}
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
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Top Productos con Mayor Inversión</h3>
            </div>
            <div style={{ padding: '12px 0' }}>
              {topComprados.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--texto-suave)', padding: 20 }}>Sin compras en este periodo</p>
              ) : (
                topComprados.slice(0, 10).map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--borde)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--texto-suave)', width: 20 }}>{idx + 1}</span>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                        <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Comprados: {p.cantidad} unidades</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#D00' }}>S/ {p.gasto.toFixed(2)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
