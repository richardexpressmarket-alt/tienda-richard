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

  // --- LÓGICA IA CON MODELO ESTABLE Y ERROR TRANSPARENTE ---
  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    setPdfUrl(URL.createObjectURL(file))
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      if (!apiKey) throw new Error('No API Key configurada en Vercel/Local.')

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      const prompt = `Analiza detenidamente este comprobante. REGLAS: 1. Convierte docenas a unidades. 2. Extrae PRECIO TOTAL PAGADO POR LÍNEA. Extrae JSON plano sin formato markdown extra: {"proveedor": "Nombre", "ruc": "RUC", "tipo_comprobante": "Factura o Boleta", "numero_comprobante": "Serie-Corr", "fecha": "YYYY-MM-DD", "subtotal": 0, "igv": 0, "otros_cargos": 0, "total": 0, "items": [{"nombreOriginal": "Desc exacta del recibo", "cantidad": 1, "precio_total_linea": 0}]}`

      // Se usa únicamente gemini-1.5-flash (el oficial y estable)
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mimeType, data: base64Pdf } }, { text: prompt }] }] })
      });

      // Si falla, mostramos el error EXACTO de Google
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || `Código de error HTTP: ${response.status}`);
      }

      const data = await response.json()
      const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      const jsonLimpio = textoRespuesta.replace(/```json/gi, '').replace(/
