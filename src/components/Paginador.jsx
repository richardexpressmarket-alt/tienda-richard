import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Paginador({
  totalItems,
  itemsPorPagina,
  setItemsPorPagina,
  paginaActual,
  setPaginaActual,
  esMiller = false
}) {
  if (totalItems === 0) return null

  const limiteValido = Math.max(1, Number(itemsPorPagina) || 50)
  const totalPaginas = Math.max(1, Math.ceil(totalItems / limiteValido))
  const pagSegura = Math.min(Math.max(1, paginaActual), totalPaginas)

  const inicio = (pagSegura - 1) * limiteValido + 1
  const fin = Math.min(pagSegura * limiteValido, totalItems)
  const colorTema = esMiller ? '#06b6d4' : 'var(--naranja)'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 12, marginTop: 20, padding: '12px 16px',
      borderRadius: 12,
      background: esMiller ? 'rgba(30, 41, 59, 0.85)' : 'var(--blanco)',
      border: esMiller ? '1px solid rgba(124, 58, 237, 0.35)' : '1px solid var(--borde)',
      color: esMiller ? '#f8fafc' : 'var(--texto)'
    }}>
      {/* Selector editable de cantidad a mostrar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>Mostrar</span>
        <input
          type="number"
          min="1"
          max="1000"
          value={itemsPorPagina}
          onChange={(e) => {
            const val = e.target.value
            setItemsPorPagina(val === '' ? '' : Math.max(1, parseInt(val, 10)))
            setPaginaActual(1)
          }}
          onBlur={(e) => {
            if (!e.target.value || Number(e.target.value) < 1) {
              setItemsPorPagina(50)
              setPaginaActual(1)
            }
          }}
          style={{
            width: 65, padding: '5px 8px', textAlign: 'center', fontWeight: 700, fontSize: 13,
            borderRadius: 8, border: `1.5px solid ${colorTema}`,
            background: esMiller ? '#0f172a' : 'var(--fondo)',
            color: esMiller ? '#fff' : 'var(--texto)'
          }}
        />
        <span style={{ color: esMiller ? '#94a3b8' : 'var(--texto-suave)' }}>
          por página · Viendo <b>{inicio}–{fin}</b> de <b>{totalItems}</b>
        </span>
      </div>

      {/* Controles de navegación y total de páginas */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          type="button"
          disabled={pagSegura <= 1}
          onClick={() => setPaginaActual(pagSegura - 1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--borde)',
            background: pagSegura <= 1 ? 'transparent' : (esMiller ? '#1e293b' : 'var(--fondo)'),
            color: esMiller ? '#f8fafc' : 'var(--texto)',
            cursor: pagSegura <= 1 ? 'not-allowed' : 'pointer',
            opacity: pagSegura <= 1 ? 0.4 : 1, fontSize: 12, fontWeight: 600
          }}>
          <ChevronLeft size={15} /> Anterior
        </button>

        <span style={{
          fontSize: 13, fontWeight: 700, padding: '6px 12px', borderRadius: 8,
          background: esMiller ? 'rgba(124, 58, 237, 0.2)' : 'var(--naranja-light)',
          color: esMiller ? '#06b6d4' : 'var(--naranja)'
        }}>
          Página {pagSegura} de {totalPaginas}
        </span>

        <button
          type="button"
          disabled={pagSegura >= totalPaginas}
          onClick={() => setPaginaActual(pagSegura + 1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--borde)',
            background: pagSegura >= totalPaginas ? 'transparent' : (esMiller ? '#1e293b' : 'var(--fondo)'),
            color: esMiller ? '#f8fafc' : 'var(--texto)',
            cursor: pagSegura >= totalPaginas ? 'not-allowed' : 'pointer',
            opacity: pagSegura >= totalPaginas ? 0.4 : 1, fontSize: 12, fontWeight: 600
          }}>
          Siguiente <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}
