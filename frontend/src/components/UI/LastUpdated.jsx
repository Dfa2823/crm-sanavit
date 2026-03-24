import { useState, useEffect } from 'react'

/**
 * Muestra "Ultima actualizacion: hace X min" con icono de reloj.
 * Se actualiza cada segundo para mantener el tiempo relativo preciso.
 *
 * @param {{ timestamp: Date | null }} props
 */
export default function LastUpdated({ timestamp }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  if (!timestamp) return null

  const segs = Math.floor((Date.now() - timestamp.getTime()) / 1000)

  let texto
  if (segs < 5)        texto = 'justo ahora'
  else if (segs < 60)  texto = `hace ${segs}s`
  else if (segs < 3600) {
    const min = Math.floor(segs / 60)
    texto = `hace ${min} min`
  } else {
    const hrs = Math.floor(segs / 3600)
    texto = `hace ${hrs}h`
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-400">
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
      <span>Ultima actualizacion: {texto}</span>
    </div>
  )
}
