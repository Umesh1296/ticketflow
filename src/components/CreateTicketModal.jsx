import { useMemo, useState } from 'react'
import { AlertTriangle, X, Zap } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel, TICKET_CATEGORIES } from '../lib/taxonomy.js'

const PRIORITIES = ['critical', 'high', 'medium', 'low']

const PRIORITY_DESCRIPTIONS = {
  critical: 'System down, business halted. SLA: 1 hour',
  high: 'Major impact, workaround possible. SLA: 4 hours',
  medium: 'Partial disruption. SLA: 24 hours',
  low: 'Minor issue, no urgency. SLA: 72 hours',
}

export default function CreateTicketModal({ API, currentUser, onClose, onSuccess, onError }) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'technical',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const submitPayload = useMemo(() => ({
    title: form.title,
    description: form.description,
    priority: form.priority,
    category: form.category,
  }), [form])

  const handleSubmit = async () => {
    if (!currentUser) {
      onError('Please login again and retry')
      return
    }

    if (!form.title || !form.description) {
      onError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const { data } = await API.post('/tickets', submitPayload)
      setResult(data)
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      onError(getFriendlyErrorMessage(err, 'Failed to create ticket'))
    } finally {
      setLoading(false)
    }
  }

  if (result) {
    const assignment = result.data?.assignment

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal fade-in" onClick={(event) => event.stopPropagation()} style={{ maxWidth: 480 }}>
          <div style={{ padding: 32, textAlign: 'center' }}>
            {assignment?.success ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--green-dim)', border: '2px solid var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Zap size={24} color="var(--green)" />
                </div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ticket Raised and Assigned</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
                  Assigned to <strong style={{ color: 'var(--amber)' }}>{assignment.operator.name}</strong>
                </p>

                <div className="card" style={{ padding: 16, marginBottom: 20, textAlign: 'left' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
                    Assignment Details
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Assignment Score</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
                      {assignment.score} / 100
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {assignment.reasons?.map((reason) => (
                      <span key={reason} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                <button className="btn btn-primary" onClick={() => onSuccess(result.message)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <AlertTriangle size={32} color="var(--amber)" style={{ margin: '0 auto 16px' }} />
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Ticket Raised and Queued</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>
                  {assignment?.reason || 'No operators are available right now.'}
                </p>
                <button className="btn btn-primary" onClick={() => onSuccess(result.message || 'Ticket raised and queued')}>
                  Done
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal fade-in" onClick={(event) => event.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={16} color="var(--amber)" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Raise New Ticket</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label>Issue Title *</label>
            <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Brief summary of the issue" />
          </div>

          <div>
            <label>Description *</label>
            <textarea rows={3} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Describe the issue in detail" style={{ resize: 'vertical' }} />
          </div>

          <div className="responsive-two-col">
            <div>
              <label>Priority *</label>
              <select value={form.priority} onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value }))}>
                {PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{PRIORITY_DESCRIPTIONS[form.priority]}</div>
            </div>

            <div>
              <label>Category *</label>
              <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}>
                {TICKET_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {formatCategoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: 'var(--bg-secondary)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Raised By
            </div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser?.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{currentUser?.email}</div>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Raising...</> : <><Zap size={14} /> Raise Ticket</>}
          </button>
        </div>
      </div>
    </div>
  )
}
