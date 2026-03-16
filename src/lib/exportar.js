// ===== EXCEL (CSV compatible con Excel) =====
export function exportarCSV(nombreArchivo, filas) {
  const csv = filas.map(f =>
    f.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\n')
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// ===== PDF =====
export async function exportarPDF(nombreArchivo, contenidoHtml, estilos = '') {
  const ventana = window.open('', '_blank')
  ventana.document.write(`
    <html>
      <head>
        <title>${nombreArchivo}</title>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'DM Sans', sans-serif; font-size: 12px; color: #1A1A1A; padding: 24px; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          h2 { font-size: 14px; font-weight: 600; margin: 16px 0 8px; }
          p  { font-size: 12px; color: #666; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #FF6B00; color: white; padding: 7px 10px; text-align: left; font-size: 11px; }
          td { padding: 6px 10px; border-bottom: 1px solid #EBEBEB; font-size: 11px; }
          tr:nth-child(even) td { background: #FAFAF8; }
          .naranja { color: #FF6B00; font-weight: 700; }
          .verde   { color: #2E7D32; font-weight: 600; }
          .rojo    { color: #C62828; font-weight: 600; }
          .badge   { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 10px; font-weight: 600; }
          .badge-naranja { background: #FFF0E6; color: #E05A00; }
          .badge-verde   { background: #E8F5E9; color: #2E7D32; }
          .badge-rojo    { background: #FFEBEE; color: #C62828; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #FF6B00; padding-bottom: 12px; }
          .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
          .stat-card { background: #FAFAF8; border-radius: 8px; padding: 10px 14px; border: 1px solid #EBEBEB; }
          .stat-val  { font-size: 20px; font-weight: 800; color: #FF6B00; }
          .stat-lbl  { font-size: 10px; color: #666; margin-top: 2px; }
          .bar-wrap  { display: flex; align-items: flex-end; gap: 4px; height: 80px; margin: 8px 0 20px; }
          .bar       { flex: 1; background: #FF6B00; border-radius: 3px 3px 0 0; min-height: 2px; }
          .bar-lbl   { font-size: 9px; color: #666; text-align: center; margin-top: 3px; }
          .bar-col   { display: flex; flex-direction: column; align-items: center; flex: 1; }
          .bar-val   { font-size: 9px; color: #FF6B00; font-weight: 600; }
          .restock   { background: #FFF3E0; border: 1px solid #FFCC80; border-radius: 8px; padding: 8px 12px; margin-bottom: 6px; display: flex; justify-content: space-between; }
          @media print {
            body { padding: 0; }
            button { display: none; }
          }
          ${estilos}
        </style>
      </head>
      <body>${contenidoHtml}</body>
    </html>
  `)
  ventana.document.close()
  await new Promise(r => setTimeout(r, 800))
  ventana.print()
}
