import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BellRing, BriefcaseBusiness, CheckCircle2, Clock3, RefreshCw, UserRound, Wifi, WifiOff, Zap } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'
import SLACountdown from '../components/SLACountdown.jsx'

const STATUS_TRANSITIONS = {
  assigned: { next: 'in_progress', label: 'Start Work', icon: Zap },
  in_progress: { next: 'resolved', label: 'Mark Resolved', icon: CheckCircle2 },
}

const OPERATOR_STATUS_OPTIONS = [
  { id: 'available', label: 'Available', icon: Wifi },
  { id: 'busy', label: 'Busy', icon: Clock3 },
  { id: 'offline', label: 'Offline', icon: WifiOff },
]

export default function OperatorWorkspace({ API, addToast, currentUser, refreshKey }) {
  const [tickets, setTickets] = useState([])
  const [operatorProfile, setOperatorProfile] = useState(currentUser)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [highlightedTicketIds, setHighlightedTicketIds] = useState([])
  const seenTicketIdsRef = useRef(new Set())
  const initializedRef = useRef(false)

  const fetchWorkspace = useCallback(async () => {
    try {
      if (!initializedRef.current) {
        setLoading(true)
      }
      const [ticketResponse, operatorResponse] = await Promise.all([
        API.get('/tickets'),
        API.get('/operators/me'),
      ])

      const nextTickets = ticketResponse.data.data || []
      const nextProfile = operatorResponse.data.data || currentUser
      setTickets(nextTickets)
      setOperatorProfile(nextProfile)

      const newAssignments = nextTickets.filter((ticket) => !seenTicketIdsRef.current.has(ticket.id))
      if (initializedRef.current && newAssignments.length > 0) {
        const newIds = newAssignments.map((ticket) => ticket.id)
        setHighlightedTicketIds((current) => [...new Set([...current, ...newIds])])
        addToast(
          newAssignments.length === 1
            ? `New ticket assigned: ${newAssignments[0].title}`
            : `${newAssignments.length} new tickets assigned to you`,
          'success',
        )

        window.setTimeout(() => {
          setHighlightedTicketIds((current) => current.filter((id) => !newIds.includes(id)))
        }, 8000)
      }

      seenTicketIdsRef.current = new Set(nextTickets.map((ticket) => ticket.id))
      initializedRef.current = true
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Unable to load operator workspace'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, addToast, currentUser])

  useEffect(() => {
    fetchWorkspace()
  }, [fetchWorkspace, refreshKey])

  useEffect(() => {
    const intervalId = window.setInterval(fetchWorkspace, 20000)
    return () => window.clearInterval(intervalId)
  }, [fetchWorkspace])

  const updateTicketStatus = async (ticketId, status) => {
    setActionLoading(`${ticketId}-${status}`)
    try {
      const { data } = await API.put(`/tickets/${ticketId}`, { status })
      addToast(data.message || `Ticket marked as ${status}`, 'success')
      fetchWorkspace()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Unable to update ticket status'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const updateOperatorStatus = async (status) => {
    setActionLoading(`operator-${status}`)
    try {
      const { data } = await API.put('/operators/me/status', { status })
      setOperatorProfile(data.data)
      addToast(data.message || `Status updated to ${status}`, 'success')
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Unable to update operator availability'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const ticketStats = useMemo(() => ({
    assigned: tickets.filter((ticket) => ticket.status === 'assigned').length,
    inProgress: tickets.filter((ticket) => ticket.status === 'in_progress').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
  }), [tickets])

  return (
    <div className="fade-in">
      <div className="card operator-hero">
        <div>
          <div className="auth-badge" style={{ marginBottom: 14 }}>
            <BriefcaseBusiness size={14} />
            Operator Workspace
          </div>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 10 }}>Review and manage your assigned work</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 620 }}>
            This workspace shows only the tickets assigned to you. You can start work, mark issues as resolved, and update your availability from here.
          </p>
        </div>

        <div className="operator-hero-side">
          <div className="employee-user-card">
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserRound size={16} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{operatorProfile?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{operatorProfile?.email}</div>
            </div>
          </div>

          <div className="operator-status-picker">
            {OPERATOR_STATUS_OPTIONS.map((statusOption) => {
              const Icon = statusOption.icon
              const active = operatorProfile?.status === statusOption.id
              return (
                <button
                  key={statusOption.id}
                  className={`operator-status-pill ${active ? 'active' : ''}`}
                  onClick={() => updateOperatorStatus(statusOption.id)}
                  disabled={actionLoading === `operator-${statusOption.id}`}
                >
                  <Icon size={12} />
                  {statusOption.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="employee-stats">
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Assigned</div>
          <div className="stat-number" style={{ fontSize: 26 }}>{ticketStats.assigned}</div>
        </div>
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>In Progress</div>
          <div className="stat-number" style={{ fontSize: 26, color: 'var(--accent)' }}>{ticketStats.inProgress}</div>
        </div>
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Resolved</div>
          <div className="stat-number" style={{ fontSize: 26, color: 'var(--green)' }}>{ticketStats.resolved}</div>
        </div>
      </div>

      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>My Tickets</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Auto-refresh every 20 seconds. New assignments are highlighted.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchWorkspace}>
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading assigned tickets...</span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="card employee-empty-state">
          <BellRing size={30} style={{ opacity: 0.45 }} />
          <div>
            <div style={{ fontSize: 18, marginBottom: 6 }}>No tickets assigned right now</div>
            <div style={{ color: 'var(--text-muted)' }}>New assignments will appear here automatically and will be highlighted when they arrive.</div>
          </div>
        </div>
      ) : (
        <div className="operator-ticket-grid">
          {tickets.map((ticket) => {
            const transition = STATUS_TRANSITIONS[ticket.status]
            const ActionIcon = transition?.icon
            const highlighted = highlightedTicketIds.includes(ticket.id)

            return (
              <div key={ticket.id} className={`card operator-ticket-card ${highlighted ? 'ticket-highlight' : ''}`}>
                <div className="employee-ticket-top">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{ticket.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>#{ticket.id.substring(0, 8).toUpperCase()} • {ticket.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
                    <span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="employee-ticket-meta">
                  <span className="skill-tag">{formatCategoryLabel(ticket.category)}</span>
                  <span className="employee-meta-chip">Raised by {ticket.reporter_name}</span>
                  <span className="employee-meta-chip">Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                  <span className="employee-meta-chip"><SLACountdown deadline={ticket.sla_deadline} status={ticket.status} /></span>
                </div>

                <div className="operator-ticket-footer">
                  <div className="operator-assignment-note">
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Current Focus</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{ticket.status === 'assigned' ? 'Ready to start' : ticket.status.replace('_', ' ')}</div>
                  </div>

                  {transition ? (
                    <button
                      className="btn btn-primary"
                      onClick={() => updateTicketStatus(ticket.id, transition.next)}
                      disabled={actionLoading === `${ticket.id}-${transition.next}`}
                    >
                      {actionLoading === `${ticket.id}-${transition.next}`
                        ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Updating...</>
                        : <><ActionIcon size={14} /> {transition.label}</>}
                    </button>
                  ) : (
                    <div className="operator-resolved-chip">
                      <CheckCircle2 size={14} />
                      Completed
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
