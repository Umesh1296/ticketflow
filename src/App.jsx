import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ChevronRight, FileText, LayoutDashboard, LogOut, Menu, Moon, RefreshCw, Search, Settings, Sun, Ticket, UserRound, Users, X, Zap } from 'lucide-react'
import Dashboard from './pages/Dashboard.jsx'
import Tickets from './pages/Tickets.jsx'
import Employees from './pages/Employees.jsx'
import Operators from './pages/Operators.jsx'
import AssignmentLogs from './pages/AssignmentLogs.jsx'
import EmployeeTickets from './pages/EmployeeTickets.jsx'
import OperatorWorkspace from './pages/OperatorWorkspace.jsx'
import ManagerSettings from './pages/ManagerSettings.jsx'
import CreateTicketModal from './components/CreateTicketModal.jsx'
import ReportsModal from './components/ReportsModal.jsx'
import LoginPage from './components/LoginPage.jsx'
import Toast from './components/Toast.jsx'
import { API, clearStoredAuthToken, getFriendlyErrorMessage, getStoredAuthToken, setUnauthorizedHandler, storeAuthToken } from './lib/api.js'

const DEFAULT_AUTH_CONFIG = {
  googleEnabled: false,
  googleClientId: null,
  localRegistrationEnabled: true,
  localRegistrationRoles: ['manager'],
  googleAuthRoles: ['manager'],
  managerCount: 0,
  employeeCount: 0,
  operatorCount: 0,
  legacyLoginEnabled: false,
}

