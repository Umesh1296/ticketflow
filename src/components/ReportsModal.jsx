import { useEffect, useState } from 'react'
import { FileText, X } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function ReportsModal({ API, onClose, addToast }) {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const fetchReports = async () => {
      try {
        const { data } = await API.get('/tickets/reports')
        if (!cancelled) setReports(data.data || [])
      } catch (err) {
        if (!cancelled) {
          addToast(getFriendlyErrorMessage(err, 'Could not fetch reports'), 'error')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchReports()
    return () => { cancelled = true }
  }, [API, addToast])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700, width: '90%' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <FileText size={18} className="lucide-icon" style={{ color: 'var(--accent)' }} />
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>Ticket Closure Reports</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close reports">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
              <div className="spinner" />
              <span style={{ color: 'var(--text-muted)' }}>Loading reports...</span>
            </div>
          ) : reports.length === 0 ? (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 18, marginBottom: 8 }}>No closure reports yet</div>
              When tickets are resolved, the closure reports will appear here.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reports.map((report) => (
                <div key={report.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15 }}>{report.ticket.title}</div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>#{report.ticket_id.substring(0, 8).toUpperCase()} • Raised by {report.reporter_name}</div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right' }}>
                      <div>Resolved At</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{new Date(report.resolved_at).toLocaleString()}</div>
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 6, display: 'flex', gap: 24, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Resolved By</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{report.operator_name}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SLA Compliance</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: report.sla_status?.is_breached ? 'var(--red)' : 'var(--green)' }}>
                        {report.sla_status?.is_breached ? 'Missed Deadline' : 'SLA Met'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
