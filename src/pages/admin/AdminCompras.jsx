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
  
  // Datos Extraídos por Gemini IA (NUEVOS CAMPOS AGREGADOS)
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

    setPdfFile(file)
    setPdfUrl(URL.createObjectURL(file))
    await procesarDocumentoConGemini(file)
  }

  const procesarDocumentoConGemini = async (file) => {
    setProcesandoPdf(true)
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY
      
      if (!apiKey) {
        throw new Error('No se encontró VITE_GEMINI_API_KEY en las variables de entorno de Vercel.')
      }

      const base64Pdf = await convertirPdfABase64(file)
      const mimeType = file.type === 'application/pdf' ? 'application/pdf' : file.type

      // PROMPT OPTIMIZADO: Matemáticas, conversiones y campos adicionales
      const prompt = `Analiza detenidamente este comprobante de compra (boleta o factura). 
      REGLAS MATEMÁTICAS ESTRICTAS:
      1. Convierte SIEMPRE las docenas a unidades. Si la cantidad dice "1 DOC" o "1 DO", eso es igual a 12. Si dice "1 1/2 DO", eso es igual a 18. Anota solo el número final de unidades.
      2. El "precio_unitario" debe ser matemáticamente exacto: divide el PRECIO TOTAL DE LA LÍNEA entre la CANTIDAD DE UNIDADES obtenidas. (Ej: Si 18 unidades cuestan 28.90, el precio unitario es 1.61).
      
      Extrae los datos y responde ÚNICAMENTE en formato JSON plano con la siguiente estructura exacta:
      {
        "proveedor": "Nombre comercial o Razón Social",
        "ruc": "Número de RUC del emisor",
        "numero_comprobante": "Serie y correlativo (Ej: B003-0395158)",
        "fecha": "YYYY-MM-DD",
        "subtotal": 0.00,
        "igv": 0.00,
        "otros_cargos": 0.00, 
        "total": 0.00,
        "items": [
          {
            "nombreOriginal": "Descripción detallada del artículo",
            "cantidad": 1,
            "precio_unitario": 0.00
          }
        ]
      }`

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mimeType, data: base64Pdf } },
                  { text: prompt }
                ]
              }
            ]
          })
        }
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Error desconocido de Google')
      }

      const data = await response.json()
      const textoRespuesta = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!textoRespuesta) throw new Error('No se pudo extraer texto del documento.')

      const jsonLimpio = textoRespuesta.replace(/```json/g, '').replace(/
