import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Activity, AlertTriangle, CheckCircle, Clock, Ticket, TrendingUp, Users, Zap } from 'lucide-react'
import { formatCategoryLabel } from '../lib/taxonomy.js'

const COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#a78bfa',
  low: '#22c55e',
}

export default function Dashboard({ stats }) {
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    if (stats?.recent_assignments) {
      setRecentActivity(stats.recent_assignments)
    }
  }, [stats])

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12 }}>
        <div className="spinner" />
        <span style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</span>
      </div>
    )
  }

  const { overview, sla, tickets_by_priority, operators, recent_tickets, assignment_overview, daily_tickets, top_operators } = stats
  const assignmentSnapshot = assignment_overview?.length ? assignment_overview : recent_tickets?.filter((ticket) => ticket.operator_name).slice(0, 6) || []

  const statCards = [
    { label: 'Total Tickets', value: overview.total_tickets, icon: Ticket, color: 'amber', sub: 'All time' },
    { label: 'Open / Unassigned', value: overview.open_tickets, icon: Clock, color: 'blue', sub: 'Need attention' },
    { label: 'In Progress', value: overview.in_progress_tickets + overview.assigned_tickets, icon: Activity, color: 'purple', sub: 'Active work' },
    { label: 'Resolved', value: overview.resolved_tickets, icon: CheckCircle, color: 'green', sub: 'Completed' },
    { label: 'SLA Compliance', value: `${sla.compliance_rate}%`, icon: TrendingUp, color: sla.compliance_rate >= 90 ? 'green' : 'red', sub: `${sla.breached} breached` },
    { label: 'Operators Online', value: operators?.available || 0, icon: Users, color: 'blue', sub: `${operators?.busy || 0} busy` },
  ]

  const priorityData = ['critical', 'high', 'medium', 'low'].map((priority) => ({
    name: priority.charAt(0).toUpperCase() + priority.slice(1),
    count: tickets_by_priority?.find((ticket) => ticket.priority === priority)?.count || 0,
    color: COLORS[priority],
  }))

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Operations Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Real-time overview. Auto-refreshes every 30 seconds.</p>
        </div>
      </div>

      {sla.breached > 0 && (
        <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={16} color="var(--red)" />
          <span style={{ color: 'var(--red)', fontWeight: 600 }}>SLA BREACH ALERT</span>
          <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
            {sla.breached} ticket{sla.breached !== 1 ? 's have' : ' has'} exceeded the SLA deadline.
            {sla.at_risk > 0 ? ` ${sla.at_risk} more are at risk.` : ''}
          </span>
        </div>
      )}

      <div className="dashboard-grid dashboard-stats">
        {statCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className={`stat-card ${card.color}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div className="stat-number">{card.value}</div>
                  <div className="stat-label">{card.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{card.sub}</div>
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} color="var(--text-secondary)" />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="dashboard-grid" style={{ marginBottom: 24 }}>
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Ticket Volume (7 days)</h3>
          </div>
          <div style={{ padding: 20, height: 220 }}>
            {daily_tickets?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={daily_tickets} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontFamily: 'var(--mono)' }} tickFormatter={(date) => date.slice(5)} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }} labelStyle={{ color: 'var(--text-secondary)' }} itemStyle={{ color: 'var(--amber)' }} />
                  <Bar dataKey="count" fill="var(--amber)" radius={[3, 3, 0, 0]} name="Tickets" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>No data yet</div>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Priority Breakdown</h3>
          </div>
          <div style={{ padding: 20 }}>
            {priorityData.map((priority) => (
              <div key={priority.name} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{priority.name}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: priority.color, fontWeight: 700 }}>{priority.count}</span>
                </div>
                <div className="sla-bar">
                  <div className="sla-bar-fill" style={{ width: overview.total_tickets > 0 ? `${(priority.count / overview.total_tickets) * 100}%` : '0%', background: priority.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Recent Tickets</h3>
          </div>
          <div>
            {recent_tickets?.slice(0, 5).map((ticket) => (
              <div key={ticket.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.title}</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span>
                    <span className={`badge badge-${ticket.status}`}>{ticket.status}</span>
                    {ticket.operator_name && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Assigned to {ticket.operator_name}</span>}
                  </div>
                </div>
                {ticket.sla_status && <div style={{ fontSize: 10, fontFamily: 'var(--mono)', whiteSpace: 'nowrap', color: ticket.sla_status.color === 'red' ? 'var(--red)' : ticket.sla_status.color === 'orange' ? 'var(--orange)' : 'var(--text-muted)' }}>{ticket.sla_status.label}</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Recent Auto-Assignments</h3>
          </div>
          <div>
            {recentActivity?.slice(0, 5).map((log) => (
              <div key={log.id} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Zap size={12} color="var(--accent)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.ticket_title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    Assigned to <span style={{ color: 'var(--accent-light)' }}>{log.operator_name}</span> - score <span style={{ fontFamily: 'var(--mono)' }}>{log.score}</span>
                  </div>
                </div>
                <span className={`badge badge-${log.priority}`}>{log.priority}</span>
              </div>
            ))}
            {!recentActivity?.length && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>No assignments yet. Employees can raise the first ticket anytime.</div>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ fontSize: 13, fontWeight: 600 }}>Assignment Overview</h3>
        </div>

        {assignmentSnapshot.length ? (
          <div className="table-scroll">
            <table className="data-table" style={{ minWidth: 720 }}>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Reporter</th>
                  <th>Assigned Operator</th>
                  <th>Status</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                {assignmentSnapshot.map((ticket) => (
                  <tr key={ticket.id}>
                    <td style={{ maxWidth: 260 }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{ticket.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatCategoryLabel(ticket.category)}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>{ticket.reporter_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ticket.reporter_email}</div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--accent-light)', fontWeight: 600 }}>{ticket.operator_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ticket.operator_email || 'Operator contact unavailable'}</div>
                    </td>
                    <td><span className={`badge badge-${ticket.status}`}>{ticket.status.replace('_', ' ')}</span></td>
                    <td><span className={`badge badge-${ticket.priority}`}>{ticket.priority}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ padding: 28, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active assignments are available right now.
          </div>
        )}
      </div>

      {!!top_operators?.length && (
        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600 }}>Top Operators by Resolved Tickets</h3>
          </div>
          <div className="top-operator-grid">
            {top_operators.slice(0, 5).map((operator, index) => (
              <div key={operator.email} style={{ padding: '16px 20px', textAlign: 'center', borderRight: index < Math.min(top_operators.length, 5) - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: index === 0 ? 'rgba(99,102,241,0.15)' : 'var(--bg-hover)', border: `2px solid ${index === 0 ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', fontSize: 13, fontWeight: 700, color: index === 0 ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                  {operator.name.charAt(0)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{operator.name.split(' ')[0]}</div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: 'var(--accent)', fontWeight: 700 }}>{operator.total_resolved}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>resolved</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
