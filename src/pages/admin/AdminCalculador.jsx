import { useState, useMemo } from 'react'
import { Package, Tag, Calendar, AlertTriangle, SlidersHorizontal, RotateCcw, Target, TrendingUp, Receipt } from 'lucide-react'

const IGV = 0.18
const IR_MENSUAL = 0.01
const IR_ANUAL = 0.10

const fS = n => isNaN(n) ? 'S/ 0.00' : 'S/ ' + n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fP = n => isNaN(n) ? '0.0%' : n.toFixed(1) + '%'

export default function AdminCalculador() {
  const [producto, setProducto] = useState('')
  const [costoCompra, setCostoCompra] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [gastosAdicionales, setGastosAdicionales] = useState('')
  const [precioVenta, setPrecioVenta] = useState('')
  const [cantidadVenta, setCantidadVenta] = useState('')
  const [margenDeseado, setMargenDeseado] = useState('')
  const [periodo, setPeriodo] = useState('mensual')
  const [meses, setMeses] = useState('12')
  const [sliderPrecio, setSliderPrecio] = useState(null)
  const [showSlider, setShowSlider] = useState(false)

  const cc = parseFloat(costoCompra) || 0
  const qty = parseFloat(cantidad) || 0
  const ga = parseFloat(gastosAdicionales) || 0
  const pv = sliderPrecio !== null ? sliderPrecio : (parseFloat(precioVenta) || 0)
  const qtyVenta = parseFloat(cantidadVenta) || qty || 0
  const md = parseFloat(margenDeseado) || 0
  const numMeses = parseInt(meses) || 12

  const calc = useMemo(() => {
    if (cc === 0) return null
    const costoUnitario = qty > 0 ? cc + (ga / qty) : cc + ga
    const precioSugerido = md > 0 ? costoUnitario / (1 - md / 100) : 0
    const precioConIGV = pv * (1 + IGV)
    const margenBruto = pv > 0 ? ((pv - costoUnitario) / pv) * 100 : 0
    const margenBrutoSoles = pv - costoUnitario
    const igvCobrado = pv * IGV
    const mult = periodo === 'anual' ? numMeses : 1
    const uds = qtyVenta * mult
    const ventasT = pv * uds
    const costosT = costoUnitario * uds
    const utilBruta = ventasT - costosT
    const igvVentas = ventasT * IGV
    const igvCompras = costosT * IGV
    const igvPagar = igvVentas - igvCompras
    const irMensual = ventasT * IR_MENSUAL
    const irAnual = utilBruta * IR_ANUAL
    const gNeta = utilBruta - igvPagar - irMensual
    const gNetaUd = uds > 0 ? gNeta / uds : 0
    const rentabilidad = ventasT > 0 ? (gNeta / ventasT) * 100 : 0
    const margenContrib = pv - (qty > 0 ? cc : costoUnitario)
    const breakEven = margenContrib > 0 ? Math.ceil(ga / margenContrib) : 0
    return { costoUnitario, precioSugerido, precioConIGV, margenBruto, margenBrutoSoles, igvCobrado, ventasT, costosT, utilBruta, igvVentas, igvCompras, igvPagar, irMensual, irAnual, gNeta, gNetaUd, rentabilidad, breakEven, uds }
  }, [cc, qty, ga, pv, qtyVenta, md, periodo, numMeses])

  const limpiar = () => {
    setProducto(''); setCostoCompra(''); setCantidad(''); setGastosAdicionales('')
    setPrecioVenta(''); setCantidadVenta(''); setMargenDeseado('')
    setPeriodo('mensual'); setMeses('12'); setSliderPrecio(null); setShowSlider(false)
  }

  const alertas = []
  if (cc > 0 && pv > 0 && pv < cc) alertas.push('El precio de venta es menor al costo de compra')
  if (calc && calc.margenBruto < 10 && calc.margenBruto > 0) alertas.push('Margen menor al 10% — revisa tu precio')

  const sliderMin = Math.max(cc * 0.8, 0.1)
  const sliderMax = cc * 3 || 10

  const mColor = v => v >= 30 ? '#2E7D32' : v >= 15 ? 'var(--naranja)' : '#C62828'

  return (
    <div>
      <h1 style={{ fontFamily: 'var(--fuente-display)', fontSize: 24, fontWeight: 700, margin: '0 0 4px' }}>Calculador Tributario</h1>
      <p style={{ color: 'var(--texto-suave)', fontSize: 14, margin: '0 0 24px' }}>Márgenes, IGV, Impuesto a la Renta y ganancia neta por producto</p>

      {alertas.map((a, i) => (
        <div key={i} style={{ background: '#FFF3E0', border: '1px solid #FFB74D', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#E65100', fontSize: 13, fontWeight: 500 }}>
          <AlertTriangle size={16} /> {a}
        </div>
      ))}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <Card title="Producto" Icon={Package}>
          <Campo label="Nombre del producto" value={producto} onChange={setProducto} placeholder="Ej: Arroz 1kg" />
          <Campo label="Costo de compra (sin IGV) *" value={costoCompra} onChange={setCostoCompra} type="number" prefix="S/" placeholder="2.50" />
          <Campo label="Cantidad comprada" value={cantidad} onChange={setCantidad} type="number" placeholder="100" />
          <Campo label="Gastos adicionales (total lote)" value={gastosAdicionales} onChange={setGastosAdicionales} type="number" prefix="S/" placeholder="20.00" info="Transporte, embalaje — total del lote" />
        </Card>

        <Card title="Venta" Icon={Tag}>
          <Campo label="Precio de venta base (sin IGV) *" value={sliderPrecio !== null ? sliderPrecio.toFixed(2) : precioVenta} onChange={v => { setPrecioVenta(v); setSliderPrecio(null) }} type="number" prefix="S/" placeholder="4.50" />
          <Campo label="Unidades a vender" value={cantidadVenta} onChange={setCantidadVenta} type="number" placeholder={cantidad || '100'} />
          <Campo label="Margen deseado (%)" value={margenDeseado} onChange={setMargenDeseado} type="number" suffix="%" placeholder="30" info="Opcional — calcula el precio sugerido" />
          {md > 0 && calc && calc.precioSugerido > 0 && (
            <div style={{ background: 'var(--naranja-light)', borderRadius: 8, padding: '8px 12px', fontSize: 13 }}>
              <span style={{ color: 'var(--texto-suave)' }}>Precio sugerido para {fP(md)} de margen: </span>
              <strong style={{ color: 'var(--naranja)' }}>{fS(calc.precioSugerido)}</strong>
            </div>
          )}
        </Card>

        <Card title="Período" Icon={Calendar}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {['mensual', 'anual'].map(p => (
              <button key={p} onClick={() => setPeriodo(p)} style={{
                flex: 1, padding: '9px 0', borderRadius: 8, border: '2px solid', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', textTransform: 'capitalize', transition: 'all 0.2s',
                borderColor: periodo === p ? 'var(--naranja)' : 'var(--borde)',
                background: periodo === p ? 'var(--naranja)' : 'var(--blanco)',
                color: periodo === p ? '#fff' : 'var(--texto-suave)',
              }}>{p}</button>
            ))}
          </div>
          {periodo === 'anual' && <Campo label="Meses a proyectar" value={meses} onChange={setMeses} type="number" placeholder="12" />}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button onClick={() => setShowSlider(!showSlider)} style={{
              flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--borde)',
              background: showSlider ? 'var(--naranja-light)' : 'var(--blanco)',
              fontSize: 12, fontWeight: 500, cursor: 'pointer', color: 'var(--texto-suave)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
            }}>
              <SlidersHorizontal size={14} /> Simulador
            </button>
            <button onClick={limpiar} style={{
              padding: '9px 14px', borderRadius: 8, border: '1px solid var(--borde)',
              background: 'var(--blanco)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              color: '#999', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <RotateCcw size={14} /> Limpiar
            </button>
          </div>
        </Card>
      </div>

      {showSlider && cc > 0 && (
        <div style={{ background: '#FFF8F0', border: '1px solid #FFD9B3', borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 15 }}>Simulador de precio</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--naranja)' }}>{fS(sliderPrecio !== null ? sliderPrecio : pv)}</span>
          </div>
          <input type="range" min={sliderMin} max={sliderMax} step={0.05} value={sliderPrecio !== null ? sliderPrecio : pv || cc * 1.3}
            onChange={e => setSliderPrecio(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--naranja)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#999', marginTop: 4 }}>
            <span>{fS(sliderMin)}</span><span>Costo: {fS(cc)}</span><span>{fS(sliderMax)}</span>
          </div>
          {calc && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 14, textAlign: 'center' }}>
              <div><div style={{ fontSize: 11, color: '#888' }}>Margen</div><div style={{ fontSize: 17, fontWeight: 700, color: mColor(calc.margenBruto) }}>{fP(calc.margenBruto)}</div></div>
              <div><div style={{ fontSize: 11, color: '#888' }}>Ganancia/ud</div><div style={{ fontSize: 17, fontWeight: 700 }}>{fS(calc.margenBrutoSoles)}</div></div>
              <div><div style={{ fontSize: 11, color: '#888' }}>Precio + IGV</div><div style={{ fontSize: 17, fontWeight: 700 }}>{fS(calc.precioConIGV)}</div></div>
            </div>
          )}
        </div>
      )}

      {calc && pv > 0 && (
        <>
          <Titulo>Resultado por producto{producto ? `: ${producto}` : ''}</Titulo>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 24 }}>
            <Stat label="Costo unitario" value={fS(calc.costoUnitario)} sub="con gastos" />
            <Stat label="Margen bruto" value={fP(calc.margenBruto)} sub={fS(calc.margenBrutoSoles) + '/ud'} color={mColor(calc.margenBruto)} />
            <Stat label="IGV cobrado" value={fS(calc.igvCobrado)} sub="18% por unidad" />
            <Stat label="Precio con IGV" value={fS(calc.precioConIGV)} sub="lo que cobras" highlight />
            <Stat label="Ganancia neta/ud" value={fS(calc.gNetaUd)} sub="después de impuestos" color="#2E7D32" />
          </div>

          <Titulo>Proyección {periodo === 'anual' ? `anual (${numMeses} meses)` : 'mensual'} — {calc.uds} unidades</Titulo>
          <div style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
            <Fila label="Ventas totales" value={fS(calc.ventasT)} bold />
            <Fila label="Costos totales" value={'- ' + fS(calc.costosT)} color="#C62828" />
            <Fila label="Utilidad bruta" value={fS(calc.utilBruta)} bold bg="var(--fondo)" />
            <Fila label="IGV a pagar a SUNAT" value={'- ' + fS(calc.igvPagar)} color="#C62828" sub={fS(calc.igvVentas) + ' cobrado − ' + fS(calc.igvCompras) + ' pagado'} />
            <Fila label="IR 1% a cuenta" value={'- ' + fS(calc.irMensual)} color="#C62828" sub="1% de ventas totales" />
            {periodo === 'anual' && <Fila label="IR 10% anual" value={'- ' + fS(calc.irAnual)} color="#C62828" sub="10% de utilidad" />}
            <div style={{ background: 'var(--naranja)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, fontFamily: 'var(--fuente-display)' }}>GANANCIA NETA</div>
                <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>lo que te llevas a casa</div>
              </div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 22, fontFamily: 'var(--fuente-display)' }}>{fS(calc.gNeta)}</div>
            </div>
          </div>

          <Titulo>Análisis</Titulo>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 24 }}>
            <AnalisisCard icon={Target} iconBg="#FFF3E0" iconColor="var(--naranja)" title="Break-even"
              value={calc.breakEven > 0 && isFinite(calc.breakEven) ? calc.breakEven + ' uds' : 'N/A'}
              valueColor="var(--naranja)" desc="Unidades mínimas para cubrir gastos" />
            <AnalisisCard icon={TrendingUp} iconBg="#E8F5E9" iconColor="#2E7D32" title="Rentabilidad"
              value={fP(calc.rentabilidad)} valueColor={mColor(calc.rentabilidad)} desc="Ganancia neta / ventas totales" />
            <AnalisisCard icon={Receipt} iconBg="#FFEBEE" iconColor="#C62828" title="Impacto impuestos"
              value={fS(calc.igvPagar + calc.irMensual)} valueColor="#C62828" desc={'IGV: ' + fS(calc.igvPagar) + ' + IR: ' + fS(calc.irMensual)} />
          </div>

          <div style={{ background: 'var(--fondo)', borderRadius: 10, padding: '12px 16px', fontSize: 12, color: 'var(--texto-suave)' }}>
            <strong>Fórmulas:</strong> Costo/ud = Costo + (Gastos÷Cant) · Margen% = (Precio−Costo)÷Precio×100 · IGV = 18% ventas − 18% compras · IR = 1% ventas · Ganancia = Utilidad − IGV − IR
          </div>
        </>
      )}

      {(!calc || pv === 0) && (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: '#BDBDBD' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧮</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ingresa costo y precio de venta</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Los resultados aparecerán aquí automáticamente</div>
        </div>
      )}
    </div>
  )
}

