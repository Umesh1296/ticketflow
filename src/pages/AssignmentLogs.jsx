import { useCallback, useEffect, useState } from 'react'
import { Activity, RefreshCw, Zap } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function AssignmentLogs({ API, addToast, refreshKey }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true)
      const { data: ticketsData } = await API.get('/tickets')
      const tickets = ticketsData.data || []

      const logGroups = await Promise.all(
        tickets.slice(0, 30).map(async (ticket) => {
          try {
            const { data } = await API.get(`/tickets/${ticket.id}/logs`)
            return (data.data || []).map((log) => ({
              ...log,
              ticket_title: ticket.title,
              ticket_priority: ticket.priority,
              ticket_status: ticket.status,
            }))
          } catch {
            return []
          }
        }),
      )

      const allLogs = logGroups.flat().sort((a, b) => new Date(b.assigned_at) - new Date(a.assigned_at))
      setLogs(allLogs)
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to load logs'), 'error')
    } finally {
      setLoading(false)
    }
  }, [API, addToast])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs, refreshKey])

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Assignment Log</h1>
        </div>
      </div>

      <div className="card table-scroll">
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}>
            <div className="spinner" />
            <span style={{ color: 'var(--text-muted)' }}>Loading assignment history...</span>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            <Activity size={32} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
            <div>No assignment logs yet.</div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Ticket</th>
                <th>Priority</th>
                <th>Assigned To</th>
                <th>Score</th>
                <th>Reasons</th>
                <th>Ticket Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{new Date(log.assigned_at).toLocaleDateString()}</div>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--text-muted)' }}>{new Date(log.assigned_at).toLocaleTimeString()}</div>
                  </td>
                  <td style={{ maxWidth: 220 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.ticket_title}</div>
                  </td>
                  <td><span className={`badge badge-${log.ticket_priority}`}>{log.ticket_priority}</span></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: 'var(--accent-glow)',
                          border: '1px solid rgba(99,102,241,0.3)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'var(--accent-light)',
                          flexShrink: 0,
                        }}
                      >
                        {log.operator_name?.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{log.operator_name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{log.operator_email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div
                      style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 13,
                        fontWeight: 700,
                        color: log.score >= 80 ? 'var(--green)' : log.score >= 50 ? 'var(--amber)' : 'var(--orange)',
                      }}
                    >
                      {log.score}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>/ 100</div>
                  </td>
                  <td style={{ maxWidth: 300 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {log.reason?.split('; ').map((reason) => (
                        <span
                          key={reason}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 4,
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td><span className={`badge badge-${log.ticket_status}`}>{log.ticket_status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
