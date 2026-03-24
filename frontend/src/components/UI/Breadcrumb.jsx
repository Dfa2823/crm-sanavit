import { useNavigate } from 'react-router-dom'

/**
 * Breadcrumb sutil para paginas profundas.
 * @param {{ items: Array<{ label: string, to?: string }>, onNavigate?: (to: string) => void }} props
 *
 * Si se pasa `onNavigate`, se usara en vez de navigate() para permitir confirmaciones.
 *
 * Uso:
 *   <Breadcrumb items={[
 *     { label: 'Ventas', to: '/ventas' },
 *     { label: 'Nueva Venta' },
 *   ]} />
 */
export default function Breadcrumb({ items = [], onNavigate }) {
  const navigate = useNavigate()

  function handleClick(to) {
    if (onNavigate) onNavigate(to)
    else navigate(to)
  }

  return (
    <nav className="flex items-center gap-1.5 text-xs text-gray-400 mb-1 select-none">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-gray-300">&gt;</span>}
          {item.to ? (
            <button
              onClick={() => handleClick(item.to)}
              className="hover:text-teal-600 transition-colors"
            >
              {item.label}
            </button>
          ) : (
            <span className="text-gray-500">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
