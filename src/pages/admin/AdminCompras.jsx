import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useTienda } from '../../store'
import Paginador from '../../components/Paginador'
import { 
  UploadCloud, FileText, CheckCircle, AlertCircle, 
  BarChart3, Calendar, Package, ShoppingCart, RefreshCw, 
  Plus, Edit3, Search, ExternalLink, Receipt, Printer, EyeOff, Eye, Trash2, Download, ListChecks, SkipForward, ArrowLeft, X, Save, Cpu, Key, Users, Mail, Phone, Globe
} from 'lucide-react'
import toast from 'react-hot-toast'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

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
  @keyframes parpadeo {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
  .alerta-duplicado {
    animation: parpadeo 2s infinite;
  }
`;

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
  const { tiendaActual } = useTienda()
  const esMiller = tiendaActual === 'miller'

  const [tabActual, setTabActual] = useState('registro')
  const [cargando, setCargando] = useState(false)
  
  const [productosDB, setProductosDB] = useState([])
  const [comprasHistorial, setComprasHistorial] = useState([])
  
  // Paginador (50 por defecto)
  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsPorPagina, setItemsPorPagina] = useState(50)

  // Estados Registro y Lotes (Richard Express)
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

  // Estado para Compra de Cuentas Madre / Servicios en Miller Digital
  const [formServicio, setFormServicio] = useState({
    producto_servicio_id: '',
    servicio_nombre: '',
    proveedor: '',
    proveedor_whatsapp: '',
    cuenta_correo: '',
    plataforma_compra: 'WhatsApp',
    costo_total: '',
    cupos_totales: 50,
    duracion_meses: 12,
    fecha_compra: new Date().toISOString().split('T')[0],
    fecha_vencimiento: ''
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
    if (formServicio.fecha_compra && formServicio.duracion_meses) {
      const f = new Date(formServicio.fecha_compra + 'T12:00:00')
      f.setMonth(f.getMonth() + Number(formServicio.duracion_meses))
      setFormServicio(prev => ({ ...prev, fecha_vencimiento: f.toISOString().split('T')[0] }))
    }
  }, [formServicio.fecha_compra, formServicio.duracion_meses])

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

  useEffect(() => {
    setPaginaActual(1)
    cargarProductos()
    cargarHistorial()
  }, [desde, hasta, tiendaActual])

  async function cargarProductos() {
    const { data } = await supabase.from('productos').select('*').order('nombre')
    setProductosDB((data || []).filter(p => (p.tienda || 'richard') === tiendaActual))
  }

  async function cargarHistorial() {
    setCargando(true)
    const { data } = await supabase
      .from('compras')
      .select('*, compra_items(*, productos(*))')
      .gte('fecha_compra', desde + 'T00:00:00')
      .lte('fecha_compra', hasta + 'T23:59:59')
      .order('fecha_compra', { ascending: false })
    setComprasHistorial((data || []).filter(c => (c.tienda || 'richard') === tiendaActual))
    setCargando(false)
  }

  // GUARDAR COMPRA DE SERVICIO / CUENTA MADRE (MILLER DIGITAL)
  const guardarCompraMiller = async () => {
    if (!formServicio.producto_servicio_id && !formServicio.servicio_nombre.trim()) {
      return toast.error('Selecciona o escribe el nombre del servicio comprado')
    }
    if (!formServicio.proveedor.trim()) return toast.error('Ingresa el nombre del proveedor')
    if (!formServicio.cuenta_correo.trim()) return toast.error('Ingresa el correo de la cuenta/equipo adquirido')

    setCargando(true)
    try {
      const prodVinculado = productosDB.find(p => p.id === formServicio.producto_servicio_id)
      const nombreServ = prodVinculado ? prodVinculado.nombre : formServicio.servicio_nombre
      const costo = Number(formServicio.costo_total) || 0
      const cupos = Number(formServicio.cupos_totales) || 1

      const { data: compraData, error: errC } = await supabase.from('compras').insert({
        tienda: 'miller',
        empresa: formServicio.proveedor,
        ruc: formServicio.proveedor_whatsapp || 'S/N',
        tipo_comprobante: 'Cuenta Digital',
        numero_comprobante: formServicio.cuenta_correo,
        fecha_compra: formServicio.fecha_compra,
        subtotal: costo,
        igv: 0,
        otros_cargos: 0,
        total: costo,
        servicio_nombre: nombreServ,
        producto_servicio_id: prodVinculado ? prodVinculado.id : null,
        proveedor_whatsapp: formServicio.proveedor_whatsapp,
        cuenta_correo: formServicio.cuenta_correo,
        plataforma_compra: formServicio.plataforma_compra,
        cupos_totales: cupos,
        cupos_usados: 0,
        duracion_meses: Number(formServicio.duracion_meses),
        fecha_vencimiento: formServicio.fecha_vencimiento
      }).select().single()

      if (errC) throw errC

      await supabase.from('compra_items').insert({
        compra_id: compraData.id,
        producto_id: prodVinculado ? prodVinculado.id : null,
        nombre_original: `${nombreServ} (${formServicio.cuenta_correo}) - ${cupos} cupos`,
        cantidad: cupos,
        precio_unitario: cupos > 0 ? costo / cupos : costo,
        subtotal: costo
      })

      if (prodVinculado) {
        await supabase.from('productos').update({
          stock: Number(prodVinculado.stock || 0) + cupos
        }).eq('id', prodVinculado.id)
      }

      toast.success(`¡Cuenta Madre registrada! +${cupos} cupos sumados al stock 🚀`)
      const hoy = new Date().toISOString().split('T')[0]
      const venc = new Date(); venc.setMonth(venc.getMonth() + 12)
      setFormServicio({
        producto_servicio_id: '', servicio_nombre: '', proveedor: '', proveedor_whatsapp: '',
        cuenta_correo: '', plataforma_compra: 'WhatsApp', costo_total: '', cupos_totales: 50,
        duracion_meses: 12, fecha_compra: hoy, fecha_vencimiento: venc.toISOString().split('T')[0]
      })
      cargarHistorial()
      cargarProductos()
      setTabActual('historial')
    } catch (e) {
      toast.error('Error al guardar servicio: ' + e.message)
    }
    setCargando(false)
  }

  // --- LÓGICA DRAG & DROP Y PDF (RICHARD EXPRESS) ---
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
      if (!apiKey) throw new Error('No API Key configurada.')

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      const prompt = `Analiza detenidamente este comprobante. REGLAS: 1. Convierte docenas a unidades. 2. Extrae PRECIO TOTAL PAGADO POR LÍNEA. Extrae JSON plano sin formato markdown extra: {"proveedor": "Nombre", "ruc": "RUC", "tipo_comprobante": "Factura o Boleta", "numero_comprobante": "Serie-Corr", "fecha": "YYYY-MM-DD", "subtotal": 0, "igv": 0, "otros_cargos": 0, "total": 0, "items": [{"nombreOriginal": "Desc exacta del recibo", "cantidad": 1, "precio_total_linea": 0}]}`

      const requestConfig = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Pdf } }, { text: prompt }] }] })
      };

      let response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, requestConfig);

      if (!response.ok) {
        if (response.status === 429) throw new Error("⏳ Límite de Google superado. Espera 20 segundos.");
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`, requestConfig);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Código HTTP: ${response.status}`);
      }

      const data = await response.json()
      const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const jsonLimpio = textoRespuesta.replace(/```json/gi, '').replace(/```/g, '').trim();
      let resultado = JSON.parse(jsonLimpio);

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
      toast.success('Documento analizado listo para verificar.')
    } catch (error) { toast.error('Error IA: ' + error.message, { duration: 6000 }) } finally { setProcesandoPdf(false) }
  }

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

  const fechaFactura = new Date(datosFactura.fecha); 
  const fechaHace3Meses = new Date(); fechaHace3Meses.setMonth(fechaHace3Meses.getMonth() - 3);
  const esAntiguo = fechaFactura < fechaHace3Meses; 

  const esDuplicadoActual = datosFactura.ruc && datosFactura.ruc.trim() !== '' && 
                            datosFactura.numero_comprobante && datosFactura.numero_comprobante.trim() !== '' && 
                            datosFactura.numero_comprobante !== 'S/N' && 
                            comprasHistorial.some(c => c.ruc === datosFactura.ruc && c.numero_comprobante === datosFactura.numero_comprobante);

  const guardarCompra = async () => {
    if (!datosFactura.proveedor) return toast.error('Falta proveedor')
    if (esDuplicadoActual) {
       if(!window.confirm('ADVERTENCIA: Ya existe una boleta registrada con ese mismo RUC y Número. ¿Estás seguro de registrarla de nuevo?')) return;
    }

    setCargando(true)
    try {
      const payloadCompra = { 
        tienda: 'richard',
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
    if (!window.confirm('¿ELIMINAR esta compra? Se restarán los productos y se borrará del historial.')) return;
    setCargando(true);
    try {
      const c = comprasHistorial.find(x => x.id === id);
      if (c && c.compra_items) {
        for (const i of c.compra_items) {
          if (i.producto_id && Number(i.cantidad) > 0) { 
             const { data: dbProd } = await supabase.from('productos').select('stock').eq('id', i.producto_id).single();
             if (dbProd) await supabase.from('productos').update({ stock: Math.max(0, dbProd.stock - Number(i.cantidad)) }).eq('id', i.producto_id); 
          }
        }
      }
      await supabase.from('compra_items').delete().eq('compra_id', id); await supabase.from('compras').delete().eq('id', id);
      toast.success('Compra eliminada correctamente.'); setCompraExpandida(null); cargarHistorial(); cargarProductos();
    } catch (error) { toast.error('Error: ' + error.message); } finally { setCargando(false); }
  }

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
           if (pData) await supabase.from('productos').update({ stock: Math.max(0, pData.stock - Number(old.cantidad)) }).eq('id', old.producto_id);
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

  const comprasFiltradasHistorial = comprasHistorial.filter(c => {
    if (!esMiller && filtroDoc !== 'Todos') {
      const tipo = c.tipo_comprobante || 'Factura';
      if (tipo !== filtroDoc) return false;
    }
    if (!busquedaHistorial) return true; 
    const t = busquedaHistorial.toLowerCase();
    return (c.empresa||'').toLowerCase().includes(t) ||
           (c.servicio_nombre||'').toLowerCase().includes(t) ||
           (c.cuenta_correo||'').toLowerCase().includes(t) ||
           (c.ruc||'').toLowerCase().includes(t) ||
           (c.numero_comprobante||'').toLowerCase().includes(t) ||
           (c.total||'').toString().includes(t) ||
           c.compra_items?.some(i => (i.nombre_original||'').toLowerCase().includes(t) || (i.productos?.nombre||'').toLowerCase().includes(t));
  })

  const limiteValido = Math.max(1, Number(itemsPorPagina) || 50)
  const comprasPaginadasHistorial = comprasFiltradasHistorial.slice((paginaActual - 1) * limiteValido, paginaActual * limiteValido)

  const exportarTXT = () => {
    let contenido = `HISTORIAL DE COMPRAS (${esMiller ? 'MILLER DIGITAL' : 'RICHARD EXPRESS'})\nDesde: ${desde} - Hasta: ${hasta}\n\n`;
    comprasFiltradasHistorial.forEach(c => { 
      contenido += `========================================================================\n`;
      contenido += `FECHA: ${c.fecha_compra} | PROVEEDOR: ${c.empresa} | TOTAL: S/ ${Number(c.total).toFixed(2)}\n`;
    })
    const blob = new Blob([contenido], { type: 'text/plain' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `historial_compras_${tiendaActual}.txt`; link.click();
  }

  const exportarCSV = () => {
    let contenido = `Fecha,Proveedor,RUC_WhatsApp,Comprobante_Correo,Total\n`;
    comprasFiltradasHistorial.forEach(c => {
      contenido += `"${c.fecha_compra}","${c.empresa}","${c.ruc}","${c.numero_comprobante}",${Number(c.total).toFixed(2)}\n`;
    });
    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `historial_compras_${tiendaActual}.csv`; link.click();
  }

  const exportarPDF = () => {
    const doc = new jsPDF('landscape'); 
    doc.text(`Historial de Compras - ${esMiller ? 'Miller Digital' : 'Richard Express'}`, 14, 15); 
    doc.setFontSize(10); doc.text(`Desde: ${desde} - Hasta: ${hasta}`, 14, 22);
    
    const tableData = comprasFiltradasHistorial.map(c => [c.fecha_compra, c.empresa, c.ruc, c.numero_comprobante, `S/ ${Number(c.total).toFixed(2)}`]);
    doc.autoTable({ head: [['Fecha', 'Proveedor', 'RUC / WhatsApp', 'Comprobante / Cuenta', 'Total']], body: tableData, startY: 28, theme: 'grid', styles: { fontSize: 8 } });
    doc.save(`historial_compras_${tiendaActual}.pdf`);
  }

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
        gastoTotal += cant * Number(i.precio_unitario);
        productosComprados += cant;
        if (!productosStats[i.producto_id]) productosStats[i.producto_id] = { id: i.producto_id, nombre: p.nombre, cantidad: 0, gasto: 0 }; 
        productosStats[i.producto_id].cantidad += cant; 
        productosStats[i.producto_id].gasto += cant * Number(i.precio_unitario);
      }
    })
  })
  const dias = Math.max(1, Math.ceil((new Date(hasta+'T23:59:59') - new Date(desde+'T00:00:00')) / 86400000)); const promedioGastoDiario = gastoTotal / dias;
  const statsArray = Object.values(productosStats).map(p => ({ ...p, costoPromedio: p.cantidad > 0 ? (p.gasto / p.cantidad) : 0 }))
  const chartDiasData = Object.keys(comprasPorDia).map(k => ({ Fecha: k, Inversión: parseFloat(comprasPorDia[k].toFixed(2)) })).sort((a,b) => a.Fecha.localeCompare(b.Fecha));
  const chartData = statsArray.sort((a, b) => b.gasto - a.gasto).slice(0, 10).map(p => ({ name: p.nombre.substring(0, 15) + '...', Inversión: parseFloat(p.gasto.toFixed(2)), Unidades: p.cantidad }))

  const compraActiva = comprasHistorial.find(c => c.id === compraExpandida)
  const colorTema = esMiller ? '#7c3aed' : 'var(--naranja)'

  return (
    <div>
      <style>{estilosImpresion}</style>
      <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          {esMiller ? <><Cpu size={24} color="#7c3aed" /> Compras & Cuentas Madre (Miller)</> : <>Gestión de Compras<span style={{ color: 'var(--naranja)' }}>.</span></>}
        </h1>
        <div style={{ display: 'flex', background: 'var(--fondo)', padding: 4, borderRadius: 8, gap: 4 }}>
          <button onClick={() => setTabActual('registro')} className={tabActual === 'registro' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px', background: tabActual === 'registro' ? colorTema : 'transparent' }}><UploadCloud size={16} /> {esMiller ? 'Registrar Cuenta / Servicio' : 'Registro / Cola'}</button>
          <button onClick={() => setTabActual('historial')} className={tabActual === 'historial' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px', background: tabActual === 'historial' ? colorTema : 'transparent' }}><FileText size={16} /> Historial</button>
          <button onClick={() => setTabActual('analisis')} className={tabActual === 'analisis' ? 'btn-primary' : 'btn-ghost'} style={{ fontSize: 13, padding: '6px 12px', background: tabActual === 'analisis' ? colorTema : 'transparent' }}><BarChart3 size={16} /> Análisis</button>
        </div>
      </div>

      {/* -------------------- TAB REGISTRO PARA MILLER DIGITAL (COMPRA DE CUENTAS MADRE) -------------------- */}
      {tabActual === 'registro' && esMiller && (
        <div className="card" style={{ maxWidth: 680, margin: '0 auto', padding: 24, borderTop: '4px solid #7c3aed' }}>
          <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 18, fontWeight: 800, color: '#7c3aed', marginBottom: 6 }}>
            Registrar Compra de Cuenta / Servicio (Madre)
          </h2>
          <p style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 18 }}>
            Registra aquí las cuentas que adquieres de tus proveedores. Los cupos ingresados se sumarán al stock del servicio en la tienda.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>1. Vincular con Servicio de la Tienda *</label>
              <select
                value={formServicio.producto_servicio_id}
                onChange={e => {
                  const p = productosDB.find(x => x.id === e.target.value)
                  setFormServicio({ ...formServicio, producto_servicio_id: e.target.value, servicio_nombre: p ? p.nombre : formServicio.servicio_nombre })
                }}
                style={{ width: '100%', fontSize: 13 }}>
                <option value="">-- Selecciona el Servicio --</option>
                {productosDB.map(p => <option key={p.id} value={p.id}>{p.nombre} (Cupos actuales: {p.stock})</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Nombre del Proveedor *</label>
              <input type="text" placeholder="Ej: Proveedor / Paige Donovan" value={formServicio.proveedor} onChange={e => setFormServicio({ ...formServicio, proveedor: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}><Phone size={12}/> WhatsApp del Proveedor</label>
              <input type="text" placeholder="Ej: 999888777" value={formServicio.proveedor_whatsapp} onChange={e => setFormServicio({ ...formServicio, proveedor_whatsapp: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}><Mail size={12}/> Correo de la Cuenta / Equipo *</label>
              <input type="email" placeholder="cuenta@gmail.com" value={formServicio.cuenta_correo} onChange={e => setFormServicio({ ...formServicio, cuenta_correo: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}><Globe size={12}/> Plataforma de Compra</label>
              <select value={formServicio.plataforma_compra} onChange={e => setFormServicio({ ...formServicio, plataforma_compra: e.target.value })}>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Telegram">Telegram</option>
                <option value="Binance / P2P">Binance / P2P</option>
                <option value="Facebook">Facebook</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Costo Total Pagado (S/) *</label>
              <input type="number" step="0.1" placeholder="Ej: 25.00" value={formServicio.costo_total} onChange={e => setFormServicio({ ...formServicio, costo_total: e.target.value })} />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed' }}><Users size={12}/> Cupos Totales de Usuarios *</label>
              <input type="number" min="1" value={formServicio.cupos_totales} onChange={e => setFormServicio({ ...formServicio, cupos_totales: e.target.value })} style={{ fontWeight: 800, border: '1.5px solid #7c3aed' }} />
            </div>

            <div style={{ gridColumn: '1 / -1', background: '#f8fafc', padding: 14, borderRadius: 10, border: '1px solid var(--borde)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Fecha Compra</label>
                <input type="date" value={formServicio.fecha_compra} onChange={e => setFormServicio({ ...formServicio, fecha_compra: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Duración (Meses)</label>
                <input type="number" min="1" value={formServicio.duracion_meses} onChange={e => setFormServicio({ ...formServicio, duracion_meses: e.target.value })} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 800, color: '#0891b2' }}>Vencimiento</label>
                <input type="date" value={formServicio.fecha_vencimiento} onChange={e => setFormServicio({ ...formServicio, fecha_vencimiento: e.target.value })} style={{ fontWeight: 700, background: '#ecfeff', border: '1px solid #06b6d4' }} />
              </div>
            </div>

            <div style={{ gridColumn: '1 / -1', marginTop: 6 }}>
              <button onClick={guardarCompraMiller} disabled={cargando} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: 13, background: 'linear-gradient(135deg, #7c3aed, #06b6d4)', border: 'none' }}>
                <Save size={16} /> {cargando ? 'Guardando...' : 'Guardar Cuenta Madre y Sumar Cupos'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB REGISTRO / BANDEJA DE COLA (RICHARD EXPRESS INTACTO) -------------------- */}
      {tabActual === 'registro' && !esMiller && (
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
                  style={{ width: 300, textAlign: 'center', cursor: 'pointer', padding: 40, border: isDragging ? '2px dashed var(--naranja)' : '2px dashed transparent', background: isDragging ? '#f59e0b10' : 'var(--fondo)' }}>
                   <UploadCloud size={48} style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} />
                   <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Escanear Comprobantes</h3>
                   <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>Arrastra tus PDFs aquí o haz clic.</p>
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
                  <h3 style={{ fontSize: 14, fontWeight: 700 }}>{colaArchivos.length > 1 ? `En cola: ${indiceCola + 1} de ${colaArchivos.length}` : 'Documento Adjunto'}</h3>
                  <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}>Cancelar Todo</button>
                </div>
                <div style={{ flex: 1, background: '#525659', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {pdfUrl ? <iframe src={pdfUrl} width="100%" height="100%" style={{ border: 'none' }} title="Vista" /> : <p style={{ color: '#fff' }}>Vista previa no disponible</p>}
                </div>
              </div>
            </div>
          )}

          {modoIngreso && (
            <div className="card" style={{ padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: modoIngreso === 'manual' ? '0 auto' : 0, maxWidth: modoIngreso === 'manual' ? 700 : '100%', width: '100%' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--borde)', background: 'var(--fondo)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700 }}>Formulario Autoguardado {procesandoPdf && <span className="spinner" style={{ width: 14, height: 14 }} />}</h3>
                <button onClick={resetearIngreso} className="btn-ghost" style={{ padding: '4px 12px', fontSize: 12, color: '#D00' }}><ArrowLeft size={14}/> Volver</button>
              </div>

              <div style={{ flex: 1, padding: 20 }}>
                {esDuplicadoActual && (
                  <div className="alerta-duplicado" style={{ background: '#fee2e2', color: '#b91c1c', padding: '12px 16px', borderRadius: '8px', border: '1px solid #f87171', display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px' }}>
                    <AlertCircle size={24} />
                    <div>
                      <strong style={{ display: 'block', fontSize: '14px' }}>¡ATENCIÓN! Comprobante Duplicado Detectado</strong>
                      <span style={{ fontSize: '12px' }}>Ya existe un registro con el RUC <b>{datosFactura.ruc}</b> y Número <b>{datosFactura.numero_comprobante}</b>.</span>
                    </div>
                  </div>
                )}

                {procesandoPdf ? ( <div style={{ textAlign: 'center', padding: '40px 0' }}><RefreshCw size={32} className="spin" style={{ margin: '0 auto 16px', color: 'var(--naranja)' }} /><p>Analizando documento...</p></div> ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div><label style={{ fontSize: 11, fontWeight: 600 }}>Proveedor / Empresa</label><input type="text" value={datosFactura.proveedor} onChange={e => cambiarDatoFactura('proveedor', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div><label style={{ fontSize: 11, fontWeight: 600 }}>RUC</label><input type="text" value={datosFactura.ruc} onChange={e => cambiarDatoFactura('ruc', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                      <div><label style={{ fontSize: 11, fontWeight: 600 }}>Fecha</label><input type="date" value={datosFactura.fecha} onChange={e => cambiarDatoFactura('fecha', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                    </div>
                    <div><label style={{ fontSize: 11, fontWeight: 600 }}>N° Boleta/Factura</label><input type="text" value={datosFactura.numero_comprobante} onChange={e => cambiarDatoFactura('numero_comprobante', e.target.value)} style={{ width: '100%', fontSize: 13 }} /></div>
                    
                    <h4 style={{ fontSize: 13, fontWeight: 700, marginTop: 10 }}>Relación con Almacén</h4>
                    {datosFactura.items.map((item) => (
                      <div key={item.id_temp} style={{ padding: 12, border: `1px solid ${item.estado === 'vinculado' ? '#10b981' : '#f59e0b'}`, borderRadius: 8, marginBottom: 12, background: '#fff' }}>
                        <input type="text" value={item.nombreOriginal} onChange={e => cambiarDatoItem(item.id_temp, 'nombreOriginal', e.target.value)} style={{ width: '100%', fontSize: 13, fontWeight: 600, marginBottom: 8 }} />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <BuscadorProductos item={item} productosDB={productosDB} onSelect={(id) => emparejarProducto(item.id_temp, id)} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Cantidad (0 si no cuenta)</label><input type="number" value={item.cantidad} onChange={e => cambiarDatoItem(item.id_temp, 'cantidad', Number(e.target.value))} style={{ width: '100%', fontSize: 12 }} /></div>
                          <div style={{ flex: 1 }}><label style={{ fontSize: 10 }}>Suma (S/)</label><input type="number" step="any" value={item.precio_total_linea} onChange={e => cambiarDatoItem(item.id_temp, 'precio_total_linea', e.target.value)} style={{ width: '100%', fontSize: 12 }} /></div>
                        </div>
                      </div>
                    ))}
                    <div><label style={{ fontSize: 11, fontWeight: 800, color: 'var(--naranja)' }}>TOTAL FINAL (S/)</label><input type="number" step="any" value={datosFactura.total} onChange={e => cambiarDatoFactura('total', e.target.value)} style={{ width: '100%', fontSize: 14, fontWeight: 700, color: 'var(--naranja)' }} /></div>
                  </div>
                )}
              </div>
              <div style={{ padding: '16px', borderTop: '1px solid var(--borde)' }}>
                <button onClick={guardarCompra} disabled={procesandoPdf || datosFactura.items.length === 0} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  <ListChecks size={18} style={{ marginRight: 8 }}/> Guardar Registro
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* -------------------- TAB HISTORIAL CON PAGINADOR -------------------- */}
      {tabActual === 'historial' && (
        <div className="no-print" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '100%', position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 10, color: 'var(--texto-suave)' }} />
                <input type="text" placeholder={esMiller ? "Buscar servicio o proveedor..." : "Buscar proveedor, RUC, N° Boleta..."} value={busquedaHistorial} onChange={(e) => { setBusquedaHistorial(e.target.value); setPaginaActual(1) }} style={{ width: '100%', padding: '8px 12px 8px 36px', fontSize: 13, borderRadius: 8, border: '1px solid var(--borde)' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
                <input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ flex: 1, padding: '6px 10px', fontSize: 12 }} />
              </div>
              <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', alignItems: 'center' }}>
                 <button onClick={exportarCSV} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}><Download size={14}/> CSV</button>
                 <button onClick={exportarTXT} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}><FileText size={14}/> TXT</button>
                 <button onClick={exportarPDF} className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', color: '#D00' }}><Printer size={14}/> PDF</button>
              </div>
            </div>

            {cargando ? <div className="spinner" style={{ margin: '40px auto' }} /> : comprasFiltradasHistorial.length === 0 ? ( <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--texto-suave)' }}>Sin resultados.</div> ) : (
              <>
                {comprasPaginadasHistorial.map(c => (
                  <div key={c.id} onClick={() => setCompraExpandida(c.id)} className="card" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', border: compraExpandida === c.id ? `2px solid ${colorTema}` : '1px solid transparent', background: compraExpandida === c.id ? 'var(--fondo)' : '#fff' }}>
                    <div>
                      <h3 style={{ fontSize: 14, fontWeight: 700, color: compraExpandida === c.id ? colorTema : 'inherit' }}>
                        {esMiller ? `${c.servicio_nombre || 'Servicio'} · ${c.empresa}` : c.empresa}
                      </h3>
                      <p style={{ fontSize: 11, color: 'var(--texto-suave)' }}>
                        {esMiller ? `🔑 ${c.cuenta_correo || c.numero_comprobante} · 👥 Cupos: ${c.cupos_usados || 0}/${c.cupos_totales || 1}` : `${c.fecha_compra} | ${c.tipo_comprobante || 'Factura'}: ${c.numero_comprobante || 'S/N'}`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}><p style={{ fontSize: 16, fontWeight: 800, color: '#D00' }}>S/ {Number(c.total).toFixed(2)}</p></div>
                  </div>
                ))}

                <Paginador
                  totalItems={comprasFiltradasHistorial.length}
                  itemsPorPagina={itemsPorPagina}
                  setItemsPorPagina={setItemsPorPagina}
                  paginaActual={paginaActual}
                  setPaginaActual={setPaginaActual}
                  esMiller={esMiller}
                />
              </>
            )}
          </div>
          
          <div style={{ flex: '1 1 50%', position: 'sticky', top: 20 }}>
            {compraActiva ? (
              <div id="zona-impresion" style={{ background: '#fff', borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)', padding: 32, fontFamily: '"Courier New", Courier, monospace', border: '1px solid #e5e7eb', position: 'relative' }}>
                <div className="no-print" style={{ position: 'absolute', top: 16, right: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
                   <button onClick={() => eliminarCompra(compraActiva.id)} className="btn-ghost" title="Eliminar Registro" style={{ padding: 8, color: '#ef4444' }}><Trash2 size={16} /></button>
                   <button onClick={() => abrirEdicion(compraActiva)} className="btn-ghost" title="Editar" style={{ padding: 8, color: '#f59e0b' }}><Edit3 size={16} /></button>
                   <button onClick={() => window.print()} className="btn-primary" style={{ padding: 8, background: '#111827', color: '#fff' }}><Printer size={16} /></button>
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Detalle de Compra</h2>
                <div style={{ marginBottom: 20, fontSize: 13, lineHeight: '1.6' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>PROVEEDOR:</b> <span>{compraActiva.empresa}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{esMiller ? 'WHATSAPP:' : 'RUC:'}</b> <span>{compraActiva.ruc}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>{esMiller ? 'CUENTA CORREO:' : 'N° COMPROBANTE:'}</b> <span>{compraActiva.numero_comprobante}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><b>FECHA:</b> <span>{compraActiva.fecha_compra}</span></div>
                </div>
                <div style={{ borderTop: '2px solid #000', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16 }}>
                  <span>TOTAL:</span><span>S/ {Number(compraActiva.total).toFixed(2)}</span>
                </div>
              </div>
            ) : (<div style={{ height: '100%', minHeight: 400, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--texto-suave)', border: '2px dashed var(--borde)', borderRadius: 12 }}><Receipt size={48} style={{ opacity: 0.3, marginBottom: 16 }} /><p>Selecciona un registro</p></div>)}
          </div>
        </div>
      )}

      {/* -------------------- TAB ANÁLISIS -------------------- */}
      {tabActual === 'analisis' && (
        <div className="analisis-container no-print">
          <div className="card" style={{ padding: '16px 20px', marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Calendar size={16} color="var(--texto-suave)" /><input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} /><span>-</span><input type="date" value={hasta} onChange={e => setHasta(e.target.value)} style={{ width: 'auto', padding: '6px 10px', fontSize: 12 }} /></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #D00' }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>Total Invertido</p><h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: '#D00' }}>S/ {gastoTotal.toFixed(2)}</h3></div>
            <div className="card" style={{ padding: 20, borderTop: '3px solid #3b82f6' }}><p style={{ fontSize: 12, color: 'var(--texto-suave)', fontWeight: 600 }}>{esMiller ? 'Cupos Adquiridos' : 'Unidades Compradas'}</p><h3 style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{productosComprados}</h3></div>
          </div>
        </div>
      )}

      {/* -------------------- MODAL DE EDICIÓN FLOTANTE -------------------- */}
      {modalEdicion && datosEdicion && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800 }}>Editando Registro</h2>
              <button onClick={() => setModalEdicion(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label style={{ fontSize: 11, fontWeight: 600 }}>Proveedor</label><input type="text" value={datosEdicion.proveedor} onChange={e => cambiarDatoEdicion('proveedor', e.target.value)} /></div>
              <div><label style={{ fontSize: 11, fontWeight: 600 }}>Total (S/)</label><input type="number" step="any" value={datosEdicion.total} onChange={e => cambiarDatoEdicion('total', e.target.value)} /></div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setModalEdicion(false)} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={cargando} className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: '#f59e0b' }}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
