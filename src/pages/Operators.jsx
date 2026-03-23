import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, RefreshCw, Trash2, Wifi, WifiOff, Zap } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel, TICKET_CATEGORIES } from '../lib/taxonomy.js'

const ALL_SKILLS = TICKET_CATEGORIES

export default function Operators({ API, addToast, onRefresh, refreshKey }) {
  const [operators, setOperators] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [lastCredentials, setLastCredentials] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', skills: [], max_load: 5, status: 'available' })
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)

  const fetchOperators = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await API.get('/operators')
      setOperators(data.data || [])
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to load operators'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, addToast])

  useEffect(() => {
    fetchOperators()
  }, [fetchOperators, refreshKey])

  const handleAddOperator = async () => {
    if (!form.name || !form.email || form.skills.length === 0) {
      addToast('Please fill all fields and select at least one skill', 'error')
      return
    }

    setSaving(true)
    try {
      const { data } = await API.post('/operators', form)
      const credentials = data.data?.credentials || null
      addToast(`Agent ${form.name} added`, 'success')
      setLastCredentials(credentials)
      setForm({ name: '', email: '', password: '', skills: [], max_load: 5, status: 'available' })
      setShowForm(false)
      fetchOperators()
      onRefresh()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to add operator'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id, status) => {
    setActionLoading(`status-${id}-${status}`)
    try {
      await API.put(`/operators/${id}`, { status })
      addToast(`Status updated to ${status}`, 'success')
      fetchOperators()
      onRefresh()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to update status'), 'error')
    }
    finally {
      setActionLoading(null)
    }
  }

  const deleteOperator = async (operator) => {
    const confirmed = window.confirm(
      `Remove ${operator.name} from TicketFlow?\n\nThis removes login access immediately. Active assigned tickets will be reassigned or moved to the queue.`,
    )

    if (!confirmed) {
      return
    }

    setActionLoading(`delete-${operator.id}`)
    try {
      const { data } = await API.delete(`/operators/${operator.id}`)
      addToast(data.message || 'Agent removed successfully', 'success')
      setLastCredentials(null)
      fetchOperators()
      onRefresh()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to remove operator'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const resetPassword = async (operator) => {
    setActionLoading(`reset-${operator.id}`)
    try {
      const { data } = await API.post(`/operators/${operator.id}/reset-password`)
      setLastCredentials({
        mode: 'reset',
        name: data.data?.operator?.name || operator.name,
        email: data.data?.credentials?.email || operator.email,
        password: data.data?.credentials?.password || '',
      })
      addToast(data.message || 'Password reset successfully', 'success')
      fetchOperators()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to reset operator password'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const toggleSkill = (skill) => {
    setForm((current) => ({
      ...current,
      skills: current.skills.includes(skill) ? current.skills.filter((item) => item !== skill) : [...current.skills, skill],
    }))
  }

  const statusColor = { available: 'var(--green)', busy: 'var(--amber)', offline: 'var(--text-muted)' }
  const statusIcon = { available: Wifi, busy: Zap, offline: WifiOff }

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Support Agents</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{operators.length} agents registered</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowForm((current) => !current)}>
            <Plus size={14} /> Add Agent
          </button>
        </div>
      </div>

      {lastCredentials && (
        <div className="card operator-credentials-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <KeyRound size={15} color="var(--accent)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>
              {lastCredentials.mode === 'reset' ? 'Share The Updated Agent Login Details' : 'Share These Agent Login Details'}
            </h3>
          </div>
          {lastCredentials.name && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{lastCredentials.name}</div>}
          <div className="responsive-two-col">
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Email</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{lastCredentials.email}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Password</div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 13 }}>{lastCredentials.password}</div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--accent)' }}>New Support Agent</h3>
          <div className="responsive-two-col" style={{ marginBottom: 12 }}>
            <div>
              <label>Full Name *</label>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Sarah Johnson" />
            </div>
            <div>
              <label>Email *</label>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="sarah@support.com" />
            </div>
            <div>
              <label>Temporary Password</label>
              <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to use the server default password" />
            </div>
            <div>
              <label>Max Ticket Load</label>
              <input type="number" min="1" max="20" value={form.max_load} onChange={(event) => setForm((current) => ({ ...current, max_load: Number.parseInt(event.target.value, 10) || 1 }))} />
            </div>
            <div>
              <label>Initial Status</label>
              <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Skills * (select all that apply)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {ALL_SKILLS.map((skill) => (
                <button
                  key={skill}
                  type="button"
                  onClick={() => toggleSkill(skill)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 20,
                    fontSize: 12,
                    border: `1px solid ${form.skills.includes(skill) ? 'var(--accent)' : 'var(--border)'}`,
                    background: form.skills.includes(skill) ? 'var(--accent-glow)' : 'transparent',
                    color: form.skills.includes(skill) ? 'var(--accent-light)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontFamily: 'var(--mono)',
                    transition: 'all 0.15s',
                  }}
                >
                  {formatCategoryLabel(skill)}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleAddOperator} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Plus size={14} />}
              {saving ? 'Adding...' : 'Add Agent'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading operators...</span>
        </div>
      ) : (
        <div className="operator-grid">
          {operators.map((operator) => {
            const StatusIcon = statusIcon[operator.status] || Wifi
            const loadPct = operator.load_percentage || 0
            const isCritical = loadPct >= 80

            return (
              <div key={operator.id} className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: operator.status === 'offline' ? 'var(--bg-hover)' : 'var(--accent-glow)', border: `2px solid ${statusColor[operator.status] || 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: operator.status === 'offline' ? 'var(--text-muted)' : 'var(--accent-light)', flexShrink: 0 }}>
                    {operator.name.charAt(0)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {operator.display_id ? <span style={{ color: 'var(--accent)', marginRight: 6 }}>{operator.display_id}</span> : null}
                      {operator.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{operator.email}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <StatusIcon size={10} color={statusColor[operator.status]} />
                      <span style={{ fontSize: 11, color: statusColor[operator.status], fontWeight: 600, textTransform: 'capitalize' }}>{operator.status}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {['available', 'busy', 'offline'].map((status) => (
                      status !== operator.status && (
                        <button key={status} className="btn btn-secondary btn-sm" onClick={() => updateStatus(operator.id, status)} disabled={actionLoading === `status-${operator.id}-${status}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                          {status}
                        </button>
                      )
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Workload</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isCritical ? 'var(--red)' : 'var(--text-secondary)' }}>
                      {operator.current_load}/{operator.max_load} tickets
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {Array.from({ length: Math.min(operator.max_load, 10) }).map((_, index) => (
                      <div key={index} style={{ flex: 1, height: 10, borderRadius: 2, background: index < operator.current_load ? (isCritical ? 'var(--red)' : 'var(--accent)') : 'var(--border)' }} />
                    ))}
                    {operator.max_load > 10 && <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>+{operator.max_load - 10}</span>}
                  </div>
                  <div style={{ fontSize: 10, color: isCritical ? 'var(--red)' : 'var(--text-muted)', marginTop: 4 }}>
                    {loadPct}% capacity - {operator.available_slots} slot{operator.available_slots !== 1 ? 's' : ''} free
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Skills</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(operator.skills || []).map((skill) => (
                      <span key={skill} className="skill-tag">{formatCategoryLabel(skill)}</span>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(operator)} disabled={actionLoading === `reset-${operator.id}`}>
                    {actionLoading === `reset-${operator.id}` ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <KeyRound size={12} />}
                    Reset Password
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => deleteOperator(operator)} disabled={actionLoading === `delete-${operator.id}`} style={{ color: 'var(--red)', borderColor: 'rgba(248,81,73,0.28)' }}>
                    {actionLoading === `delete-${operator.id}` ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={12} />}
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
