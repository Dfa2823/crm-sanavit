import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { getMiPerfil, cambiarPassword } from '../../api/perfil'
import { formatFechaSoloFecha } from '../../utils/formatFechaEC'

function Spinner() {
  return (
    <div className='flex items-center justify-center h-32'>
      <div className='w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin' />
    </div>
  )
}

export default function PerfilPage() {
  const { usuario } = useAuth()
  const [perfil, setPerfil]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ password_actual: '', password_nuevo: '', password_confirmar: '' })
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState({ tipo: '', texto: '' })
  const [verPass, setVerPass] = useState(false)

  useEffect(() => {
    getMiPerfil().then(setPerfil).catch(() => setPerfil(null)).finally(() => setLoading(false))
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (form.password_nuevo !== form.password_confirmar) {
      setMsg({ tipo: 'error', texto: 'Las contrasenas no coinciden' }); return
    }
    setGuardando(true); setMsg({ tipo: '', texto: '' })
    try {
      const res = await cambiarPassword(form)
      setMsg({ tipo: 'ok', texto: res.mensaje || 'Contrasena actualizada' })
      setForm({ password_actual: '', password_nuevo: '', password_confirmar: '' })
    } catch (err) {
      setMsg({ tipo: 'error', texto: err.response?.data?.error || 'Error al cambiar contrasena' })
    } finally { setGuardando(false) }
  }

  const ini = (perfil?.nombre || usuario?.nombre || '?')[0]?.toUpperCase()
  const ROL_LABEL = perfil?.rol_label || usuario?.rol_label || perfil?.rol || usuario?.rol

  return (
    <div className='p-6 max-w-3xl mx-auto space-y-6'>
      <h1 className='text-2xl font-bold text-gray-800'>Mi Perfil</h1>
      {loading ? <Spinner /> : (
        <>
          <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6'>
            <div className='flex items-center gap-5'>
              <div className='w-16 h-16 rounded-full bg-teal-500 text-white flex items-center justify-center text-2xl font-bold'>
                {ini}
              </div>
              <div>
                <h2 className='text-xl font-bold text-gray-800'>{perfil?.nombre || usuario?.nombre}</h2>
                <p className='text-sm text-gray-500 font-mono'>@{perfil?.username || '---'}</p>
                <div className='mt-1 flex gap-2'>
                  <span className='text-xs font-medium px-2 py-1 rounded-full bg-teal-100 text-teal-800'>{ROL_LABEL}</span>
                  {perfil?.sala_nombre && <span className='text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600'>{perfil.sala_nombre}</span>}
                </div>
              </div>
            </div>
            <div className='mt-6 grid grid-cols-2 gap-4 border-t pt-4'>
              {[
                ['Nombre', perfil?.nombre],
                ['Usuario', perfil?.username ? '@' + perfil.username : '---'],
                ['Sala', perfil?.sala_nombre || '---'],
                ['Ciudad', perfil?.sala_ciudad || '---'],
                ['Estado', perfil?.activo ? 'Activo' : 'Inactivo'],
                ['Desde', perfil?.created_at ? formatFechaSoloFecha(perfil.created_at) : '---'],
              ].map(([label, val]) => (
                <div key={label}>
                  <p className='text-xs text-gray-400 uppercase'>{label}</p>
                  <p className='text-sm font-medium text-gray-800'>{val || '---'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6'>
            <h3 className='font-semibold text-gray-700 mb-4'>Cambiar Contrasena</h3>
            <form onSubmit={handleSubmit} className='space-y-4 max-w-sm'>
              {[
                ['password_actual', 'Contrasena actual'],
                ['password_nuevo', 'Nueva contrasena (min. 6)'],
                ['password_confirmar', 'Confirmar nueva contrasena'],
              ].map(([field, label]) => (
                <div key={field}>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>{label} *</label>
                  <input
                    type={verPass ? 'text' : 'password'}
                    required
                    value={form[field]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'
                  />
                </div>
              ))}
              <label className='flex items-center gap-2 text-xs text-gray-500 cursor-pointer'>
                <input type='checkbox' checked={verPass} onChange={e => setVerPass(e.target.checked)} />
                Mostrar contrasenas
              </label>
              {msg.texto && (
                <div className={'p-3 rounded-lg text-sm border ' + (msg.tipo === 'ok' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700')}>
                  {msg.texto}
                </div>
              )}
              <button type='submit' disabled={guardando}
                className='w-full bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium'>
                {guardando ? 'Guardando...' : 'Cambiar Contrasena'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