export default function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('ticketview_theme') || 'light')
  const [page, setPage] = useState('dashboard')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showReportsModal, setShowReportsModal] = useState(false)
  const [toasts, setToasts] = useState([])
  const [stats, setStats] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [authConfig, setAuthConfig] = useState(DEFAULT_AUTH_CONFIG)
  const [authState, setAuthState] = useState('checking')
  const [ticketRefreshKey, setTicketRefreshKey] = useState(0)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, message, type }])
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id))
    }, 4000)
  }, [])

  const clearSession = useCallback((message) => {
    clearStoredAuthToken()
    setUser(null)
    setStats(null)
    setPage('dashboard')
    setShowCreateModal(false)
    setSidebarOpen(false)
    setTicketRefreshKey(0)
    setAuthState('unauthenticated')

    if (message) {
      addToast(message, 'error')
    }
  }, [addToast])

  useEffect(() => {
    document.body.setAttribute('data-theme', theme)
    localStorage.setItem('ticketview_theme', theme)
  }, [theme])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession('Session expired. Please sign in again.')
    })

    return () => {
      setUnauthorizedHandler(null)
    }
  }, [clearSession])

  const fetchAuthConfig = useCallback(async () => {
    try {
      const { data } = await API.get('/auth/config')
      setAuthConfig(data.data || DEFAULT_AUTH_CONFIG)
    } catch {
      // silently fail
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      setTicketRefreshKey((k) => k + 1)
      const { data } = await API.get('/dashboard/stats')
      setStats(data.data)
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to load dashboard'), 'error')
    }
  }, [addToast])

  useEffect(() => {
    fetchAuthConfig()
  }, [fetchAuthConfig])

  useEffect(() => {
    let cancelled = false

    const bootstrapAuth = async () => {
      try {
        const { data } = await API.get('/auth/config')
        if (!cancelled) {
          setAuthConfig(data.data || DEFAULT_AUTH_CONFIG)
        }
      } catch (err) {
        if (!cancelled) {
          addToast(getFriendlyErrorMessage(err, 'Failed to load authentication settings'), 'error')
        }
      }

      if (!getStoredAuthToken()) {
        if (!cancelled) {
          setAuthState('unauthenticated')
        }
        return
      }

      try {
        const { data } = await API.get('/auth/me')
        if (!cancelled) {
          setUser(data.data.user)
          setAuthState('authenticated')
        }
      } catch (err) {
        clearStoredAuthToken()
        if (!cancelled) {
          setAuthState('unauthenticated')
          if (err.code === 'ERR_NETWORK' || !err.response) {
            addToast(getFriendlyErrorMessage(err, 'Unable to reach the server'), 'error')
          }
        }
      }
    }

    bootstrapAuth()

    return () => {
      cancelled = true
    }
  }, [addToast])

  useEffect(() => {
    if (authState !== 'authenticated' || user?.role !== 'manager') {
      return undefined
    }

    fetchStats()
    const intervalId = window.setInterval(fetchStats, 30000)
    return () => window.clearInterval(intervalId)
  }, [authState, fetchStats, user?.role])

  const startAuthenticatedSession = useCallback(async (authData) => {
    storeAuthToken(authData.token)
    setUser(authData.user)
    setAuthState('authenticated')
    setShowCreateModal(false)
    setSidebarOpen(false)
    setPage(authData.user?.role === 'manager' ? 'dashboard' : authData.user?.role || 'dashboard')
    setTicketRefreshKey((current) => current + 1)

    if (authData.user?.role === 'manager') {
      await fetchStats()
    } else {
      setStats(null)
    }
  }, [fetchStats])

  const handleLogin = useCallback(async ({ role, email, password }) => {
    const { data } = await API.post('/auth/login', { role, email, password })
    await startAuthenticatedSession(data.data)
  }, [startAuthenticatedSession])

  const handleRegister = useCallback(async ({ role, name, email, password }) => {
    const { data } = await API.post('/auth/register', { role, name, email, password })
    await startAuthenticatedSession(data.data)
  }, [startAuthenticatedSession])

  const handleGoogleLogin = useCallback(async ({ role, credential }) => {
    const { data } = await API.post('/auth/google', { role, credential })
    await startAuthenticatedSession(data.data)
  }, [startAuthenticatedSession])

  const handleLogout = useCallback(async () => {
    try {
      await API.post('/auth/logout')
    } catch {
      // Clear the local session even if the server is already unavailable.
    }

    clearSession()
    addToast('Signed out successfully', 'info')
  }, [addToast, clearSession])

  const handleAccountDeleted = useCallback(async () => {
    clearStoredAuthToken()
    setUser(null)
    setStats(null)
    setPage('dashboard')
    setSidebarOpen(false)
    setAuthState('unauthenticated')
    await fetchAuthConfig()
  }, [fetchAuthConfig])

  const navItems = useMemo(
    () => [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'tickets', label: 'Tickets', icon: Ticket },
      { id: 'employees', label: 'End Users', icon: UserRound },
      { id: 'operators', label: 'Support Agents', icon: Users },
      { id: 'logs', label: 'Assignment Log', icon: Activity },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
    [],
  )

  const currentPageLabel = navItems.find((item) => item.id === page)?.label || 'Dashboard'

  const navigateTo = useCallback((pageId) => {
    setPage(pageId)
    setSidebarOpen(false)
  }, [])

  const renderManagerPage = () => {
    if (page === 'dashboard') {
      return <Dashboard stats={stats} />
    }

    if (page === 'tickets') {
      return <Tickets API={API} addToast={addToast} onRefresh={fetchStats} refreshKey={ticketRefreshKey} />
    }

    if (page === 'employees') {
      return <Employees API={API} addToast={addToast} onRefresh={fetchStats} refreshKey={ticketRefreshKey} />
    }

    if (page === 'operators') {
      return <Operators API={API} addToast={addToast} onRefresh={fetchStats} refreshKey={ticketRefreshKey} />
    }

    if (page === 'settings') {
      return <ManagerSettings API={API} addToast={addToast} user={user} onAccountDeleted={handleAccountDeleted} />
    }

    return <AssignmentLogs API={API} addToast={addToast} refreshKey={ticketRefreshKey} />
  }

  // SLA breach count for notification
  const slaBreachCount = stats?.sla?.breached || 0
  const criticalCount = stats?.tickets_by_priority?.find((item) => item.priority === 'critical')?.count || 0

  if (authState === 'checking') {
    return (
      <div className="state-screen">
        <div className="spinner" />
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Checking your session...</div>
      </div>
    )
  }

  if (authState !== 'authenticated') {
    return (
      <>
        <LoginPage
          API={API}
          addToast={addToast}
          authConfig={authConfig}
          onGoogleLogin={handleGoogleLogin}
          onLogin={handleLogin}
          onRegister={handleRegister}
        />
        <div className="toast-container">
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          ))}
        </div>
      </>
    )
  }

  if (user?.role === 'employee') {
    return (
      <>
        <div className="employee-shell">
          <div className="employee-frame">
            <header className="employee-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="role-header-icon">
                  <Zap size={18} color="#fff" fill="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>TicketFlow</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>End User Portal</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="manager-chip">
                  <span>{user.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{user.email}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Toggle Theme" style={{ padding: '0 8px' }}>
                  {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReportsModal(true)}>
                  <FileText size={12} />
                  Reports
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </header>

            <EmployeeTickets
              API={API}
              addToast={addToast}
              currentUser={user}
              onCreateTicket={() => setShowCreateModal(true)}
              refreshKey={ticketRefreshKey}
            />
          </div>
        </div>

        {showCreateModal && (
          <CreateTicketModal
            API={API}
            currentUser={user}
            onClose={() => setShowCreateModal(false)}
            onSuccess={(message) => {
              addToast(message, 'success')
              setShowCreateModal(false)
              setTicketRefreshKey((current) => current + 1)
            }}
            onError={(message) => addToast(message, 'error')}
          />
        )}

        {showReportsModal && (
          <ReportsModal API={API} addToast={addToast} onClose={() => setShowReportsModal(false)} />
        )}

        <div className="toast-container">
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          ))}
        </div>
      </>
    )
  }

  if (user?.role === 'operator') {
    return (
      <>
        <div className="employee-shell">
          <div className="employee-frame">
            <header className="employee-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="role-header-icon">
                  <Zap size={18} color="#fff" fill="#fff" />
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 700 }}>TicketFlow</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Support Agent Portal</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <div className="manager-chip">
                  <span>{user.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{user.email}</span>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Toggle Theme" style={{ padding: '0 8px' }}>
                  {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowReportsModal(true)}>
                  <FileText size={12} />
                  Reports
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleLogout}>
                  <LogOut size={12} />
                  Sign Out
                </button>
              </div>
            </header>

            <OperatorWorkspace
              API={API}
              addToast={addToast}
              currentUser={user}
              refreshKey={ticketRefreshKey}
            />
          </div>
        </div>

        {showReportsModal && (
          <ReportsModal API={API} addToast={addToast} onClose={() => setShowReportsModal(false)} />
        )}

        <div className="toast-container">
          {toasts.map((toast) => (
            <Toast key={toast.id} message={toast.message} type={toast.type} />
          ))}
        </div>
      </>
    )
  }

  // ========== MANAGER DASHBOARD ==========
  return (
    <div className="app-shell">
      {/* Sidebar overlay */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ padding: '20px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="role-header-icon" style={{ width: 34, height: 34 }}>
              <Zap size={15} color="#fff" fill="#fff" />
            </div>
            <div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 700, letterSpacing: '-0.02em' }}>TicketFlow</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Admin Console</div>
            </div>
          </div>
          <button
            className="menu-trigger"
            style={{ width: 30, height: 30 }}
            onClick={() => setSidebarOpen(false)}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        </div>

        <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
          {navItems.map((item) => {
            const Icon = item.icon
            const active = page === item.id

            return (
              <button
                key={item.id}
                className={`nav-item ${active ? 'active' : ''}`}
                onClick={() => navigateTo(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            )
          })}

          {stats && (
            <div style={{ marginTop: 24, padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'var(--mono)' }}>
                Live Status
              </div>
              {[
                { label: 'Open', value: stats.overview.open_tickets, color: 'var(--blue)' },
                { label: 'Critical', value: stats.tickets_by_priority?.find((item) => item.priority === 'critical')?.count || 0, color: 'var(--red)' },
                { label: 'SLA OK', value: `${stats.sla.compliance_rate}%`, color: 'var(--green)' },
              ].map((stat) => (
                <div key={stat.label} title={stat.label === 'SLA OK' ? 'SLA Compliance Rate: Percentage of tickets closed before their Service Level Agreement deadline.' : undefined} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center', cursor: stat.label === 'SLA OK' ? 'help' : 'default' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{stat.label}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: stat.color, fontWeight: 700 }}>{stat.value}</span>
                </div>
              ))}
            </div>
          )}
        </nav>

        <div style={{ padding: '14px 12px', borderTop: '1px solid var(--border)' }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '10px 0' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-glow)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: 'var(--accent-light)', flexShrink: 0 }}>
                {user.name?.charAt(0) || '?'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              </div>
            </div>
          )}
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={handleLogout}>
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--mono)' }}>v2.0.0 — TicketFlow</div>
        </div>
      </aside>

      {/* Sidebar backdrop */}
      <button
        className={`sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Close navigation"
      />

      {/* Main content */}
      <main className="main-panel">
        <header className="main-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <button
              className="menu-trigger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--accent-light)' }}>TF</span>
              <ChevronRight size={12} />
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentPageLabel}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {/* Notification indicators */}
            {(slaBreachCount > 0 || criticalCount > 0) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {slaBreachCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: 'var(--red-soft)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--red)', fontWeight: 600 }}>
                    <AlertTriangle size={11} />
                    {slaBreachCount} SLA
                  </div>
                )}
                {criticalCount > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 999, background: 'var(--orange-dim)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--orange)', fontWeight: 600 }}>
                    {criticalCount} Critical
                  </div>
                )}
              </div>
            )}

            {stats && (
              <div title="SLA Compliance Rate: Percentage of tickets closed before their Service Level Agreement deadline." style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'help' }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: stats.sla.compliance_rate >= 90 ? 'var(--green)' : stats.sla.compliance_rate >= 70 ? 'var(--orange)' : 'var(--red)',
                    boxShadow: `0 0 8px ${stats.sla.compliance_rate >= 90 ? 'var(--green)' : stats.sla.compliance_rate >= 70 ? 'var(--orange)' : 'var(--red)'}`,
                    animation: 'pulse 2s infinite',
                  }}
                />
                <span style={{ color: 'var(--text-muted)' }}>SLA</span>
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--text-primary)', fontWeight: 700 }}>{stats.sla.compliance_rate}%</span>
              </div>
            )}

            {stats && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                <Users size={12} />
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--green)', fontWeight: 700 }}>{stats.operators?.available || 0}</span>
                <span>available</span>
              </div>
            )}

            <button className="btn btn-secondary btn-sm" onClick={() => setShowReportsModal(true)} title="Closure Reports">
              <FileText size={12} />
              Reports
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} title="Toggle Theme" style={{ padding: '0 8px' }}>
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={fetchStats} title="Refresh data">
              <RefreshCw size={12} />
              Refresh
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: 24 }}>{renderManagerPage()}</div>
      </main>

      {showReportsModal && (
        <ReportsModal API={API} addToast={addToast} onClose={() => setShowReportsModal(false)} />
      )}

      <div className="toast-container">
        {toasts.map((toast) => (
          <Toast key={toast.id} message={toast.message} type={toast.type} />
        ))}
      </div>
    </div>
  )
}
