import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardList, Plus, RefreshCw, Search, TicketCheck, UserRound } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import { formatCategoryLabel } from '../lib/taxonomy.js'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'

const STATUS_FILTERS = ['all', 'open', 'assigned', 'in_progress', 'resolved', 'closed']

export default function EmployeeTickets({ API, addToast, currentUser, onCreateTicket, refreshKey }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedTicket, setSelectedTicket] = useState(null)

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await API.get('/tickets')
      setTickets(data.data || [])
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Unable to load your tickets'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, addToast])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets, refreshKey])

  const filteredTickets = useMemo(
    () => tickets.filter((ticket) => {
      const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter
      const matchesSearch = !search
        || ticket.title.toLowerCase().includes(search.toLowerCase())
        || ticket.description.toLowerCase().includes(search.toLowerCase())
        || ticket.display_id?.toLowerCase().includes(search.toLowerCase())
        || ticket.operator_name?.toLowerCase().includes(search.toLowerCase())

      return matchesStatus && matchesSearch
    }),
    [search, statusFilter, tickets],
  )

  const stats = useMemo(() => ({
    total: tickets.length,
    active: tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status)).length,
    resolved: tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length,
  }), [tickets])

  return (
    <div className="fade-in">
      <div className="card employee-hero">
        <div>
          <div className="auth-badge" style={{ marginBottom: 14 }}>
            <TicketCheck size={14} />
            End User Ticket Portal
          </div>
          <h1 style={{ fontSize: 28, lineHeight: 1.1, marginBottom: 10 }}>Track the tickets you have raised</h1>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
          <div className="employee-user-card">
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--amber-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserRound size={16} color="var(--amber)" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{currentUser?.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{currentUser?.email}</div>
            </div>
          </div>

          <button className="btn btn-primary" onClick={onCreateTicket}>
            <Plus size={14} />
            Raise New Ticket
          </button>
        </div>
      </div>

      <div className="employee-stats">
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Total Tickets</div>
          <div className="stat-number" style={{ fontSize: 26 }}>{stats.total}</div>
        </div>
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Active Issues</div>
          <div className="stat-number" style={{ fontSize: 26, color: 'var(--amber)' }}>{stats.active}</div>
        </div>
        <div className="card employee-stat-card">
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Resolved</div>
          <div className="stat-number" style={{ fontSize: 26, color: 'var(--green)' }}>{stats.resolved}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your tickets..." style={{ paddingLeft: 32 }} />
          </div>

          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ width: 170 }}>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {status === 'all' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading your tickets...</span>
        </div>
      ) : filteredTickets.length === 0 ? (
        <div className="card employee-empty-state">
          <ClipboardList size={30} style={{ opacity: 0.45 }} />
          <div>
            <div style={{ fontSize: 18, marginBottom: 6 }}>No tickets found</div>
            <div style={{ color: 'var(--text-muted)' }}>Raise a new ticket and it will appear here with status and assignment details.</div>
          </div>
        </div>
      ) : (
        <div className="employee-ticket-grid">
          {filteredTickets.map((ticket) => {
            const assignedLabel = ticket.operator_name || 'Waiting for assignment'
            const assignedEmail = ticket.operator_email || 'An operator will be assigned soon'
            const slaLabel = ticket.sla_status?.label || 'SLA pending'

            return (
              <div key={ticket.id} className="card employee-ticket-card" onClick={() => setSelectedTicket(ticket)} style={{ cursor: 'pointer' }}>
                <div className="employee-ticket-top">
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>{ticket.title}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{ticket.display_id || '#' + ticket.id.substring(0, 8).toUpperCase()} • {ticket.description}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
                    <span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="employee-ticket-meta">
                  <span className="skill-tag">{formatCategoryLabel(ticket.category)}</span>
                  <span className="employee-meta-chip">Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                  <span className="employee-meta-chip"><SLACountdown deadline={ticket.sla_deadline} status={ticket.status} /></span>
                </div>

                <div className="employee-assignment-card">
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Assigned To</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: ticket.operator_name ? 'var(--amber)' : 'var(--text-primary)' }}>{assignedLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{assignedEmail}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selectedTicket && (
        <TicketDetailsModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  )
}
