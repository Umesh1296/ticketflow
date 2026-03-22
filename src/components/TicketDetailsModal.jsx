import { X, Clock3, UserRound, BriefcaseBusiness, Calendar, ShieldAlert } from 'lucide-react'
import { formatCategoryLabel } from '../lib/taxonomy.js'
import SLACountdown from './SLACountdown.jsx'

export default function TicketDetailsModal({ ticket, onClose }) {
  if (!ticket) return null

  const assignedLabel = ticket.operator_name || 'Unassigned'
  const assignedEmail = ticket.operator_email || 'Waiting for an operator to be assigned'
  const isResolved = ['resolved', 'closed'].includes(ticket.status)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 650, width: '90%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ticket {ticket.display_id || '#' + ticket.id.substring(0, 8).toUpperCase()}</h2>
            <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
            <span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ width: 32, height: 32, padding: 0, justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 24, overflowY: 'auto' }}>
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>{ticket.title}</h3>
            <div style={{ background: 'var(--bg-secondary)', padding: 16, borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
              {ticket.description}
            </div>
          </div>

          <div className="responsive-two-col" style={{ gap: 16 }}>
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-muted)' }}>
                <UserRound size={14} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reporter Info</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>{ticket.reporter_name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{ticket.reporter_email}</div>
            </div>

            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, color: 'var(--text-muted)' }}>
                <BriefcaseBusiness size={14} />
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assignment</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: ticket.operator_name ? 'var(--amber)' : 'var(--text-primary)', marginBottom: 2 }}>{assignedLabel}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{assignedEmail}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, color: 'var(--text-muted)' }}>
              <ShieldAlert size={14} />
              <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Metadata & SLA</span>
            </div>

            <div className="responsive-two-col">
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Category</div>
                <span className="skill-tag">{formatCategoryLabel(ticket.category)}</span>
              </div>
              
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Raised On</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                  <Calendar size={13} color="var(--text-muted)" />
                  {new Date(ticket.created_at).toLocaleString()}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>SLA Deadline</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 500 }}>
                  <Clock3 size={13} color="var(--text-muted)" />
                  {new Date(ticket.sla_deadline).toLocaleString()}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center' }}>
                <SLACountdown deadline={ticket.sla_deadline} status={ticket.status} />
              </div>
            </div>
          </div>

        </div>
        
        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--bg-secondary)', borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close Details</button>
        </div>
      </div>
    </div>
  )
}
