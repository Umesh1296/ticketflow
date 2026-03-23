import { useCallback, useEffect, useState } from 'react'
import { CheckCircle2, Clock3, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, Users } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function Employees({ API, addToast, onRefresh, refreshKey }) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [lastCredentials, setLastCredentials] = useState(null)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await API.get('/employees')
      setEmployees(data.data || [])
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to load employees'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, addToast])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees, refreshKey])

  const handleAddEmployee = async () => {
    if (!form.name.trim() || !form.email.trim()) {
      addToast('Please enter the employee name and email', 'error')
      return
    }

    setSaving(true)
    try {
      const { data } = await API.post('/employees', {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      })

      setLastCredentials({
        mode: 'created',
        name: data.data?.employee?.name || form.name.trim(),
        email: data.data?.credentials?.email || form.email.trim(),
        password: data.data?.credentials?.password || form.password,
      })
      setForm({ name: '', email: '', password: '' })
      setShowForm(false)
      addToast(data.message || 'End user created successfully', 'success')
      fetchEmployees()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to create employee'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async (employee) => {
    setActionLoading(`reset-${employee.id}`)
    try {
      const { data } = await API.post(`/employees/${employee.id}/reset-password`)
      setLastCredentials({
        mode: 'reset',
        name: data.data?.employee?.name || employee.name,
        email: data.data?.credentials?.email || employee.email,
        password: data.data?.credentials?.password || '',
      })
      addToast(data.message || 'Password reset successfully', 'success')
      fetchEmployees()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to reset employee password'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const deleteEmployee = async (employee) => {
    const confirmed = window.confirm(
      `Remove ${employee.name} from TicketFlow?\n\nThis removes login access immediately. Existing tickets will stay in history.`,
    )

    if (!confirmed) {
      return
    }

    setActionLoading(`delete-${employee.id}`)
    try {
      const { data } = await API.delete(`/employees/${employee.id}`)
      addToast(data.message || 'End user removed successfully', 'success')
      setLastCredentials(null)
      fetchEmployees()
      onRefresh?.()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to remove employee'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>End Users</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {employees.length} end user{employees.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => setShowForm((current) => !current)}>
            <Plus size={14} />
            Add End User
          </button>
        </div>
      </div>

      {lastCredentials && (
        <div className="card operator-credentials-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <KeyRound size={15} color="var(--accent)" />
            <h3 style={{ fontSize: 14, fontWeight: 600 }}>
              {lastCredentials.mode === 'reset' ? 'Share The Updated End User Login Details' : 'Share These End User Login Details'}
            </h3>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{lastCredentials.name}</div>
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
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--accent)' }}>New End User</h3>
          <div className="responsive-two-col" style={{ marginBottom: 16 }}>
            <div>
              <label>Full Name *</label>
              <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="e.g. Priya Raman" />
            </div>
            <div>
              <label>Email *</label>
              <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="priya@company.com" />
            </div>
            <div>
              <label>Temporary Password</label>
              <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Leave blank to use the default employee password" />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleAddEmployee} disabled={saving}>
              {saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : <Plus size={14} />}
              {saving ? 'Creating...' : 'Create End User'}
            </button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading employees...</span>
        </div>
      ) : employees.length === 0 ? (
        <div className="card employee-empty-state">
          <Users size={30} style={{ opacity: 0.45 }} />
          <div>
            <div style={{ fontSize: 18, marginBottom: 6 }}>No end users added yet</div>
            <div style={{ color: 'var(--text-muted)' }}>Create an end user account and share the login credentials.</div>
          </div>
        </div>
      ) : (
        <div className="operator-grid">
          {employees.map((employee) => (
            <div key={employee.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-glow)', border: '2px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>
                  {employee.name.charAt(0)}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {employee.display_id ? <span style={{ color: 'var(--accent)', marginRight: 6 }}>{employee.display_id}</span> : null}
                    {employee.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{employee.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ShieldCheck size={10} color="var(--green)" />
                    <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 600 }}>{employee.provider === 'local' ? 'Local' : employee.provider}</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tickets</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {employee.total_tickets} total
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 3 }}>
                  {Array.from({ length: Math.max(employee.total_tickets, 1) }).slice(0, 10).map((_, index) => (
                    <div key={index} style={{ flex: 1, height: 10, borderRadius: 2, background: index < employee.active_tickets ? 'var(--amber)' : index < employee.active_tickets + employee.resolved_tickets ? 'var(--green)' : 'var(--border)' }} />
                  ))}
                  {employee.total_tickets > 10 && <span style={{ fontSize: 10, color: 'var(--text-muted)', alignSelf: 'center', marginLeft: 4 }}>+{employee.total_tickets - 10}</span>}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  {employee.active_tickets} active · {employee.resolved_tickets} resolved
                </div>
              </div>

              <div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Activity</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {employee.last_ticket_at
                    ? `Last ticket on ${new Date(employee.last_ticket_at).toLocaleDateString()}`
                    : 'No tickets raised yet'}
                </div>
                {employee.created_at && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Joined {new Date(employee.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => resetPassword(employee)} disabled={actionLoading === `reset-${employee.id}`}>
                  {actionLoading === `reset-${employee.id}` ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <KeyRound size={12} />}
                  Reset Password
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => deleteEmployee(employee)} disabled={actionLoading === `delete-${employee.id}`} style={{ color: 'var(--red)', borderColor: 'rgba(248,81,73,0.28)' }}>
                  {actionLoading === `delete-${employee.id}` ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={12} />}
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
