import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, 
  BarChart3, Calendar, Package, ShoppingCart, RefreshCw, 
  Plus, Edit3, Search, ExternalLink, Receipt, Printer, EyeOff, Eye
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

// --------------------------------------------------------
// ESTILOS PARA IMPRESIÓN (Oculta el resto de la web al imprimir)
// --------------------------------------------------------
const estilosImpresion = `
  @media print {
    body * { visibility: hidden; }
    #zona-impresion, #zona-impresion * { visibility: visible; }
    #zona-impresion { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
    .no-print { display: none !important; }
  }
`;

// --------------------------------------------------------
// COMPONENTE: Buscador con autocompletado (No borra el original)
// --------------------------------------------------------
const BuscadorProductos = ({ item, productosDB, onSelect }) => {
  const prodVinculado = productosDB.find(p => p.id === item.producto_db_id)
  const [busqueda, setBusqueda] = useState(prodVinculado ? prodVinculado.nombre : '')
  const [mostrarOpciones, setMostrarOpciones] = useState(false)

  useEffect(() => {
    if (item.producto_db_id) {
       const p = productosDB.find(x => x.id === item.producto_db_id)
       if (p) setBusqueda(p.nombre)
    }
  }, [item.producto_db_id, productosDB])

  const filtrados = productosDB.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        type="text"
        placeholder="🔍 Vincular con producto de almacén..."
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setMostrarOpciones(true); onSelect(null) }}
        onFocus={() => setMostrarOpciones(true)}
        onBlur={() => setTimeout(() => setMostrarOpciones(false), 200)}
        style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #3b82f655', borderRadius: 4, background: '#3b82f605' }}
      />
      {mostrarOpciones && filtrados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--fondo)', border: '1px solid var(--borde)', maxHeight: 150, overflowY: 'auto', zIndex: 10, borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          {filtrados.map(p => (
            <div
              key={p.id}
              onClick={() => { setBusqueda(p.nombre); onSelect(p.id); setMostrarOpciones(false) }}
              style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
              onMouseEnter={(e) => e.target.style.background = '#f59e0b22'}
              onMouseLeave={(e) => e.target.style.background = 'transparent'}
            >
              <div style={{ fontWeight: 600 }}>{p.nombre}</div>
              <div style={{ fontSize: 10, color: 'var(--texto-suave)' }}>Stock: {p.stock} unid.</div>
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
  
  // Estados Registro
  const [modoIngreso, setModoIngreso] = useState(null) 
  const [pdfUrl, setPdfUrl] = useState('')
  const [procesandoPdf, setProcesandoPdf] = useState(false)
  
  const [datosFactura, setDatosFactura] = useState({
    proveedor: '', ruc: '', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], 
    subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '', items: []
  })

  // Estados Historial
  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [compraExpandida, setCompraExpandida] = useState(null)
  const [ocultarAlmacen, setOcultarAlmacen] = useState(false) // Toggle para impresión

  // Estados Análisis
  const [busquedaAnalisis, setBusquedaAnalisis] = useState('')
  const [desde, setDesde] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
  })
  const [hasta, setHasta] = useState(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0]
  })

  // --------------------------------------------------------
  // AUTO-GUARDADO (Recuperar Borrador)
  // --------------------------------------------------------
  useEffect(() => {
    const borrador = localStorage.getItem('borradorCompras')
    if (borrador) {
      try {
        const guardado = JSON.parse(borrador)
        if (guardado.modoIngreso) setModoIngreso(guardado.modoIngreso)
        if (guardado.datosFactura) setDatosFactura(guardado.datosFactura)
      } catch (e) { console.error('Error cargando borrador') }
    }
  }, [])

  // Guardar en localStorage cada vez que haya un cambio
  useEffect(() => {
    if (modoIngreso) {
      localStorage.setItem('borradorCompras', JSON.stringify({ modoIngreso, datosFactura }))
    }
  }, [datosFactura, modoIngreso])


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
  // LÓGICA DE REGISTRO E IA
  // --------------------------------------------------------
  const convertirPdfABase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = (error) => reject(error)
    })
  }

  const handleSubirPDF = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setModoIngreso('ia')
    setPdfUrl(URL.createObjectURL(file))
    await procesarDocumentoConGemini(file)
  }

  const iniciarModoManual = () => {
    setPdfUrl(''); setModoIngreso('manual')
    setDatosFactura({
      proveedor: '', ruc: '', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], 
      subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '',
      items: [{ id_temp: Date.now(), nombreOriginal: '', cantidad: 1, precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }]
    })
  }

  const resetearIngreso = () => {
    setModoIngreso(null); setPdfUrl(''); localStorage.removeItem('borradorCompras')
    setDatosFactura({ proveedor: '', ruc: '', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '', items: [] })
  }

  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API Key configurada')

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      const prompt = `Analiza detenidamente este comprobante. REGLAS: 1. Convierte docenas a unidades ("1 1/2 DO" = 18). 2. Extrae PRECIO TOTAL PAGADO POR LÍNEA en "precio_total_linea" (SIN IGV si el recibo lo detalla aparte). Extrae JSON plano: {"proveedor": "Nombre", "ruc": "RUC", "numero_comprobante": "Serie-Corr", "fecha": "YYYY-MM-DD", "subtotal": 0, "igv": 0, "otros_cargos": 0, "total": 0, "items": [{"nombreOriginal": "Desc exacta del recibo", "cantidad": 1, "precio_total_linea": 0}]}`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Pdf } }, { text: prompt }] }] }) }
      )
      if (!response.ok) throw new Error('Error en IA')

      const data = await response.json()
      const jsonLimpio = data.candidates?.[0]?.content?.parts?.[0]?.text.replace(/```json/g, '').replace(/```/g, '').trim()
      const resultado = JSON.parse(jsonLimpio)

      const itemsProcesados = (resultado.items || []).map(item => {
        const coincidencia = productosDB.find(p => p.nombre.toLowerCase().includes(item.nombreOriginal.toLowerCase()) || item.nombreOriginal.toLowerCase().includes(p.nombre.toLowerCase()))
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
        fecha: resultado.fecha || new Date().toISOString().split('T')[0], 
        subtotal: Number(resultado.subtotal) || 0, igv: Number(resultado.igv) || 0, otros_cargos: Number(resultado.otros_cargos) || 0, 
        total: Number(resultado.total) || 0, enlace_drive: '', items: itemsProcesados
      })
      toast.success('Documento analizado. Tus datos se autoguardarán.')
    } catch (error) { toast.error('Error IA: ' + error.message) } finally { setProcesandoPdf(false) }
  }

  // Funciones de formulario interactivo
  const agregarFilaManual = () => setDatosFactura(prev => ({ ...prev, items: [...prev.items, { id_temp: Date.now(), nombreOriginal: '', cantidad: 1, precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }] }))
  const quitarFila = (idTemp) => {
    setDatosFactura(prev => {
      const nuevosItems = prev.items.filter(i => i.id_temp !== idTemp);
      const nuevoSub = nuevosItems.reduce((acc, item) => acc + Number(item.precio_total_linea || 0), 0);
      const nuevoTotal = nuevoSub + Number(prev.igv || 0) + Number(prev.otros_cargos || 0);
      return { ...prev, items: nuevosItems, subtotal: nuevoSub, total: nuevoTotal };
    })
  }
  
  // Vinculación separada (no borra el nombre original)
  const emparejarProducto = (idTemp, idDB) => setDatosFactura(prev => ({ ...prev, items: prev.items.map(i => i.id_temp === idTemp ? { ...i, producto_db_id: idDB, estado: idDB ? 'vinculado' : 'pendiente' } : i) }))
  
  const cambiarDatoItem = (idTemp, c, v) => {
    setDatosFactura(prev => {
      const nuevosItems = prev.items.map(i => i.id_temp === idTemp ? { ...i, [c]: v } : i);
      if (c === 'precio_total_linea') {
        const nuevoSub = nuevosItems.reduce((acc, item) => acc + Number(item.precio_total_linea || 0), 0);
        const nuevoTotal = nuevoSub + Number(prev.igv || 0) + Number(prev.otros_cargos || 0);
        return { ...prev, items: nuevosItems, subtotal: nuevoSub, total: nuevoTotal };
      }
      return { ...prev, items: nuevosItems };
    })
  }

  const cambiarDatoFactura = (c, v) => {
    setDatosFactura(prev => {
      const nuevo = { ...prev, [c]: v };
      if (c === 'igv' || c === 'otros_cargos' || c === 'subtotal') {
        nuevo.total = Number(nuevo.subtotal || 0) + Number(nuevo.igv || 0) + Number(nuevo.otros_cargos || 0);
      }
      return nuevo;
    })
  }

  // REGLA DE 3 MESES
  const fechaFactura = new Date(datosFactura.fecha);
  const fechaHace3Meses = new Date(); fechaHace3Meses.setMonth(fechaHace3Meses.getMonth() - 3);
  const obligarVinculacion = fechaFactura < fechaHace3Meses;

  const guardarCompra = async () => {
    if (!datosFactura.proveedor) return toast.error('Falta proveedor')
    if (!datosFactura.enlace_drive || datosFactura.enlace_drive.trim() === '') return toast.error('El enlace de Google Drive es obligatorio')
    
    const pendientes = datosFactura.items.filter(i => !i.producto_db_id)
    
    // Si la factura es antigua (>3 meses), bloqueamos. Si es reciente, advertimos pero dejamos guardar.
    if (pendientes.length > 0 && obligarVinculacion) {
      return toast.error('Comprobante antiguo (>3 meses). Debes vincular TODOS los productos al almacén obligatoriamente.')
    }

    setCargando(true)
    try {
      const payloadCompra = {
        empresa: datosFactura.proveedor, ruc: datosFactura.ruc || '00000000000', subtotal: datosFactura.subtotal,
        igv: datosFactura.igv, otros_cargos: datosFactura.otros_cargos, total: datosFactura.total, 
        fecha_compra: datosFactura.fecha, numero_comprobante: datosFactura.numero_comprobante || 'S/N', enlace_drive: datosFactura.enlace_drive
      }
      
      const { data: compraData, error: errCompra } = await supabase.from('compras').insert(payloadCompra).select().single()
      if (errCompra) throw errCompra

      const subtotalBase = Number(datosFactura.subtotal) || 1;
      const totalConImpuestos = Number(datosFactura.total) || 1;
      const factorDistribucion = datosFactura.subtotal > 0 ? (totalConImpuestos / subtotalBase) : 1;

      for (const item of datosFactura.items) {
        const costoTotalLineaConImpuestos = Number(item.precio_total_linea) * factorDistribucion;
        const unitarioReal = costoTotalLineaConImpuestos / (Number(item.cantidad) || 1);

        await supabase.from('compra_items').insert({
          compra_id: compraData.id, 
          producto_id: item.producto_db_id || null, // Permite null si guardó como pendiente
          nombre_original: item.nombreOriginal, // ¡Aquí se guarda el precedente histórico!
          cantidad: item.cantidad,
          precio_unitario: unitarioReal, 
          subtotal: costoTotalLineaConImpuestos
        })
        
        if (item.producto_db_id) {
          const prodDB = productosDB.find(p => p.id === item.producto_db_id)
          if (prodDB) await supabase.from('productos').update({ stock: prodDB.stock + Number(item.cantidad) }).eq('id', prodDB.id)
        }
      }

      toast.success(pendientes.length > 0 ? 'Compra registrada con productos pendientes.' : 'Compra registrada y almacén actualizado.')
      resetearIngreso(); cargarHistorial(); cargarProductos(); setTabActual('historial')
    } catch (error) { toast.error('Error al guardar: ' + error.message) } finally { setCargando(false) }
  }

  // --------------------------------------------------------
  // LÓGICA DE HISTORIAL Y ANÁLISIS
  // --------------------------------------------------------
  const comprasFiltradasHistorial = comprasHistorial.filter(c => {
    if (!busquedaHistorial) return true;
    const termino = busquedaHistorial.toLowerCase();
    return (c.empresa || '').toLowerCase().includes(termino) || 
           (c.ruc || '').toLowerCase().includes(termino) || 
           (c.numero_comprobante || '').toLowerCase().includes(termino) || 
           (c.total || '').toString().includes(termino) || 
           c.compra_items?.some(i => (i.nombre_original || '').toLowerCase().includes(termino) || (i.productos?.nombre || '').toLowerCase().includes(termino));
  })

  let gastoTotal = 0; let productosComprados = 0; const productosStats = {}
  comprasHistorial.forEach(compra => {
    compra.compra_items?.forEach(item => {
      const p = item.productos // Solo sumamos para análisis si está vinculado a almacén
      if (p) {
        if (busquedaAnalisis && !p.nombre.toLowerCase().includes(busquedaAnalisis.toLowerCase())) return;
        const cant = Number(item.cantidad || 0); const gasto = (cant * Number(item.precio_unitario))
        productosComprados += cant; gastoTotal += gasto
        if (!productosStats[item.producto_id]) productosStats[item.producto_id] = { nombre: p.nombre, cantidad: 0, gasto: 0 }
        productosStats[item.producto_id].cantidad += cant
        productosStats[item.producto_id].gasto += gasto
      }
    })
  })

  const diasTranscurridos = Math.max(1, Math.ceil((new Date(hasta + 'T23:59:59') - new Date(desde + 'T00:00:00')) / (1000 * 60 * 60 * 24)))
  const promedioGastoDiario = gastoTotal / diasTranscurridos
  
  const statsArray = Object.values(productosStats).map(p => ({ ...p, costoPromedio: p.cantidad > 0 ? (p.gasto / p.cantidad) : 0 }))
  const topComprados = [...statsArray].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5)
  const menosComprados = [...statsArray].sort((a, b) => a.cantidad - b.cantidad).slice(0, 5)
  const masCostosos = [...statsArray].sort((a, b) => b.costoPromedio - a.costoPromedio).slice(0, 5)
  const menosCostosos = [...statsArray].sort((a, b) => a.costoPromedio - b.costoPromedio).slice(0, 5)

  const chartData = statsArray.sort((a, b) => b.gasto - a.gasto).slice(0, 10).map(p => ({
    name: p.nombre.substring(0, 15) + '...', Inversión: parseFloat(p.gasto.toFixed(2)), Unidades: p.cantidad
  }))

  const compraActiva = comprasHistorial.find(c => c.id === compraExpandida)

  const imprimirComprobante = () => { window.print() }

  return (
    <div>
      <style>{estilosImpresion}</style>
      
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>Gestión de Compras<span style={{ color: 'var(--naranja)' }}>.</span></h1>
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('registro')} className={tabActual === 'registro' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><UploadCloud size={16} /> Registro</button>
          <button onClick={() => setTabActual('historial')} className={tabActual === 'historial' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><FileText size={16} /> Historial</button>
          <button onClick={() => setTabActual('analisis')} className={tabActual === 'analisis' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><BarChart3 size={16} /> Análisis</button>
        </div>
      </div>

      {/* -------------------- TAB REGISTRO -------------------- */}
      {tabActual === 'registro' && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: modoIngreso === 'ia' ? '1fr 1fr' : '1fr', gap: 20, minHeight: 'calc(100vh - 120px)' }}>
          {!modoIngreso && (
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>¿Cómo deseas registrar la compra?</h2>
              <div style={{ display: 'flex', gap: 20 }}>
                <div className="card" style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40 }} onClick={() => document.getElementById('file-upload').click()}>
                   <UploadCloud size={48} style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Escanear Comprobante</h3>
                   <input id="file-upload" type="file" accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleSubirPDF} />
                </div>
                <div className="card" style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40 }} onClick={iniciarModoManual}>
                   <Edit3 size={48} style={{ margin: '0 auto 16px', color: '#10b981' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ingreso Manual</h3>
                </div>
              </div>
            </div>
          )}

          {modoIngreso === 'ia' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Documento Adjunto</h3>
                <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Limpiar Borrador</button>
              </div>
              <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pdfUrl ? <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="Vista" /> : <p style={{ color: '#fff', fontSize: 12 }}>Sube un documento de nuevo para previsualizar (El formulario se ha restaurado)</p>}
              </div>
            </div>
          )}

          {modoIngreso && (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: modoIngreso === 'manual' ? '0 auto' : 0, maxWidth: modoIngreso === 'manual' ? 700 : '100%', width: '100%' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>Formulario Autoguardado {procesandoPdf && <span className="spinner" style={{ width: 14, height: 14 }} />}</h3>
                {modoIngreso === 'manual' && <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Descartar Borrador</button>}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
                {procesandoPdf ? ( <div style={{ textAlign: 'center', padding: '40px 0' }}><RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} /><p>Analizando...</p></div> ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    
                    <div style={{ background: '#3b82f615', padding: 12, borderRadius: 8, border: '1px dashed #3b82f6' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                        <ExternalLink size={16} /> Enlace de Google Drive (Obligatorio)
                      </label>
                      <input type="url" placeholder="https://drive.google.com/file/d/..." value={datosFactura.enlace_drive} onChange={e => cambiarDatoFactura('enlace_drive', e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 12px', border: '1px solid #3b82f655', borderRadius: 4 }} required />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><label style={{ fontSize: 11, fontWeight: 600 }}>RUC</label><input type="text" value={datosFactura.ruc} onChange={e => cambiarDatoFactura('ruc', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Fecha</label>
                        <input type="date" value={datosFactura.fecha} onChange={e => cambiarDatoFactura('fecha', e.target.value)} style={{ width: '100%', fontSize: 13, color: obligarVinculacion ? '#D00' : 'inherit' }} />
                        {obligarVinculacion && <p style={{ fontSize: 10, color: '#D00', marginTop: 4 }}>+3 meses (Vinculación Obligatoria)</p>}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>Proveedor / Empresa</label><input type="text" value={datosFactura.proveedor} onChange={e => cambiarDatoFactura('proveedor', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>N° Boleta/Factura</label><input type="text" value={datosFactura.numero_comprobante} onChange={e => cambiarDatoFactura('numero_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700 }}>Relación con Almacén</h4>
                      {modoIngreso === 'manual' && <button onClick={agregarFilaManual} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#10b981' }}><Plus size={14} /> Fila</button>}
                    </div>
                      
                    {datosFactura.items.map((item) => {
                      const unitarioDerivado = (Number(item.precio_total_linea) / (Number(item.cantidad) || 1)).toFixed(4)
                      return (
                      <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: item.estado === 'vinculado' ? '#10b98108' : '#f59e0b08', position: 'relative' }}>
                        {modoIngreso === 'manual' && datosFactura.items.length > 1 && <button onClick={() => quitarFila(item.id_temp)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#D00', cursor: 'pointer', fontSize: 12 }}>X</button>}
                        
                        {/* Nombre del Recibo Físico (Precedente) */}
                        <div style={{ marginBottom: 12 }}>
                           <label style={{ fontSize: 10, color: 'var(--texto-suave)' }}>Descripción Original (Boleta):</label>
                           <input type="text" value={item.nombreOriginal} onChange={e => cambiarDatoItem(item.id_temp, 'nombreOriginal', e.target.value)} style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '4px 8px', border: '1px solid var(--borde)', borderRadius: 4 }} />
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <BuscadorProductos item={item} productosDB={productosDB} onSelect={(id) => emparejarProducto(item.id_temp, id)} />
                          {item.estado === 'vinculado' ? <CheckCircle size={20} color="#10b981" style={{ minWidth: 20 }} /> : <AlertCircle size={18} color={obligarVinculacion ? "#D00" : "#f59e0b"} />}
                        </div>

                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Cantidad</label><input type="number" value={item.cantidad} onChange={e => cambiarDatoItem(item.id_temp, 'cantidad', e.target.value)} style={{ width: '100%', fontSize: 12 }} /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--texto-suave)' }}>Subtotal Línea (S/)</label><input type="number" step="any" value={item.precio_total_linea} onChange={e => cambiarDatoItem(item.id_temp, 'precio_total_linea', e.target.value)} style={{ width: '100%', fontSize: 12 }} /></div>
                        </div>
                        {/* PRECIO UNITARIO RECUPERADO */}
                        <div style={{ marginTop: 8, textAlign: 'right' }}><span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Unitario Base: <b>S/ {unitarioDerivado}</b></span></div>
                      </div>
                    )})}
                    
                    <div style={{ background: 'var(--fondo)', padding: 16, borderRadius: 8, border: '1px solid var(--borde)', marginTop: 8 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--texto-suave)' }}>Desglose de Totales y Cargos</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>Suma Subtotales</label><input type="number" step="any" value={datosFactura.subtotal} readOnly style={{ width: '100%', fontSize: 13, background: '#f3f4f6', cursor: 'not-allowed' }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>IGV (S/)</label><input type="number" step="any" value={datosFactura.igv} onChange={e => cambiarDatoFactura('igv', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>Otros Cargos (Envíos, etc)</label><input type="number" step="any" value={datosFactura.otros_cargos} onChange={e => cambiarDatoFactura('otros_cargos', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 800, color: 'var(--naranja)' }}>TOTAL FINAL (S/)</label><input type="number" step="any" value={datosFactura.total} onChange={e => cambiarDatoFactura('total', e.target.value)} style={{ width: '100%', fontSize: 14, fontWeight: 700, color: 'var(--naranja)', border: '1px solid var(--naranja)' }} /></div>
                      </div>
                    </div>

                  </div>
                )}
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid var(--borde)' }}>
                <button onClick={guardarCompra} disabled={procesandoPdf || datosFactura.items.length === 0} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Registrar Compra y Actualizar Almacén</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------- TAB HISTORIAL -------------------- */}
      {tabActual === 'historial' && (
        <div className="no-print" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          
          <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '100%', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--texto-suave)' }} />
                <input type="text" placeholder="Buscar Proveedor, RUC, Producto, N° Boleta..." value={busquedaHistorial} onChange={(e) => setBusquedaHistorial(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 36px', fontSize: 13, borderRadius: 8, border: '1px solid var(--borde)' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
              </div>
            </div>

            {cargando ? <div className="spinner" style={{ margin: '40px auto' }} /> : comprasFiltradasHistorial.length === 0 ? (
               <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>No se encontraron resultados en el historial.</div>
            ) : (
              comprasFiltradasHistorial.map(compra => (
                <div key={compra.id} onClick={() => setCompraExpandida(compra.id)} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: compraExpandida === compra.id ? '2px solid var(--naranja)' : '1px solid transparent', background: compraExpandida === compra.id ? 'var(--fondo)' : '#fff' }}>
                  <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: compraExpandida === compra.id ? 'var(--naranja)' : 'inherit' }}>{compra.empresa}</h3>
                    <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{compra.fecha_compra} | Boleta: {compra.numero_comprobante || 'S/N'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#D00' }}>S/ {Number(compra.total).toFixed(2)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          
          {/* PLANTILLA DE RECIBO (Y ZONA DE IMPRESIÓN) */}
          <div style={{ flex: '1 1 50%', position: 'sticky', top: 20 }}>
            {compraActiva ? (
              <div id="zona-impresion" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 32, fontFamily: '"Courier New", Courier, monospace', border: '1px solid #e5e7eb', position: 'relative' }}>
                
                {/* Botones Flotantes (No se imprimen) */}
                <div className="no-print" style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8 }}>
                   <button onClick={() => setOcultarAlmacen(!ocultarAlmacen)} className="btn-ghost" title="Ocultar/Mostrar vinculación de Almacén" style={{ padding: 8 }}>
                     {ocultarAlmacen ? <EyeOff size={16} color="var(--texto-suave)" /> : <Eye size={16} color="#3b82f6" />}
                   </button>
                   <button onClick={imprimirComprobante} className="btn-primary" style={{ padding: 8, background: '#111827', color: '#fff' }}>
                     <Printer size={16} /> Imprimir / PDF
                   </button>
                </div>

                <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: 20, marginBottom: 20 }}>
                  <Receipt size={40} style={{ margin: '0 auto 10px', color: '#4b5563' }} className="no-print" />
                  <h2 style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Comprobante Digital</h2>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>SISTEMA DE GESTIÓN DE INVENTARIO</p>
                </div>
                
                <div style={{ marginBottom: 24, fontSize: 13, lineHeight: '1.6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>PROVEEDOR:</b> <span>{compraActiva.empresa}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>RUC:</b> <span>{compraActiva.ruc}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>N° COMPROBANTE:</b> <span>{compraActiva.numero_comprobante || 'S/N'}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>FECHA EMISIÓN:</b> <span>{compraActiva.fecha_compra}</span></div>
                </div>

                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px dashed #d1d5db' }}>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>CANT</th>
                      <th style={{ textAlign: 'left', padding: '8px 0' }}>DESCRIPCIÓN</th>
                      <th style={{ textAlign: 'right', padding: '8px 0' }}>COSTO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {compraActiva.compra_items.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px dashed #f3f4f6' }}>
                        <td style={{ padding: '8px 0', verticalAlign: 'top' }}>{item.cantidad}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ fontWeight: 700 }}>{item.nombre_original || 'Sin descripción original'}</div>
                          
                          {/* Muestra Almacén solo si está vinculado y el Toggle no lo oculta */}
                          {!ocultarAlmacen && item.productos && (
                            <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, marginTop: 2 }}>
                              ↳ Almacén: {item.productos.nombre}
                            </div>
                          )}
                          {!ocultarAlmacen && !item.productos && (
                            <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>
                              ↳ Almacén: Pendiente (Sin vincular)
                            </div>
                          )}

                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginTop: 2 }}>Unit. Real: S/ {Number(item.precio_unitario).toFixed(4)}</div>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>S/ {Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Resumen Financiero */}
                <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 16, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 4 }}>
                    <span>SUBTOTAL ITEMS:</span> <span>S/ {Number(compraActiva.subtotal || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 4 }}>
                    <span>IGV:</span> <span>S/ {Number(compraActiva.igv || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 8 }}>
                    <span>OTROS CARGOS:</span> <span>S/ {Number(compraActiva.otros_cargos || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '2px solid #000', paddingTop: 8 }}>
                    <span>TOTAL PAGADO:</span>
                    <span>S/ {Number(compraActiva.total).toFixed(2)}</span>
                  </div>
                </div>

                {compraActiva.enlace_drive && (
                  <div className="no-print" style={{ marginTop: 30, textAlign: 'center' }}>
                    <a href={compraActiva.enlace_drive} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                      <ExternalLink size={16} /> Ver Documento Original en Drive
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--texto-suave)', border: '2px dashed var(--borde)', borderRadius: 12 }}>
                <Receipt size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p>Selecciona un registro para ver el comprobante digital.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- TAB ANÁLISIS -------------------- */}
      {tabActual === 'analisis' && (
        <div className="analisis-container no-print">
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--texto-suave)' }} />
              <input type="text" placeholder="🔍 Filtrar métricas por nombre de producto de almacén..." value={busquedaAnalisis} onChange={(e) => setBusquedaAnalisis(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 36px', fontSize: 13, borderRadius: 8, border: '1px solid var(--borde)' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Calendar size={16} color="var(--texto-suave)" />
              <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
              <span>-</span>
              <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #D00' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Total Invertido</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4, color: '#D00' }}>S/ {gastoTotal.toFixed(2)}</h3>
            </div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #3b82f6' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Unidades Compradas</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4 }}>{productosComprados}</h3>
            </div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid var(--naranja)' }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Productos Distintos</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--naranja)' }}>{statsArray.length}</h3>
            </div>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600, textTransform: 'uppercase' }}>Gasto Diario Promedio</p>
              <h3 style={{ fontFamily: 'var(--fuente-display)', fontSize: 20, fontWeight: 800, marginTop: 4 }}>S/ {promedioGastoDiario.toFixed(2)}</h3>
            </div>
          </div>

          {!busquedaAnalisis && chartData.length > 0 && (
            <div className="card" style={{ padding: 20, marginBottom: 24, height: 350 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Diagrama: Top 10 Productos con Mayor Inversión</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} orientation="left" stroke="#D00" />
                  <YAxis yAxisId="right" tick={{ fontSize: 11 }} orientation="right" stroke="#3b82f6" />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="left" dataKey="Inversión" fill="#D00" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="Unidades" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}><h3 style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>🔥 Top 5 Más Pedidos (Unidades)</h3></div>
              <div style={{ padding: 12 }}>
                {topComprados.map((p, idx) => (<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--borde)' }}><span style={{ fontSize: 12, fontWeight: 600 }}>{idx+1}. {p.nombre}</span><span style={{ fontSize: 12, fontWeight: 800, color: '#3b82f6' }}>{p.cantidad} unid.</span></div>))}
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}><h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-suave)' }}>🧊 Top 5 Menos Pedidos (Unidades)</h3></div>
              <div style={{ padding: 12 }}>
                {menosComprados.map((p, idx) => (<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--borde)' }}><span style={{ fontSize: 12, fontWeight: 600 }}>{idx+1}. {p.nombre}</span><span style={{ fontSize: 12, fontWeight: 800, color: 'var(--texto-suave)' }}>{p.cantidad} unid.</span></div>))}
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}><h3 style={{ fontSize: 13, fontWeight: 700, color: '#D00' }}>💸 Top 5 Más Costosos (Costo Unitario)</h3></div>
              <div style={{ padding: 12 }}>
                {masCostosos.map((p, idx) => (<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--borde)' }}><span style={{ fontSize: 12, fontWeight: 600 }}>{idx+1}. {p.nombre}</span><span style={{ fontSize: 12, fontWeight: 800, color: '#D00' }}>S/ {p.costoPromedio.toFixed(2)}</span></div>))}
              </div>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', background: 'var(--fondo)', borderBottom: '1px solid var(--borde)' }}><h3 style={{ fontSize: 13, fontWeight: 700, color: '#10b981' }}>🪙 Top 5 Más Económicos (Costo Unitario)</h3></div>
              <div style={{ padding: 12 }}>
                {menosCostosos.map((p, idx) => (<div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--borde)' }}><span style={{ fontSize: 12, fontWeight: 600 }}>{idx+1}. {p.nombre}</span><span style={{ fontSize: 12, fontWeight: 800, color: '#10b981' }}>S/ {p.costoPromedio.toFixed(2)}</span></div>))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ShoppingCart size={18} color="var(--naranja)" />
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Resumen de Costos (Impuestos Incluidos) y Proyección (+30%)</h3>
            </div>
            <div style={{ padding: '12px 0' }}>
              {statsArray.length === 0 ? ( <p style={{ textAlign: 'center', color: 'var(--texto-suave)', padding: 20 }}>No hay datos para mostrar.</p> ) : (
                statsArray.sort((a,b) => b.gasto - a.gasto).map((p, idx) => {
                  const precioSugeridoVenta = p.costoPromedio * 1.30; 
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px', borderBottom: '1px solid var(--borde)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--texto-suave)', width: 20 }}>{idx + 1}</span>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600 }}>{p.nombre}</p>
                          <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Invertido: S/ {p.gasto.toFixed(2)}</p>
                            <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Unidades: {p.cantidad}</p>
                            <p style={{ fontSize: 11, color: '#D00', fontWeight: 600 }}>Unitario Promedio: S/ {p.costoPromedio.toFixed(4)}</p>
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--texto-suave)', marginBottom: 2 }}>Venta Sugerida</p>
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
