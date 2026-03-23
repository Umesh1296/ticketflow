import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, RefreshCw, RotateCcw, Search, Zap, ShieldCheck } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'
import SLACountdown from '../components/SLACountdown.jsx'
import TicketDetailsModal from '../components/TicketDetailsModal.jsx'
import { formatCategoryLabel, TICKET_CATEGORIES } from '../lib/taxonomy.js'

const CATEGORIES = ['All', ...TICKET_CATEGORIES]
const PRIORITIES = ['All', 'critical', 'high', 'medium', 'low']
const STATUSES = ['All', 'open', 'assigned', 'in_progress', 'resolved', 'closed']

export default function Tickets({ API, addToast, onRefresh, refreshKey }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ priority: 'All', status: 'All', category: 'All' })
  const [actionLoading, setActionLoading] = useState(null)
  const [selectedTicket, setSelectedTicket] = useState(null)

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true)
      const params = {}
      if (filters.priority !== 'All') params.priority = filters.priority
      if (filters.status !== 'All') params.status = filters.status
      if (filters.category !== 'All') params.category = filters.category
      const { data } = await API.get('/tickets', { params })
      setTickets(data.data || [])
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to load tickets'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, filters, addToast])

  useEffect(() => {
    fetchTickets()
  }, [fetchTickets, refreshKey])

  const filteredTickets = tickets.filter(
    (ticket) => !search || ticket.title.toLowerCase().includes(search.toLowerCase()) || ticket.reporter_name?.toLowerCase().includes(search.toLowerCase()) || ticket.display_id?.toLowerCase().includes(search.toLowerCase()),
  )

  const updateStatus = async (id, status) => {
    setActionLoading(`${id}-${status}`)
    try {
      await API.put(`/tickets/${id}`, { status })
      addToast(`Ticket marked as ${status}`, 'success')
      fetchTickets()
      onRefresh()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to update ticket'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const reassign = async (id) => {
    setActionLoading(`${id}-reassign`)
    try {
      const { data } = await API.post(`/tickets/${id}/reassign`)
      addToast(data.message, 'success')
      fetchTickets()
      onRefresh()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Reassignment failed'), 'error')
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Tickets</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} shown
          </p>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tickets..." style={{ paddingLeft: 32 }} />
          </div>

          <select value={filters.priority} onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))} style={{ width: 150 }}>
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority === 'All' ? 'All Priorities' : priority.charAt(0).toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>

          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} style={{ width: 140 }}>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === 'All' ? 'All Statuses' : status.replace('_', ' ')}
              </option>
            ))}
          </select>

          <select value={filters.category} onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))} style={{ width: 160 }}>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category === 'All' ? 'All Categories' : formatCategoryLabel(category)}
              </option>
            ))}
          </select>

          {(filters.priority !== 'All' || filters.status !== 'All' || filters.category !== 'All' || search) && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setFilters({ priority: 'All', status: 'All', category: 'All' }); setSearch('') }}>
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="card table-scroll">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-muted)' }}>Loading tickets...</span>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 18, marginBottom: 8 }}>No tickets found</div>
            No tickets found.
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Ticket</th>
                <th>Category</th>
                <th>Status</th>
                <th>Assigned To</th>
                <th>SLA</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map((ticket) => {
                const sla = ticket.sla_status || {}
                return (
                  <tr key={ticket.id} onClick={() => setSelectedTicket(ticket)} style={{ cursor: 'pointer' }}>
                    <td><span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span></td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{ticket.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {ticket.display_id || '#' + ticket.id.substring(0, 8).toUpperCase()} • by {ticket.reporter_name} - {new Date(ticket.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td><span className="skill-tag">{formatCategoryLabel(ticket.category)}</span></td>
                    <td><span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span></td>
                    <td style={{ fontSize: 12 }}>
                      {ticket.operator_name ? <span style={{ color: 'var(--amber)' }}>{ticket.operator_name}</span> : <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>}
                    </td>
                    <td>
                      <SLACountdown deadline={ticket.sla_deadline} status={ticket.status} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {!['resolved', 'closed'].includes(ticket.status) && (
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, 'resolved') }} disabled={actionLoading === `${ticket.id}-resolved`} title="Mark as resolved">
                            <CheckCircle size={11} />
                          </button>
                        )}
                        {ticket.status === 'assigned' && (
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, 'in_progress') }} disabled={actionLoading === `${ticket.id}-in_progress`} title="Mark in progress">
                            <Zap size={11} />
                          </button>
                        )}
                        {!['resolved', 'closed'].includes(ticket.status) && (
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); reassign(ticket.id) }} disabled={actionLoading === `${ticket.id}-reassign`} title="Auto-reassign">
                            <RotateCcw size={11} />
                          </button>
                        )}
                        {ticket.status !== 'closed' && (
                          <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); updateStatus(ticket.id, 'closed') }} disabled={actionLoading === `${ticket.id}-closed`} title="Close ticket">
                            <ShieldCheck size={11} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {selectedTicket && (
        <TicketDetailsModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  )
}
