import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, 
  BarChart3, Calendar, Package, ShoppingCart, RefreshCw, 
  Plus, Edit3, Search, ExternalLink, Receipt, Printer, EyeOff, Eye, Trash2, Download, ListChecks, SkipForward, ArrowLeft, X, Save
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

// --------------------------------------------------------
// ESTILOS PARA IMPRESIÓN
// --------------------------------------------------------
const estilosImpresion = `
  @media print {
    body * { visibility: hidden; }
    #zona-impresion, #zona-impresion * { visibility: visible; }
    #zona-impresion { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; border: none !important; box-shadow: none !important; }
    .no-print { display: none !important; }
    .solo-print { display: block !important; }
  }
  @media screen {
    .solo-print { display: none !important; }
  }
`;

// --------------------------------------------------------
// COMPONENTE: Buscador con autocompletado
// --------------------------------------------------------
const BuscadorProductos = ({ item, productosDB, onSelect, placeholder = "🔍 Vincular con producto..." }) => {
  const prodVinculado = productosDB.find(p => p.id === item.producto_db_id)
  const [busqueda, setBusqueda] = useState(prodVinculado ? prodVinculado.nombre : '')
  const [mostrarOpciones, setMostrarOpciones] = useState(false)

  useEffect(() => {
    if (item.producto_db_id) {
       const p = productosDB.find(x => x.id === item.producto_db_id)
       if (p) setBusqueda(p.nombre)
    } else {
       setBusqueda('')
    }
  }, [item.producto_db_id, productosDB])

  const filtrados = productosDB.filter(p => p.nombre.toLowerCase().includes(busqueda.toLowerCase()))

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={busqueda}
        onChange={e => { setBusqueda(e.target.value); setMostrarOpciones(true); onSelect(null) }}
        onFocus={() => setMostrarOpciones(true)}
        onBlur={() => setTimeout(() => setMostrarOpciones(false), 200)}
        style={{ width: '100%', fontSize: 13, padding: '6px 8px', border: '1px solid #3b82f655', borderRadius: 4, background: '#3b82f605' }}
      />
      {mostrarOpciones && filtrados.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--fondo)', border: '1px solid var(--borde)', maxHeight: 150, overflowY: 'auto', zIndex: 10, borderRadius: 4, boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
          {filtrados.map(p => (
            <div key={p.id} onMouseDown={() => { setBusqueda(p.nombre); onSelect(p.id); setMostrarOpciones(false) }}
              style={{ padding: '8px 10px', fontSize: 12, cursor: 'pointer', borderBottom: '1px solid var(--borde)' }}
              onMouseEnter={(e) => e.target.style.background = '#f59e0b22'} onMouseLeave={(e) => e.target.style.background = 'transparent'}
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
  
  const [productosDB, setProductosDB] = useState([])
  const [comprasHistorial, setComprasHistorial] = useState([])
  
  // Estados Registro y Lotes
  const [modoIngreso, setModoIngreso] = useState(null) 
  const [pdfUrl, setPdfUrl] = useState('')
  const [procesandoPdf, setProcesandoPdf] = useState(false)
  const [colaArchivos, setColaArchivos] = useState([]) 
  const [indiceCola, setIndiceCola] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const [datosFactura, setDatosFactura] = useState({
    proveedor: '', ruc: '', tipo_comprobante: 'Factura', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], 
    subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '', items: []
  })

  const [filtroDoc, setFiltroDoc] = useState('Todos') 

  const [busquedaHistorial, setBusquedaHistorial] = useState('')
  const [compraExpandida, setCompraExpandida] = useState(null)
  const [ocultarAlmacen, setOcultarAlmacen] = useState(false) 

  const [busquedaAnalisis, setBusquedaAnalisis] = useState('')
  const [desde, setDesde] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0] })
  const [hasta, setHasta] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0] })

  const [modalEdicion, setModalEdicion] = useState(false)
  const [compraOriginal, setCompraOriginal] = useState(null)
  const [datosEdicion, setDatosEdicion] = useState(null)

  useEffect(() => {
    const borrador = localStorage.getItem('borradorCompras')
    if (borrador) {
      try {
        const guardado = JSON.parse(borrador)
        if (guardado.modoIngreso) setModoIngreso(guardado.modoIngreso)
        if (guardado.datosFactura) setDatosFactura(guardado.datosFactura)
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (modoIngreso && colaArchivos.length === 0) localStorage.setItem('borradorCompras', JSON.stringify({ modoIngreso, datosFactura }))
  }, [datosFactura, modoIngreso, colaArchivos])

  useEffect(() => { cargarProductos(); cargarHistorial() }, [desde, hasta])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setProductosDB(data || [])
  }
  async function cargarHistorial() {
    setCargando(true)
    const { data } = await supabase.from('compras').select('*, compra_items(*, productos(*))').gte('fecha_compra', desde + 'T00:00:00').lte('fecha_compra', hasta + 'T23:59:59').order('fecha_compra', { ascending: false })
    setComprasHistorial(data || [])
    setCargando(false)
  }

  // --- LÓGICA DE DRAG & DROP Y LOTES ---
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); }
  const handleDragLeave = () => { setIsDragging(false); }
  const handleDrop = async (e) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      setModoIngreso('ia');
      setColaArchivos(files);
      setIndiceCola(0);
      await procesarDocumentoConGemini(files[0]);
    }
  }

  const convertirPdfABase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = (error) => reject(error)
    })
  }

  const handleSubirVariosPDF = async (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return
    setModoIngreso('ia')
    setColaArchivos(files)
    setIndiceCola(0)
    await procesarDocumentoConGemini(files[0])
  }

  const saltarAlSiguienteDocumento = async () => {
    if (indiceCola + 1 < colaArchivos.length) {
      const nextIndex = indiceCola + 1
      setIndiceCola(nextIndex)
      await procesarDocumentoConGemini(colaArchivos[nextIndex])
    } else {
      setColaArchivos([]); setIndiceCola(0); resetearIngreso(); toast.success('¡Todos los documentos en cola fueron procesados!')
    }
  }

  const iniciarModoManual = () => {
    setPdfUrl(''); setModoIngreso('manual'); setColaArchivos([])
    setDatosFactura({ proveedor: '', ruc: '', tipo_comprobante: 'Factura', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '', items: [{ id_temp: Date.now(), nombreOriginal: '', cantidad: '', precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }] })
  }

  const resetearIngreso = () => {
    setModoIngreso(null); setPdfUrl(''); setColaArchivos([]); localStorage.removeItem('borradorCompras')
    setDatosFactura({ proveedor: '', ruc: '', tipo_comprobante: 'Factura', numero_comprobante: '', fecha: new Date().toISOString().split('T')[0], subtotal: 0, igv: 0, otros_cargos: 0, total: 0, enlace_drive: '', items: [] })
  }

  const autoVincularProducto = (nombreOriginalIA) => {
    for (const compra of comprasHistorial) {
      const matchHistorial = compra.compra_items.find(i => i.nombre_original?.toLowerCase() === nombreOriginalIA.toLowerCase())
      if (matchHistorial && matchHistorial.producto_id) return matchHistorial.producto_id
    }
    const palabras = nombreOriginalIA.toLowerCase().split(' ')
    const coincidenciaParcial = productosDB.find(p => {
      const nombreDB = p.nombre.toLowerCase()
      return p.nombre.toLowerCase().includes(nombreOriginalIA.toLowerCase()) || nombreOriginalIA.toLowerCase().includes(nombreDB) || palabras.some(pal => pal.length > 3 && nombreDB.includes(pal))
    })
    return coincidenciaParcial ? coincidenciaParcial.id : null
  }

  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    setPdfUrl(URL.createObjectURL(file))
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API Key configurada')

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      const prompt = `Analiza detenidamente este comprobante. REGLAS: 1. Convierte docenas a unidades. 2. Extrae PRECIO TOTAL PAGADO POR LÍNEA. Extrae JSON plano: {"proveedor": "Nombre", "ruc": "RUC", "tipo_comprobante": "Factura o Boleta", "numero_comprobante": "Serie-Corr", "fecha": "YYYY-MM-DD", "subtotal": 0, "igv": 0, "otros_cargos": 0, "total": 0, "items": [{"nombreOriginal": "Desc exacta del recibo", "cantidad": 1, "precio_total_linea": 0}]}`

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Pdf } }, { text: prompt }] }] }) }
      )
      if (!response.ok) throw new Error('Error en IA')

      const data = await response.json()
      const jsonLimpio = data.candidates?.[0]?.content?.parts?.[0]?.text.replace(/```json/g, '').replace(/```/g, '').trim()
      const resultado = JSON.parse(jsonLimpio)

      const esDuplicado = comprasHistorial.some(c => c.ruc === resultado.ruc && c.numero_comprobante === resultado.numero_comprobante)
      if (esDuplicado) toast.error('¡CUIDADO! Este comprobante parece estar duplicado.', { duration: 5000 })

      const itemsProcesados = (resultado.items || []).map(item => {
        const idVinculado = autoVincularProducto(item.nombreOriginal)
        return {
          id_temp: Date.now() + Math.random(), nombreOriginal: item.nombreOriginal, 
          cantidad: item.cantidad !== undefined ? Number(item.cantidad) : 1,
          precio_total_linea: Number(item.precio_total_linea) || 0, producto_db_id: idVinculado, estado: idVinculado ? 'vinculado' : 'pendiente'
        }
      })

      setDatosFactura({
        proveedor: resultado.proveedor || '', ruc: resultado.ruc || '', tipo_comprobante: resultado.tipo_comprobante || 'Factura', numero_comprobante: resultado.numero_comprobante || '',
        fecha: resultado.fecha || new Date().toISOString().split('T')[0], subtotal: Number(resultado.subtotal) || 0, 
        igv: Number(resultado.igv) || 0, otros_cargos: Number(resultado.otros_cargos) || 0, total: Number(resultado.total) || 0, enlace_drive: '', items: itemsProcesados
      })
      toast.success(esDuplicado ? 'Archivo analizado (Posible Duplicado)' : 'Documento analizado listo para verificar.')
    } catch (error) { toast.error('Error IA: ' + error.message) } finally { setProcesandoPdf(false) }
  }

  // --- FUNCIONES FORMULARIO DE REGISTRO ---
  const agregarFilaManual = () => setDatosFactura(prev => ({ ...prev, items: [...prev.items, { id_temp: Date.now(), nombreOriginal: '', cantidad: '', precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }] }))
  
  const quitarFila = (idTemp) => { 
    setDatosFactura(prev => { 
      const n = prev.items.filter(i => i.id_temp !== idTemp); 
      const s = n.reduce((acc, i) => acc + Number(i.precio_total_linea||0), 0); 
      const t = s + Number(prev.igv||0) + Number(prev.otros_cargos||0); 
      return { ...prev, items: n, subtotal: s, total: t }; 
    }) 
  }

  const emparejarProducto = (idTemp, idDB) => {
    setDatosFactura(prev => ({ 
      ...prev, 
      items: prev.items.map(i => {
        if (i.id_temp !== idTemp) return i;
        const prod = productosDB.find(p => p.id === idDB);
        return { 
          ...i, 
          producto_db_id: idDB, 
          estado: idDB ? 'vinculado' : 'pendiente',
          nombreOriginal: i.nombreOriginal || (prod ? prod.nombre : '') 
        }
      })
    }))
  }

  const cambiarDatoItem = (idTemp, c, v) => { 
    setDatosFactura(prev => { 
      const n = prev.items.map(i => i.id_temp === idTemp ? { ...i, [c]: v } : i); 
      if (c === 'precio_total_linea') { 
        const s = n.reduce((acc, i) => acc + Number(i.precio_total_linea||0), 0); 
        const t = s + Number(prev.igv||0) + Number(prev.otros_cargos||0); 
        return { ...prev, items: n, subtotal: s, total: t }; 
      } 
      return { ...prev, items: n }; 
    }) 
  }

  const cambiarDatoFactura = (c, v) => { 
    setDatosFactura(prev => { 
      const n = { ...prev, [c]: v }; 
      if (['igv','otros_cargos','subtotal'].includes(c)) { 
        n.total = Number(n.subtotal||0) + Number(n.igv||0) + Number(n.otros_cargos||0); 
      } 
      return n; 
    }) 
  }

  // LÓGICA DE 3 MESES (SIN BLOQUEAR)
  const fechaFactura = new Date(datosFactura.fecha); 
  const fechaHace3Meses = new Date(); fechaHace3Meses.setMonth(fechaHace3Meses.getMonth() - 3);
  const esAntiguo = fechaFactura < fechaHace3Meses; 

  const guardarCompra = async () => {
    if (!datosFactura.proveedor) return toast.error('Falta proveedor')
    
    const esDuplicado = comprasHistorial.some(c => c.ruc === datosFactura.ruc && c.numero_comprobante === datosFactura.numero_comprobante && c.numero_comprobante !== 'S/N')
    if (esDuplicado) {
       if(!window.confirm('ADVERTENCIA: Ya existe una boleta registrada con ese mismo RUC y Número. ¿Estás seguro de registrarla de nuevo?')) return;
    }

    setCargando(true)
    try {
      const payloadCompra = { 
        empresa: datosFactura.proveedor, ruc: datosFactura.ruc || '00000000000', tipo_comprobante: datosFactura.tipo_comprobante, 
        subtotal: datosFactura.subtotal, igv: datosFactura.igv, otros_cargos: datosFactura.otros_cargos, total: datosFactura.total, 
        fecha_compra: datosFactura.fecha, numero_comprobante: datosFactura.numero_comprobante || 'S/N', enlace_drive: datosFactura.enlace_drive 
      }
      const { data: compraData, error: errCompra } = await supabase.from('compras').insert(payloadCompra).select().single()
      if (errCompra) throw errCompra

      const sumaLineas = datosFactura.items.reduce((acc, i) => acc + (Number(i.precio_total_linea) || 0), 0) || 1;
      const factor = datosFactura.total > 0 ? (Number(datosFactura.total) / sumaLineas) : 1;

      const itemsAInsertar = datosFactura.items.map(item => {
        const qty = Number(item.cantidad) || 0; 
        const costoTotal = Number(item.precio_total_linea) * factor; 
        const unitario = qty > 0 ? (costoTotal / qty) : 0; 
        
        return {
          compra_id: compraData.id, 
          producto_id: item.producto_db_id || null, 
          nombre_original: item.nombreOriginal || (item.producto_db_id ? productosDB.find(p=>p.id === item.producto_db_id)?.nombre : 'Item Manual'), 
          cantidad: qty, 
          precio_unitario: unitario, 
          subtotal: costoTotal 
        }
      });

      const { error: errItems } = await supabase.from('compra_items').insert(itemsAInsertar);
      if (errItems) throw new Error(`Error en los productos: ${errItems.message}`);

      for (const item of itemsAInsertar) {
        if (item.producto_id && item.cantidad > 0) { 
           const prodDB = productosDB.find(p => p.id === item.producto_id); 
           if (prodDB) await supabase.from('productos').update({ stock: prodDB.stock + item.cantidad }).eq('id', prodDB.id); 
        }
      }

      toast.success('Compra Registrada con Éxito')
      
      if (colaArchivos.length > 1 && indiceCola + 1 < colaArchivos.length) {
         saltarAlSiguienteDocumento()
      } else {
         resetearIngreso(); cargarHistorial(); cargarProductos(); setTabActual('historial')
      }
    } catch (error) { toast.error('Error al guardar: ' + error.message) } finally { setCargando(false) }
  }

  const eliminarCompra = async (id) => {
    if (!window.confirm('¿ELIMINAR esta compra? Se restarán los productos y se borrará del historial y análisis.')) return;
    setCargando(true);
    try {
      const c = comprasHistorial.find(x => x.id === id);
      if (c && c.compra_items) {
        for (const i of c.compra_items) {
          if (i.producto_id && Number(i.cantidad) > 0) { 
             const { data: dbProd } = await supabase.from('productos').select('stock').eq('id', i.producto_id).single();
             if (dbProd) await supabase.from('productos').update({ stock: dbProd.stock - Number(i.cantidad) }).eq('id', i.producto_id); 
          }
        }
      }
      await supabase.from('compra_items').delete().eq('compra_id', id); await supabase.from('compras').delete().eq('id', id);
      toast.success('Compra eliminada correctamente.'); setCompraExpandida(null); cargarHistorial(); cargarProductos();
    } catch (error) { toast.error('Error: ' + error.message); } finally { setCargando(false); }
  }

  // --- SECCIÓN DE EDICIÓN DE COMPRA ---
  const abrirEdicion = (compra) => {
    setCompraOriginal(compra);
    setDatosEdicion({
      id: compra.id,
      proveedor: compra.empresa || '',
      ruc: compra.ruc || '',
      tipo_comprobante: compra.tipo_comprobante || 'Factura',
      numero_comprobante: compra.numero_comprobante || '',
      fecha: compra.fecha_compra || '',
      subtotal: compra.subtotal || 0,
      igv: compra.igv || 0,
      otros_cargos: compra.otros_cargos || 0,
      total: compra.total || 0,
      enlace_drive: compra.enlace_drive || '',
      items: compra.compra_items.map(i => ({
        id_temp: i.id || Date.now() + Math.random(), 
        nombreOriginal: i.nombre_original || '',
        cantidad: i.cantidad,
        precio_total_linea: i.subtotal || 0,
        producto_db_id: i.producto_id,
        estado: i.producto_id ? 'vinculado' : 'pendiente'
      }))
    });
    setModalEdicion(true);
  }

  const cambiarDatoEdicion = (c, v) => { 
     setDatosEdicion(prev => { 
        const n = { ...prev, [c]: v }; 
        if (['igv','otros_cargos','subtotal'].includes(c)) { 
           n.total = Number(n.subtotal||0) + Number(n.igv||0) + Number(n.otros_cargos||0); 
        } 
        return n; 
     }) 
  }

  const cambiarDatoItemEdicion = (idTemp, c, v) => { 
     setDatosEdicion(prev => { 
        const n = prev.items.map(i => i.id_temp === idTemp ? { ...i, [c]: v } : i); 
        if (c === 'precio_total_linea') { 
           const s = n.reduce((acc, i) => acc + Number(i.precio_total_linea||0), 0); 
           const t = s + Number(prev.igv||0) + Number(prev.otros_cargos||0); 
           return { ...prev, items: n, subtotal: s, total: t }; 
        } 
        return { ...prev, items: n }; 
     }) 
  }

  const emparejarProductoEdicion = (idTemp, idDB) => {
    setDatosEdicion(prev => ({ 
      ...prev, 
      items: prev.items.map(i => {
        if (i.id_temp !== idTemp) return i;
        const prod = productosDB.find(p => p.id === idDB);
        return { 
          ...i, 
          producto_db_id: idDB, 
          estado: idDB ? 'vinculado' : 'pendiente',
          nombreOriginal: i.nombreOriginal || (prod ? prod.nombre : '')
        }
      })
    }))
  }

  const agregarFilaEdicion = () => {
     setDatosEdicion(prev => ({ ...prev, items: [...prev.items, { id_temp: Date.now(), nombreOriginal: '', cantidad: '', precio_total_linea: 0, producto_db_id: null, estado: 'pendiente' }] }))
  }

  const quitarFilaEdicion = (idTemp) => { 
     setDatosEdicion(prev => { 
        const n = prev.items.filter(i => i.id_temp !== idTemp); 
        const s = n.reduce((acc, i) => acc + Number(i.precio_total_linea||0), 0); 
        const t = s + Number(prev.igv||0) + Number(prev.otros_cargos||0); 
        return { ...prev, items: n, subtotal: s, total: t }; 
     }) 
  }

  const guardarEdicion = async () => {
    if (!datosEdicion.proveedor) return toast.error('Falta proveedor')
    setCargando(true)
    try {
      for (const old of compraOriginal.compra_items) {
        if (old.producto_id && Number(old.cantidad) > 0) {
           const { data: pData } = await supabase.from('productos').select('stock').eq('id', old.producto_id).single();
           if (pData) await supabase.from('productos').update({ stock: pData.stock - Number(old.cantidad) }).eq('id', old.producto_id);
        }
      }
      
      await supabase.from('compra_items').delete().eq('compra_id', compraOriginal.id);
      
      const payloadUpdate = {
        empresa: datosEdicion.proveedor,
        ruc: datosEdicion.ruc || '00000000000',
        tipo_comprobante: datosEdicion.tipo_comprobante,
        subtotal: datosEdicion.subtotal,
        igv: datosEdicion.igv,
        otros_cargos: datosEdicion.otros_cargos,
        total: datosEdicion.total,
        fecha_compra: datosEdicion.fecha,
        numero_comprobante: datosEdicion.numero_comprobante || 'S/N',
        enlace_drive: datosEdicion.enlace_drive
      };
      await supabase.from('compras').update(payloadUpdate).eq('id', compraOriginal.id);
      
      const sumaLineas = datosEdicion.items.reduce((acc, i) => acc + (Number(i.precio_total_linea) || 0), 0) || 1;
      const factor = datosEdicion.total > 0 ? (Number(datosEdicion.total) / sumaLineas) : 1;
      
      const itemsAInsertar = datosEdicion.items.map(item => {
        const qty = Number(item.cantidad) || 0;
        const costoTotal = Number(item.precio_total_linea) * factor; 
        const unitario = qty > 0 ? (costoTotal / qty) : 0;
        return {
          compra_id: compraOriginal.id, 
          producto_id: item.producto_db_id || null, 
          nombre_original: item.nombreOriginal || (item.producto_db_id ? productosDB.find(p=>p.id === item.producto_db_id)?.nombre : 'Item Editado'), 
          cantidad: qty, 
          precio_unitario: unitario, 
          subtotal: costoTotal 
        }
      });

      const { error: errItems } = await supabase.from('compra_items').insert(itemsAInsertar);
      if (errItems) throw new Error(`Error en los productos al editar: ${errItems.message}`);
      
      for (const item of itemsAInsertar) {
        if (item.producto_id && item.cantidad > 0) { 
           const { data: pData } = await supabase.from('productos').select('stock').eq('id', item.producto_id).single();
           if (pData) await supabase.from('productos').update({ stock: pData.stock + item.cantidad }).eq('id', item.producto_id);
        }
      }
      
      toast.success('Compra actualizada y stock corregido correctamente');
      setModalEdicion(false);
      setCompraExpandida(null); 
      cargarHistorial();
      cargarProductos();
    } catch (e) {
      toast.error('Error al editar: ' + e.message);
    } finally {
      setCargando(false);
    }
  }

  const subsanarPendiente = async (compraId, itemId, productoId, cantidad) => {
    if (!productoId) return;
    if (!window.confirm('¿Vincular este producto pendiente al almacén? Se sumará el stock correspondiente si la cantidad es mayor a 0.')) return;
    setCargando(true);
    try {
      await supabase.from('compra_items').update({ producto_id: productoId }).eq('id', itemId);
      const prod = productosDB.find(p => p.id === productoId);
      const cant = Number(cantidad) || 0;
      if (prod && cant > 0) {
        await supabase.from('productos').update({ stock: prod.stock + cant }).eq('id', productoId);
      }
      toast.success('Producto vinculado correctamente.');
      cargarHistorial(); cargarProductos();
    } catch (error) {
      toast.error('Error al vincular: ' + error.message);
    } finally {
      setCargando(false);
    }
  }

  // --- LOGICA EXPORTACIÓN DETALLADA ---
  const comprasFiltradasHistorial = comprasHistorial.filter(c => {
    if (filtroDoc !== 'Todos') {
      const tipo = c.tipo_comprobante || 'Factura';
      if (tipo !== filtroDoc) return false;
    }
    if (!busquedaHistorial) return true; 
    const t = busquedaHistorial.toLowerCase();
    return (c.empresa||'').toLowerCase().includes(t) || (c.ruc||'').toLowerCase().includes(t) || (c.numero_comprobante||'').toLowerCase().includes(t) || (c.total||'').toString().includes(t) || c.compra_items?.some(i => (i.nombre_original||'').toLowerCase().includes(t) || (i.productos?.nombre||'').toLowerCase().includes(t));
  })

  const exportarTXT = () => {
    let contenido = `HISTORIAL DE COMPRAS (DETALLADO)\nFiltro: ${filtroDoc} | Desde: ${desde} - Hasta: ${hasta}\n\n`;
    comprasFiltradasHistorial.forEach(c => { 
      contenido += `========================================================================\n`;
      contenido += `FECHA: ${c.fecha_compra} | TIPO: ${c.tipo_comprobante || 'Factura'} | PROVEEDOR: ${c.empresa}\n`;
      contenido += `RUC: ${c.ruc} | COMPROBANTE: ${c.numero_comprobante} | TOTAL PAGADO: S/ ${Number(c.total).toFixed(2)}\n`;
      contenido += `--- DETALLE DE PRODUCTOS ---\n`;
      if (c.compra_items && c.compra_items.length > 0) {
        c.compra_items.forEach(i => {
          const prodAlmacen = i.productos ? i.productos.nombre : 'PENDIENTE (NO VINCULADO)';
          contenido += `  • Cantidad: ${i.cantidad}\n`;
          contenido += `    Descripción Original: ${i.nombre_original}\n`;
          contenido += `    Almacén: ${prodAlmacen}\n`;
          contenido += `    Unitario: S/ ${Number(i.precio_unitario).toFixed(4)} | Subtotal: S/ ${Number(i.subtotal).toFixed(2)}\n\n`;
        });
      } else {
        contenido += `  (Sin productos registrados en este comprobante)\n\n`;
      }
    })
    const blob = new Blob([contenido], { type: 'text/plain' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'historial_compras_detallado.txt'; link.click();
  }

  const exportarCSV = () => {
    let contenido = `Fecha Compra,Tipo,Proveedor,RUC,Nro Comprobante,Total Compra,Cant,Descripcion Original Boleta,Producto en Almacen,Precio Unitario,Subtotal Producto\n`;
    comprasFiltradasHistorial.forEach(c => {
      if (c.compra_items && c.compra_items.length > 0) {
        c.compra_items.forEach(i => {
          const prodAlmacen = i.productos ? i.productos.nombre : 'Pendiente';
          contenido += `"${c.fecha_compra}","${c.tipo_comprobante || 'Factura'}","${c.empresa}","${c.ruc}","${c.numero_comprobante}",${Number(c.total).toFixed(2)},${i.cantidad},"${i.nombre_original}","${prodAlmacen}",${Number(i.precio_unitario).toFixed(4)},${Number(i.subtotal).toFixed(2)}\n`;
        });
      } else {
        contenido += `"${c.fecha_compra}","${c.tipo_comprobante || 'Factura'}","${c.empresa}","${c.ruc}","${c.numero_comprobante}",${Number(c.total).toFixed(2)},,,,,\n`;
      }
    });
    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'historial_compras_detallado.csv'; link.click();
  }

  const exportarPDF = () => {
    const doc = new jsPDF('landscape'); 
    doc.text(`Historial de Compras Detallado (${filtroDoc})`, 14, 15); 
    doc.setFontSize(10); 
    doc.text(`Desde: ${desde} - Hasta: ${hasta}`, 14, 22);
    
    const tableData = [];
    
    comprasFiltradasHistorial.forEach(c => {
      tableData.push([
        { 
          content: `COMPRA: ${c.fecha_compra} | ${c.tipo_comprobante || 'Factura'}: ${c.numero_comprobante} | PROVEEDOR: ${c.empresa} (RUC: ${c.ruc}) | TOTAL: S/ ${Number(c.total).toFixed(2)}`, 
          colSpan: 5, 
          styles: { fillColor: [230, 230, 230], fontStyle: 'bold', textColor: [0,0,0] } 
        }
      ]);

      if (c.compra_items && c.compra_items.length > 0) {
        c.compra_items.forEach(i => {
          const prodAlmacen = i.productos ? i.productos.nombre : 'Pendiente (No vinculado)';
          tableData.push([
            i.cantidad.toString(),
            i.nombre_original,
            prodAlmacen,
            `S/ ${Number(i.precio_unitario).toFixed(4)}`,
            `S/ ${Number(i.subtotal).toFixed(2)}`
          ]);
        });
      }
    });

    doc.autoTable({ 
      head: [['Cant', 'Descripción Original (Boleta)', 'Vinculado a Almacén', 'P. Unitario', 'Subtotal']], 
      body: tableData, 
      startY: 28,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [41, 128, 185] },
      columnStyles: {
        0: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 25, halign: 'right' },
        4: { cellWidth: 25, halign: 'right' }
      }
    });
    
    doc.save('historial_compras_detallado.pdf');
  }

  // Cálculos Análisis basados en filtroDoc
  let gastoTotal = 0; let productosComprados = 0; const productosStats = {}; const comprasPorDia = {};
  
  comprasFiltradasHistorial.forEach(c => {
    const dia = c.fecha_compra;
    if (!comprasPorDia[dia]) comprasPorDia[dia] = 0;
    comprasPorDia[dia] += Number(c.total);

    c.compra_items?.forEach(i => {
      const p = i.productos 
      if (p) {
        if (busquedaAnalisis && !p.nombre.toLowerCase().includes(busquedaAnalisis.toLowerCase())) return;
        const cant = Number(i.cantidad||0); 
        
        if (cant === 0) return; 

        const gasto = cant * Number(i.precio_unitario); 
        productosComprados += cant; 
        gastoTotal += gasto;

        if (!productosStats[i.producto_id]) productosStats[i.producto_id] = { id: i.producto_id, nombre: p.nombre, cantidad: 0, gasto: 0 }; 
        productosStats[i.producto_id].cantidad += cant; 
        productosStats[i.producto_id].gasto += gasto;
      }
    })
  })
  const dias = Math.max(1, Math.ceil((new Date(hasta+'T23:59:59') - new Date(desde+'T00:00:00')) / 86400000)); const promedioGastoDiario = gastoTotal / dias;
  const statsArray = Object.values(productosStats).map(p => ({ ...p, costoPromedio: p.cantidad > 0 ? (p.gasto / p.cantidad) : 0 }))
  
  const chartDiasData = Object.keys(comprasPorDia).map(k => ({ Fecha: k, Inversión: parseFloat(comprasPorDia[k].toFixed(2)) })).sort((a,b) => a.Fecha.localeCompare(b.Fecha));
  const chartData = statsArray.sort((a, b) => b.gasto - a.gasto).slice(0, 10).map(p => ({ name: p.nombre.substring(0, 15) + '...', Inversión: parseFloat(p.gasto.toFixed(2)), Unidades: p.cantidad }))
  const topComprados = [...statsArray].sort((a, b) => b.cantidad - a.cantidad).slice(0, 5); 
  const menosComprados = [...statsArray].sort((a, b) => a.cantidad - b.cantidad).slice(0, 5); 
  
  const compraActiva = comprasHistorial.find(c => c.id === compraExpandida)

  // LOGICA PARA MOSTRAR/OCULTAR SUBSANAR SEGÚN FECHA
  const fechaCompraActiva = compraActiva ? new Date(compraActiva.fecha_compra) : new Date();
  const fechaHace3MesesActiva = new Date(); fechaHace3MesesActiva.setMonth(fechaHace3MesesActiva.getMonth() - 3);
  const esActivaAntigua = fechaCompraActiva < fechaHace3MesesActiva;

  return (
    <div>
      <style>{estilosImpresion}</style>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800 }}>Gestión de Compras<span style={{ color: 'var(--naranja)' }}>.</span></h1>
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('registro')} className={tabActual === 'registro' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><UploadCloud size={16} /> Registro / Cola</button>
          <button onClick={() => setTabActual('historial')} className={tabActual === 'historial' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><FileText size={16} /> Historial</button>
          <button onClick={() => setTabActual('analisis')} className={tabActual === 'analisis' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px' }}><BarChart3 size={16} /> Análisis</button>
        </div>
      </div>

      {/* -------------------- TAB REGISTRO / BANDEJA DE COLA -------------------- */}
      {tabActual === 'registro' && (
        <div className="no-print" style={{ display: 'grid', gridTemplateColumns: modoIngreso === 'ia' ? '1fr 1fr' : '1fr', gap: 20, minHeight: 'calc(100vh - 120px)' }}>
          {!modoIngreso && (
            <div style={{ display: 'flex', gap: 20, justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Bandeja de Subida (Arrastra o Selecciona)</h2>
              <div style={{ display: 'flex', gap: 20 }}>
                <div 
                  className="card" 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload').click()}
                  style={{ 
                    width: 300, textAlign: 'center', cursor: 'pointer', padding: 40, 
                    border: isDragging ? '2px dashed var(--naranja)' : '2px dashed transparent',
                    background: isDragging ? '#f59e0b10' : 'var(--fondo)'
                  }}>
                   <UploadCloud size={48} style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Escanear Comprobantes</h3>
                   <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Arrastra tus PDFs aquí o haz clic para seleccionar archivos desde tu PC o Drive.</p>
                   <input id="file-upload" type="file" multiple accept="application/pdf,image/*" style={{ display: 'none' }} onChange={handleSubirVariosPDF} />
                </div>
                <div className="card" style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40, border: '2px dashed transparent' }} onClick={iniciarModoManual}>
                   <Edit3 size={48} style={{ margin: '0 auto 16px', color: '#10b981' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Ingreso Manual Único</h3>
                </div>
              </div>
            </div>
          )}

          {modoIngreso === 'ia' && (
            <div style={{ position: 'sticky', top: 20, height: 'calc(100vh - 40px)', display: 'flex', flexDirection: 'column' }}>
              <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>
                    {colaArchivos.length > 1 ? `En cola: ${indiceCola + 1} de ${colaArchivos.length}` : 'Documento Adjunto'}
                  </h3>
                  <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Cancelar Todo</button>
                </div>
                <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pdfUrl ? <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="Vista" /> : <p style={{ color: '#fff', fontSize: 12 }}>Vista previa no disponible</p>}
                </div>
              </div>
            </div>
          )}

          {modoIngreso && (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: modoIngreso === 'manual' ? '0 auto' : 0, maxWidth: modoIngreso === 'manual' ? 700 : '100%', width: '100%' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Formulario {colaArchivos.length > 1 ? '(Lote a Verificar)' : 'Autoguardado'} {procesandoPdf && <span className="spinner" style={{ width: 14, height: 14 }} />}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  {colaArchivos.length > 1 && indiceCola + 1 < colaArchivos.length && (
                    <button onClick={saltarAlSiguienteDocumento} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <SkipForward size={14}/> Saltar este doc
                    </button>
                  )}
                  <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ArrowLeft size={14}/> Cancelar / Volver
                  </button>
                </div>
              </div>

              <div style={{ flex: 1, padding: 20 }}>
                {procesandoPdf ? ( <div style={{ textAlign: 'center', padding: '40px 0' }}><RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} /><p>Analizando e Identificando Documento...</p></div> ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: '#3b82f615', padding: 12, borderRadius: 8, border: '1px dashed #3b82f6' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><ExternalLink size={16} /> Enlace de Google Drive (Obligatorio)</label>
                      <input type="url" placeholder="https://drive.google.com/file/d/..." value={datosFactura.enlace_drive} onChange={e => cambiarDatoFactura('enlace_drive', e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 12px', border: '1px solid #3b82f655', borderRadius: 4 }} required />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                      <div><label style={{ fontSize: 11, fontWeight: 600 }}>RUC</label><input type="text" value={datosFactura.ruc} onChange={e => cambiarDatoFactura('ruc', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Tipo Comprobante</label>
                        <select value={datosFactura.tipo_comprobante} onChange={e => cambiarDatoFactura('tipo_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
                          <option value="Factura">Factura</option>
                          <option value="Boleta">Boleta</option>
                          <option value="Otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600 }}>Fecha</label>
                        <input type="date" value={datosFactura.fecha} onChange={e => cambiarDatoFactura('fecha', e.target.value)} style={{ width: '100%', fontSize: 13, color: esAntiguo ? '#6b7280' : 'inherit' }} />
                        {esAntiguo && <p style={{ fontSize: 10, color: 'var(--texto-suave)', marginTop: 4 }}>+3 meses (Registro Histórico)</p>}
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>Proveedor / Empresa</label><input type="text" value={datosFactura.proveedor} onChange={e => cambiarDatoFactura('proveedor', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                      <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>N° Boleta/Factura</label><input type="text" value={datosFactura.numero_comprobante} onChange={e => cambiarDatoFactura('numero_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                      <h4 style={{ fontSize: 13, fontWeight: 700 }}>Relación con Almacén</h4>
                      {modoIngreso === 'manual' && <button onClick={agregarFilaManual} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#10b981' }}><Plus size={14} /> Fila</button>}
                    </div>
                      
                    {datosFactura.items.map((item) => {
                      const qty = Number(item.cantidad) || 0;
                      const unitarioDerivado = qty > 0 ? (Number(item.precio_total_linea) / qty).toFixed(4) : '0.0000';
                      
                      return (
                      <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: item.estado === 'vinculado' ? '#10b98108' : '#f59e0b08', position: 'relative' }}>
                        {modoIngreso === 'manual' && datosFactura.items.length > 1 && <button onClick={() => quitarFila(item.id_temp)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#D00', cursor: 'pointer', fontSize: 12 }}>X</button>}
                        <div style={{ marginBottom: 12 }}>
                           <label style={{ fontSize: 10, color: 'var(--texto-suave)' }}>Descripción Original (Boleta):</label>
                           <input type="text" value={item.nombreOriginal} onChange={e => cambiarDatoItem(item.id_temp, 'nombreOriginal', e.target.value)} style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '4px 8px', border: '1px solid var(--borde)', borderRadius: 4 }} placeholder="Ejem: ACEITE PRIMOR 1L" />
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <BuscadorProductos item={item} productosDB={productosDB} onSelect={(id) => emparejarProducto(item.id_temp, id)} />
                          {item.estado === 'vinculado' ? <CheckCircle size={20} color="#10b981" style={{ minWidth: 20 }} /> : <AlertCircle size={18} color={esAntiguo ? "#9ca3af" : "#f59e0b"} />}
                        </div>
                        
                        {item.estado === 'pendiente' && esAntiguo && (
                          <div style={{ padding: '4px 8px', background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 600, borderRadius: 4, marginBottom: 8 }}>
                            ℹ️ Comprobante antiguo (+3 meses). Se guardará como histórico sin afectar stock actual.
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Cantidad (Pon 0 si no se cuenta)</label><input type="number" value={item.cantidad} onChange={e => cambiarDatoItem(item.id_temp, 'cantidad', e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--texto-suave)' }}>Suma en Boleta (S/)</label><input type="number" step="any" value={item.precio_total_linea} onChange={e => cambiarDatoItem(item.id_temp, 'precio_total_linea', e.target.value)} style={{ width: '100%', fontSize: 12 }} /></div>
                        </div>
                        <div style={{ marginTop: 8, textAlign: 'right' }}><span style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Unitario Base: <b>S/ {unitarioDerivado}</b></span></div>
                      </div>
                    )})}
                    <div style={{ background: 'var(--fondo)', padding: 16, borderRadius: 8, border: '1px solid var(--borde)', marginTop: 8 }}>
                      <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--texto-suave)' }}>Desglose de Totales</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>Suma Subtotales</label><input type="number" step="any" value={datosFactura.subtotal} readOnly style={{ width: '100%', fontSize: 13, background: '#f3f4f6', cursor: 'not-allowed' }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>IGV (S/)</label><input type="number" step="any" value={datosFactura.igv} onChange={e => cambiarDatoFactura('igv', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 600 }}>Otros Cargos (Envíos)</label><input type="number" step="any" value={datosFactura.otros_cargos} onChange={e => cambiarDatoFactura('otros_cargos', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                        <div><label style={{ fontSize: 11, fontWeight: 800, color: 'var(--naranja)' }}>TOTAL FINAL (S/)</label><input type="number" step="any" value={datosFactura.total} onChange={e => cambiarDatoFactura('total', e.target.value)} style={{ width: '100%', fontSize: 14, fontWeight: 700, color: 'var(--naranja)', border: '1px solid var(--naranja)' }} /></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid var(--borde)' }}>
                {/* BOTON GUARDAR YA NO SE BLOQUEA POR PENDIENTES */}
                <button onClick={guardarCompra} disabled={procesandoPdf || datosFactura.items.length === 0} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <ListChecks size={18} style={{ marginRight: 8 }}/> Guardar Registro {colaArchivos.length > 1 ? `y Pasar al Siguiente` : ``}
                </button>
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
              <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                 <select value={filtroDoc} onChange={e => setFiltroDoc(e.target.value)} style={{ padding: '4px 8px', fontSize: 11, borderRadius: 4, border: '1px solid var(--borde)' }}>
                    <option value="Todos">Todos (Factura y Boleta)</option>
                    <option value="Factura">Solo Facturas</option>
                    <option value="Boleta">Solo Boletas</option>
                 </select>
                 <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}><Download size={14}/> CSV</button>
                 <button onClick={exportarTXT} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={14}/> TXT</button>
                 <button onClick={exportarPDF} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4, color: '#D00' }}><Printer size={14}/> Listado PDF</button>
              </div>
            </div>

            {cargando ? <div className="spinner" style={{ margin: '40px auto' }} /> : comprasFiltradasHistorial.length === 0 ? ( <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>Sin resultados.</div> ) : (
              comprasFiltradasHistorial.map(c => (
                <div key={c.id} onClick={() => setCompraExpandida(c.id)} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: compraExpandida === c.id ? '2px solid var(--naranja)' : '1px solid transparent', background: compraExpandida === c.id ? 'var(--fondo)' : '#fff' }}>
                  <div><h3 style={{ fontSize: 14, fontWeight: 700, color: compraExpandida === c.id ? 'var(--naranja)' : 'inherit' }}>{c.empresa}</h3><p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>{c.fecha_compra} | {c.tipo_comprobante || 'Factura'}: {c.numero_comprobante || 'S/N'}</p></div>
                  <div style={{ textAlign: 'right' }}><p style={{ fontSize: 16, fontWeight: 800, color: '#D00' }}>S/ {Number(c.total).toFixed(2)}</p></div>
                </div>
              ))
            )}
          </div>
          
          <div style={{ flex: '1 1 50%', position: 'sticky', top: 20 }}>
            {compraActiva ? (
              <div id="zona-impresion" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 32, fontFamily: '"Courier New", Courier, monospace', border: '1px solid #e5e7eb', position: 'relative' }}>
                <div className="no-print" style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                   <button onClick={() => eliminarCompra(compraActiva.id)} className="btn-ghost" title="Eliminar Registro Completamente" style={{ padding: 8, color: '#ef4444', border: '1px solid #fee2e2', background: '#fef2f2' }}><Trash2 size={16} /></button>
                   <button onClick={() => abrirEdicion(compraActiva)} className="btn-ghost" title="Editar Comprobante" style={{ padding: 8, color: '#f59e0b', border: '1px solid #fef3c7', background: '#fffbeb' }}><Edit3 size={16} /></button>
                   <button onClick={() => setOcultarAlmacen(!ocultarAlmacen)} className="btn-ghost" title="Ocultar/Mostrar vinculación de Almacén" style={{ padding: 8 }}>{ocultarAlmacen ? <EyeOff size={16} color="var(--texto-suave)" /> : <Eye size={16} color="#3b82f6" />}</button>
                   <button onClick={() => window.print()} className="btn-primary" style={{ padding: 8, background: '#111827', color: '#fff' }}><Printer size={16} /> Imprimir Doc.</button>
                </div>
                <div style={{ textAlign: 'center', borderBottom: '2px dashed #d1d5db', paddingBottom: 20, marginBottom: 20 }}><Receipt size={40} style={{ margin: '0 auto 10px', color: '#4b5563' }} className="no-print" /><h2 style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', margin: 0 }}>Comprobante Digital</h2><p style={{ fontSize: 12, color: '#6b7280', margin: '4px 0 0' }}>SISTEMA DE GESTIÓN DE INVENTARIO</p></div>
                <div style={{ marginBottom: 24, fontSize: 13, lineHeight: '1.6' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>PROVEEDOR:</b> <span>{compraActiva.empresa}</span></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>RUC:</b> <span>{compraActiva.ruc}</span></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>TIPO Y N° COMPROBANTE:</b> <span>{compraActiva.tipo_comprobante || 'Factura'} {compraActiva.numero_comprobante}</span></div><div style={{ display: 'flex', justifyContent: 'space-between' }}><b>FECHA:</b> <span>{compraActiva.fecha_compra}</span></div></div>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse', marginBottom: 16 }}>
                  <thead><tr style={{ borderBottom: '1px dashed #d1d5db' }}><th style={{ textAlign: 'left', padding: '8px 0' }}>CANT</th><th style={{ textAlign: 'left', padding: '8px 0' }}>DESCRIPCIÓN</th><th style={{ textAlign: 'right', padding: '8px 0' }}>COSTO</th></tr></thead>
                  <tbody>
                    {compraActiva.compra_items.map((item, idx) => (
                      <tr key={item.id} style={{ borderBottom: '1px dashed #f3f4f6' }}>
                        <td style={{ padding: '8px 0', verticalAlign: 'top' }}>{item.cantidad}</td>
                        <td style={{ padding: '8px 4px' }}>
                          <div style={{ fontWeight: 700 }}>{item.nombre_original || 'Sin descripción'}</div>
                          
                          {!ocultarAlmacen && item.productos && (<div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 600, marginTop: 2 }}>↳ Almacén: {item.productos.nombre}</div>)}
                          
                          {/* SUBSANAR PENDIENTES DESDE EL HISTORIAL (SÓLO SI NO ES MUY ANTIGUO) */}
                          {!ocultarAlmacen && !item.productos && !esActivaAntigua && (
                            <div className="no-print" style={{ marginTop: 6, background: '#fef3c7', padding: '6px', borderRadius: '4px', border: '1px dashed #f59e0b' }}>
                              <p style={{ fontSize: 10, color: '#d97706', fontWeight: 700, marginBottom: 4 }}>⚠️ Producto Pendiente (Subsanar):</p>
                              <BuscadorProductos item={{ producto_db_id: null }} productosDB={productosDB} placeholder="Buscar y vincular..." onSelect={(id) => subsanarPendiente(compraActiva.id, item.id, id, item.cantidad)} />
                            </div>
                          )}
                          {!ocultarAlmacen && !item.productos && esActivaAntigua && (
                            <div className="no-print" style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>↳ Histórico: Sin vincular</div>
                          )}
                          {!ocultarAlmacen && !item.productos && <div className="solo-print" style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>↳ {esActivaAntigua ? 'Histórico: Sin vincular' : 'Almacén: Pendiente'}</div>}
                          
                          <div style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400, marginTop: 2 }}>Unit. Real: S/ {Number(item.precio_unitario).toFixed(4)}</div>
                        </td>
                        <td style={{ padding: '8px 0', textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>S/ {Number(item.subtotal).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ borderTop: '1px dashed #d1d5db', paddingTop: 16, fontSize: 12 }}><div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 4 }}><span>SUBTOTAL:</span> <span>S/ {Number(compraActiva.subtotal||0).toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 4 }}><span>IGV:</span> <span>S/ {Number(compraActiva.igv||0).toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280', marginBottom: 8 }}><span>OTROS:</span> <span>S/ {Number(compraActiva.otros_cargos||0).toFixed(2)}</span></div><div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, borderTop: '2px solid #000', paddingTop: 8 }}><span>TOTAL PAGADO:</span><span>S/ {Number(compraActiva.total).toFixed(2)}</span></div></div>
                {compraActiva.enlace_drive && (<div className="no-print" style={{ marginTop: 30, textAlign: 'center' }}><a href={compraActiva.enlace_drive} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}><ExternalLink size={16} /> Ver PDF Original</a></div>)}
              </div>
            ) : (<div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--texto-suave)', border: '2px dashed var(--borde)', borderRadius: 12 }}><Receipt size={48} style={{ opacity: 0.3, marginBottom: 16 }} /><p>Selecciona un registro</p></div>)}
          </div>
        </div>
      )}

      {/* -------------------- TAB ANÁLISIS -------------------- */}
      {tabActual === 'analisis' && (
        <div className="analisis-container no-print">
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 250, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--texto-suave)' }} />
              <input type="text" placeholder="🔍 Filtrar métricas por producto..." value={busquedaAnalisis} onChange={(e) => setBusquedaAnalisis(e.target.value)} style={{ width: '100%', padding: '8px 12px 8px 36px', fontSize: 13, borderRadius: 8, border: '1px solid var(--borde)' }} />
            </div>
            <select value={filtroDoc} onChange={e => setFiltroDoc(e.target.value)} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--borde)' }}>
              <option value="Todos">Todos (Factura y Boleta)</option>
              <option value="Factura">Solo Facturas</option>
              <option value="Boleta">Solo Boletas</option>
            </select>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} color="var(--texto-suave)" /><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} /><span>-</span><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} /></div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #D00' }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Total Invertido</p><h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#D00' }}>S/ {gastoTotal.toFixed(2)}</h3></div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #3b82f6' }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Unidades Compradas</p><h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{productosComprados}</h3></div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid var(--naranja)' }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Productos Distintos</p><h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: 'var(--naranja)' }}>{statsArray.length}</h3></div>
            <div className="card" style={{ padding: 20 }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Gasto Diario Promedio</p><h3 style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>S/ {promedioGastoDiario.toFixed(2)}</h3></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Inversión por Día (S/)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDiasData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
                    <XAxis dataKey="Fecha" fontSize={11} tickMargin={10} />
                    <YAxis fontSize={11} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="Inversión" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Top 10 Productos (Mayor Inversión)</h3>
              <div style={{ height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
                    <XAxis type="number" fontSize={11} />
                    <YAxis dataKey="name" type="category" width={120} fontSize={10} />
                    <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="Inversión" fill="#D00" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: 'var(--naranja)' }}>🔥 Productos Más Comprados (Unidades)</h3>
              {topComprados.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span><span style={{ fontSize: 13, fontWeight: 700 }}>{p.cantidad} unid.</span>
                </div>
              ))}
            </div>
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🧊 Productos Menos Comprados</h3>
              {menosComprados.map((p, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--borde)' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{p.nombre}</span><span style={{ fontSize: 13, fontWeight: 700, color: 'var(--texto-suave)' }}>{p.cantidad} unid.</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16 }}>Análisis de Costos y Precios Sugeridos</h3>
            <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 16 }}>Comparación del Costo Promedio de Compra, el Precio de Venta actual registrado en Sistema, y un Precio Sugerido (Costo + 30% de margen).</p>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--borde)' }}>
                    <th style={{ padding: '12px 8px' }}>Producto (Almacén)</th>
                    <th style={{ padding: '12px 8px' }}>Costo Prom. Compra</th>
                    <th style={{ padding: '12px 8px' }}>Precio Venta (Actual)</th>
                    <th style={{ padding: '12px 8px', color: '#10b981' }}>Precio Sugerido (+30%)</th>
                  </tr>
                </thead>
                <tbody>
                  {statsArray.sort((a, b) => b.gasto - a.gasto).map(p => {
                    const prodAlmacen = productosDB.find(x => x.id === p.id);
                    const precioVenta = prodAlmacen ? Number(prodAlmacen.precio || 0) : 0;
                    const precioSugerido = p.costoPromedio * 1.30;
                    const necesitaSubir = precioVenta < precioSugerido;

                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid var(--borde)', background: necesitaSubir ? '#fef2f2' : 'transparent' }}>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{p.nombre}</td>
                        <td style={{ padding: '12px 8px' }}>S/ {p.costoPromedio.toFixed(2)}</td>
                        <td style={{ padding: '12px 8px', color: necesitaSubir ? '#D00' : 'inherit', fontWeight: necesitaSubir ? 700 : 400 }}>
                          S/ {precioVenta.toFixed(2)}
                        </td>
                        <td style={{ padding: '12px 8px', fontWeight: 800, color: '#10b981' }}>
                          S/ {precioSugerido.toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL DE EDICIÓN FLOTANTE -------------------- */}
      {modalEdicion && datosEdicion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--borde)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--fondo)', zIndex: 10 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}><Edit3 size={20} color="#f59e0b"/> Editando Comprobante</h2>
              <button onClick={() => setModalEdicion(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} color="var(--texto-suave)" /></button>
            </div>
            
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ background: '#3b82f615', padding: 12, borderRadius: 8, border: '1px dashed #3b82f6' }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}><ExternalLink size={16} /> Enlace de Google Drive</label>
                <input type="url" value={datosEdicion.enlace_drive} onChange={e => cambiarDatoEdicion('enlace_drive', e.target.value)} style={{ width: '100%', fontSize: 13, padding: '8px 12px', border: '1px solid #3b82f655', borderRadius: 4 }} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><label style={{ fontSize: 11, fontWeight: 600 }}>RUC</label><input type="text" value={datosEdicion.ruc} onChange={e => cambiarDatoEdicion('ruc', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Tipo Comprobante</label>
                  <select value={datosEdicion.tipo_comprobante} onChange={e => cambiarDatoEdicion('tipo_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }}>
                    <option value="Factura">Factura</option>
                    <option value="Boleta">Boleta</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600 }}>Fecha</label>
                  <input type="date" value={datosEdicion.fecha} onChange={e => cambiarDatoEdicion('fecha', e.target.value)} style={{ width: '100%', fontSize: 13 }} />
                  {new Date(datosEdicion.fecha) < fechaHace3Meses && <p style={{ fontSize: 10, color: 'var(--texto-suave)', marginTop: 4 }}>+3 meses (Registro Histórico)</p>}
                </div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>Proveedor / Empresa</label><input type="text" value={datosEdicion.proveedor} onChange={e => cambiarDatoEdicion('proveedor', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                <div style={{ gridColumn: '1 / -1' }}><label style={{ fontSize: 11, fontWeight: 600 }}>N° Boleta/Factura</label><input type="text" value={datosEdicion.numero_comprobante} onChange={e => cambiarDatoEdicion('numero_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700 }}>Relación con Almacén</h4>
                <button onClick={agregarFilaEdicion} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#10b981' }}><Plus size={14} /> Añadir Fila</button>
              </div>
                
              {datosEdicion.items.map((item) => {
                const qtyEdicion = Number(item.cantidad) || 0;
                return (
                <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: item.estado === 'vinculado' ? '#10b98108' : '#f59e0b08', position: 'relative' }}>
                  {datosEdicion.items.length > 1 && <button onClick={() => quitarFilaEdicion(item.id_temp)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: '#D00', cursor: 'pointer', fontSize: 12 }}>X</button>}
                  <div style={{ marginBottom: 12 }}>
                     <label style={{ fontSize: 10, color: 'var(--texto-suave)' }}>Descripción Original (Boleta):</label>
                     <input type="text" value={item.nombreOriginal} onChange={e => cambiarDatoItemEdicion(item.id_temp, 'nombreOriginal', e.target.value)} style={{ width: '100%', fontSize: 13, fontWeight: 600, padding: '4px 8px', border: '1px solid var(--borde)', borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                    <BuscadorProductos item={item} productosDB={productosDB} placeholder="Re-seleccionar y vincular producto..." onSelect={(id) => emparejarProductoEdicion(item.id_temp, id)} />
                    {item.estado === 'vinculado' ? <CheckCircle size={20} color="#10b981" style={{ minWidth: 20 }} /> : <AlertCircle size={18} color="#f59e0b" />}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Cantidad (Pon 0 si no se cuenta)</label><input type="number" value={item.cantidad} onChange={e => cambiarDatoItemEdicion(item.id_temp, 'cantidad', e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} /></div>
                    <div style={{ flex: 1 }}><label style={{ fontSize: 10, fontWeight: 700, color: 'var(--texto-suave)' }}>Suma en Boleta (S/)</label><input type="number" step="any" value={item.precio_total_linea} onChange={e => cambiarDatoItemEdicion(item.id_temp, 'precio_total_linea', e.target.value)} style={{ width: '100%', fontSize: 12 }} /></div>
                  </div>
                </div>
              )})}
              
              <div style={{ background: 'var(--fondo)', padding: 16, borderRadius: 8, border: '1px solid var(--borde)', marginTop: 8 }}>
                <h4 style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: 'var(--texto-suave)' }}>Desglose de Totales</h4>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div><label style={{ fontSize: 11, fontWeight: 600 }}>Suma Subtotales</label><input type="number" step="any" value={datosEdicion.subtotal} readOnly style={{ width: '100%', fontSize: 13, background: '#f3f4f6', cursor: 'not-allowed' }} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 600 }}>IGV (S/)</label><input type="number" step="any" value={datosEdicion.igv} onChange={e => cambiarDatoEdicion('igv', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 600 }}>Otros Cargos</label><input type="number" step="any" value={datosEdicion.otros_cargos} onChange={e => cambiarDatoEdicion('otros_cargos', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                  <div><label style={{ fontSize: 11, fontWeight: 800, color: 'var(--naranja)' }}>TOTAL FINAL (S/)</label><input type="number" step="any" value={datosEdicion.total} onChange={e => cambiarDatoEdicion('total', e.target.value)} style={{ width: '100%', fontSize: 14, fontWeight: 700, color: 'var(--naranja)', border: '1px solid var(--naranja)' }} /></div>
                </div>
              </div>
            </div>
            
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--borde)', background: 'var(--fondo)', position: 'sticky', bottom: 0, zIndex: 10, display: 'flex', gap: 12 }}>
               <button onClick={() => setModalEdicion(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
               <button onClick={guardarEdicion} disabled={cargando || datosEdicion.items.length === 0} className="btn-primary" style={{ flex: 2, justifyContent: 'center', background: '#f59e0b' }}>
                  {cargando ? 'Guardando...' : <><Save size={16} /> Guardar Cambios en Stock y Sistema</>}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