function Card({ title, Icon, children }) {
  return (
    <div style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--naranja-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} color="var(--naranja)" />
        </div>
        <span style={{ fontFamily: 'var(--fuente-display)', fontWeight: 700, fontSize: 15 }}>{title}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  )
}

function Campo({ label, value, onChange, type = 'text', prefix, suffix, placeholder, info }) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--texto-suave)', display: 'block', marginBottom: 3 }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--borde)', borderRadius: 8, overflow: 'hidden', background: 'var(--fondo)' }}>
        {prefix && <span style={{ padding: '0 0 0 10px', color: '#999', fontSize: 13, fontWeight: 600 }}>{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          min={type === 'number' ? '0' : undefined} step={type === 'number' ? 'any' : undefined}
          style={{ flex: 1, padding: '9px 10px', border: 'none', outline: 'none', fontSize: 14, background: 'transparent', fontFamily: 'inherit', width: '100%' }} />
        {suffix && <span style={{ padding: '0 10px 0 0', color: '#999', fontSize: 13, fontWeight: 600 }}>{suffix}</span>}
      </div>
      {info && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{info}</div>}
    </div>
  )
}

function Stat({ label, value, sub, color, highlight }) {
  return (
    <div style={{ background: highlight ? 'var(--naranja-light)' : 'var(--blanco)', border: '1px solid ' + (highlight ? '#FFD9B3' : 'var(--borde)'), borderRadius: 10, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#888', fontWeight: 500, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color || 'var(--texto)', fontFamily: 'var(--fuente-display)' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function Fila({ label, value, bold, color, bg, sub }) {
  return (
    <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--borde)', background: bg || 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: bold ? 600 : 400, color: 'var(--texto-suave)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#aaa' }}>{sub}</div>}
      </div>
      <div style={{ fontSize: 15, fontWeight: bold ? 700 : 500, color: color || 'var(--texto)', fontFamily: 'var(--fuente-display)' }}>{value}</div>
    </div>
  )
}

function Titulo({ children }) {
  return <h2 style={{ fontFamily: 'var(--fuente-display)', fontSize: 16, fontWeight: 700, margin: '0 0 12px', paddingBottom: 7, borderBottom: '2px solid var(--naranja)' }}>{children}</h2>
}

function AnalisisCard({ icon: Icon, iconBg, iconColor, title, value, valueColor, desc }) {
  return (
    <div style={{ background: 'var(--blanco)', border: '1px solid var(--borde)', borderRadius: 12, padding: 18 }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon size={15} color={iconColor} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: valueColor, fontFamily: 'var(--fuente-display)' }}>{value}</div>
      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>{desc}</div>
    </div>
  )
}
