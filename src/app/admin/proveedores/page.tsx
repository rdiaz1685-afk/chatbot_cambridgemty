'use client'

import { useEffect, useState } from 'react'

interface PropuestaProveedor {
  id: string
  empresa: string
  descripcion: string
  sitioWeb: string
  contacto: string
  revisada: boolean
  notas: string | null
  creadaEn: string
}

export default function AdminProveedoresPage() {
  const [propuestas, setPropuestas] = useState<PropuestaProveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<'todas' | 'pendientes' | 'revisadas'>('todas')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [notasTemp, setNotasTemp] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [eliminandoId, setEliminandoId] = useState<string | null>(null)

  const fetchPropuestas = async () => {
    setLoading(true)
    try {
      const url = filtro === 'pendientes'
        ? '/api/admin/proveedores?pendientes=true'
        : '/api/admin/proveedores'
      const res = await fetch(url)
      const data = await res.json()
      let lista: PropuestaProveedor[] = data.propuestas || []
      if (filtro === 'revisadas') lista = lista.filter(p => p.revisada)
      if (filtro === 'pendientes') lista = lista.filter(p => !p.revisada)
      setPropuestas(lista)
    } catch {
      console.error('Error al cargar propuestas')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPropuestas() }, [filtro])

  const toggleRevisada = async (id: string, revisada: boolean) => {
    await fetch('/api/admin/proveedores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, revisada: !revisada }),
    })
    fetchPropuestas()
  }

  const guardarNotas = async (id: string) => {
    await fetch('/api/admin/proveedores', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, notas: notasTemp }),
    })
    setEditandoId(null)
    fetchPropuestas()
  }

  const eliminar = async (id: string) => {
    await fetch(`/api/admin/proveedores?id=${id}`, { method: 'DELETE' })
    setEliminandoId(null)
    fetchPropuestas()
  }

  const propuestasFiltradas = propuestas.filter(p =>
    p.empresa.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.contacto.toLowerCase().includes(busqueda.toLowerCase())
  )

  const total = propuestas.length
  const pendientes = propuestas.filter(p => !p.revisada).length
  const revisadas = propuestas.filter(p => p.revisada).length

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              🤝
            </div>
            <div>
              <h1 style={{ color: '#f8fafc', fontSize: 18, fontWeight: 700, margin: 0 }}>Panel de Proveedores</h1>
              <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>Colegio Cambridge de Monterrey</p>
            </div>
          </div>
          <button
            onClick={fetchPropuestas}
            style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc', padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            🔄 Actualizar
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Recibidas', valor: total, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', icon: '📋' },
            { label: 'Pendientes', valor: pendientes, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: '⏳' },
            { label: 'Revisadas', valor: revisadas, color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: '✅' },
          ].map(stat => (
            <div key={stat.label} style={{ background: stat.bg, border: `1px solid ${stat.color}33`, borderRadius: 16, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>{stat.icon}</div>
              <div>
                <div style={{ color: stat.color, fontSize: 28, fontWeight: 800, lineHeight: 1 }}>{stat.valor}</div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros y Búsqueda */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['todas', 'pendientes', 'revisadas'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFiltro(f)}
                style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all 0.2s',
                  background: filtro === f ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'rgba(255,255,255,0.05)',
                  color: filtro === f ? '#fff' : '#94a3b8',
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="🔍 Buscar empresa, descripción o contacto..."
            style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#f8fafc', fontSize: 13, outline: 'none' }}
          />
        </div>

        {/* Lista de Propuestas */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⏳</div>
            <p>Cargando propuestas...</p>
          </div>
        ) : propuestasFiltradas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📭</div>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#cbd5e1' }}>No hay propuestas</p>
            <p style={{ fontSize: 13, marginTop: 6 }}>
              {busqueda ? 'No se encontraron resultados para tu búsqueda.' : 'Aún no se han recibido propuestas de proveedores.'}
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {propuestasFiltradas.map(p => (
              <div
                key={p.id}
                style={{
                  background: p.revisada ? 'rgba(16,185,129,0.04)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${p.revisada ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  padding: 24,
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Cabecera */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                      🏢
                    </div>
                    <div>
                      <h3 style={{ color: '#f8fafc', fontSize: 16, fontWeight: 700, margin: 0 }}>{p.empresa}</h3>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {new Date(p.creadaEn).toLocaleDateString('es-MX', {
                          day: '2-digit', month: 'long', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                      background: p.revisada ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                      color: p.revisada ? '#10b981' : '#f59e0b',
                      border: `1px solid ${p.revisada ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                      {p.revisada ? '✅ Revisada' : '⏳ Pendiente'}
                    </span>
                  </div>
                </div>

                {/* Datos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📝 Descripción</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{p.descripcion}</div>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>🌐 Sitio Web</div>
                    <a href={p.sitioWeb} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', fontSize: 13, textDecoration: 'none', wordBreak: 'break-all' }}>
                      {p.sitioWeb}
                    </a>
                  </div>
                  <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📞 Contacto</div>
                    <div style={{ color: '#e2e8f0', fontSize: 13 }}>{p.contacto}</div>
                  </div>
                </div>

                {/* Notas */}
                {editandoId === p.id ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📌 Notas internas</div>
                    <textarea
                      value={notasTemp}
                      onChange={e => setNotasTemp(e.target.value)}
                      placeholder="Agrega notas para el área de compras..."
                      style={{ width: '100%', minHeight: 80, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(99,102,241,0.4)', borderRadius: 8, padding: 10, color: '#f8fafc', fontSize: 13, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => guardarNotas(p.id)} style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                        💾 Guardar
                      </button>
                      <button onClick={() => setEditandoId(null)} style={{ background: 'rgba(255,255,255,0.05)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.1)', padding: '7px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : p.notas ? (
                  <div style={{ marginBottom: 16, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 10, padding: 12 }}>
                    <div style={{ color: '#64748b', fontSize: 11, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>📌 Notas internas</div>
                    <div style={{ color: '#c7d2fe', fontSize: 13 }}>{p.notas}</div>
                  </div>
                ) : null}

                {/* Acciones */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => toggleRevisada(p.id, p.revisada)}
                    style={{
                      padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                      background: p.revisada ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)',
                      color: p.revisada ? '#f59e0b' : '#10b981',
                    }}
                  >
                    {p.revisada ? '↩️ Marcar pendiente' : '✅ Marcar revisada'}
                  </button>
                  <button
                    onClick={() => { setEditandoId(p.id); setNotasTemp(p.notas || '') }}
                    style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontWeight: 600 }}
                  >
                    📝 {p.notas ? 'Editar nota' : 'Agregar nota'}
                  </button>
                  <a
                    href={p.sitioWeb} target="_blank" rel="noopener noreferrer"
                    style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(129,140,248,0.1)', border: '1px solid rgba(129,140,248,0.2)', color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}
                  >
                    🌐 Ver propuesta
                  </a>
                  {eliminandoId === p.id ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ color: '#f87171', fontSize: 12 }}>¿Confirmar eliminación?</span>
                      <button onClick={() => eliminar(p.id)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171', fontWeight: 600 }}>Sí, eliminar</button>
                      <button onClick={() => setEliminandoId(null)} style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#64748b' }}>Cancelar</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEliminandoId(p.id)}
                      style={{ padding: '7px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)', color: '#f87171', fontWeight: 600, marginLeft: 'auto' }}
                    >
                      🗑️ Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
