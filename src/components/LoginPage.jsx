import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, Headset, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

const ROLE_CARDS = [
  { id: 'manager', label: 'Admin', icon: ShieldCheck, color: 'var(--accent)', bg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' },
  { id: 'employee', label: 'End User', icon: UserRound, color: 'var(--blue)', bg: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)' },
  { id: 'operator', label: 'Support Agent', icon: Headset, color: 'var(--green)', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
]

function getPreferredMode(role, authConfig) {
  const selfRegistrationRoles = authConfig.localRegistrationRoles || ['manager']
  const canSelfRegister = selfRegistrationRoles.includes(role)
  const managerHasLogin = Boolean(authConfig.managerCount > 0 || authConfig.legacyLoginEnabled)

  if (!canSelfRegister) {
    return 'login'
  }

  if (role === 'manager') {
    return managerHasLogin ? 'login' : 'register'
  }

  return 'login'
}

const ROLE_DISPLAY = { manager: 'Admin', employee: 'End User', operator: 'Support Agent' }

export default function LoginPage({ API, addToast, authConfig, onGoogleLogin, onLogin, onRegister }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const googleButtonRef = useRef(null)

  const selfRegistrationRoles = authConfig.localRegistrationRoles || ['manager']
  const googleAuthRoles = authConfig.googleAuthRoles || ['manager']
  const registrationAllowed = selectedRole ? selfRegistrationRoles.includes(selectedRole) : false
  const googleAllowed = selectedRole ? googleAuthRoles.includes(selectedRole) : false
  const googleEnabled = Boolean(authConfig.googleEnabled && authConfig.googleClientId && googleAllowed)

  const modeTitle = useMemo(
    () => {
      if (mode === 'forgot-password') return 'Reset Password'
      if (mode === 'verify-otp') return 'Verify OTP'
      return (mode === 'login' ? 'Sign In' : 'Create Account')
    },
    [mode],
  )

  useEffect(() => {
    if (!selectedRole) return
    if (mode === 'forgot-password' || mode === 'verify-otp') return
    setMode(getPreferredMode(selectedRole, authConfig))
  }, [authConfig, selectedRole, mode])

  useEffect(() => {
    if (!registrationAllowed && mode === 'register') {
      setMode('login')
    }
  }, [mode, registrationAllowed])

  useEffect(() => {
    if (!googleEnabled || !googleButtonRef.current) {
      return undefined
    }

    let cancelled = false
    const scriptId = 'ticketflow-google-identity'

    const renderGoogleButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
        return
      }

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.initialize({
        client_id: authConfig.googleClientId,
        callback: async (response) => {
          setError('')
          setGoogleBusy(true)
          try {
            await onGoogleLogin({ role: selectedRole, credential: response.credential })
          } catch (loginError) {
            setError(getFriendlyErrorMessage(loginError, 'Google sign-in failed'))
          } finally {
            setGoogleBusy(false)
          }
        },
      })

      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: mode === 'register' ? 'signup_with' : 'signin_with',
        width: 320,
      })
    }

    const existingScript = document.getElementById(scriptId)
    if (existingScript) {
      renderGoogleButton()
      return () => {
        cancelled = true
      }
    }

    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    document.body.appendChild(script)

    return () => {
      cancelled = true
    }
  }, [authConfig.googleClientId, googleEnabled, mode, onGoogleLogin, selectedRole])

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'forgot-password') {
        if (!form.email.trim()) throw new Error('Email is required')
        const { data } = await API.post('/auth/forgot-password', { email: form.email.trim(), role: selectedRole })
        addToast(data.message || 'OTP sent to your email', 'success')
        setMode('verify-otp')
      } else if (mode === 'verify-otp') {
        if (!otp.trim()) throw new Error('OTP is required')
        if (!form.password) throw new Error('New password is required')
        const { data } = await API.post('/auth/reset-password', { email: form.email.trim(), role: selectedRole, otp: otp.trim(), newPassword: form.password })
        addToast(data.message || 'Password reset successfully. Please login.', 'success')
        setMode('login')
        setOtp('')
        setForm((f) => ({ ...f, password: '' }))
      } else if (mode === 'register') {
        if (!form.name.trim()) {
          throw new Error('Your name is required')
        }

        if (form.password !== form.confirmPassword) {
          throw new Error('Passwords do not match')
        }

        await onRegister({
          role: selectedRole,
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
        })
      } else {
        await onLogin({
          role: selectedRole,
          email: form.email.trim(),
          password: form.password,
        })
      }
    } catch (loginError) {
      setError(loginError.message || getFriendlyErrorMessage(loginError, 'Unable to continue'))
    } finally {
      setLoading(false)
    }
  }

  const displayLabel = ROLE_DISPLAY[selectedRole] || ''

  // ========== CARD SELECTION VIEW ==========
  if (!selectedRole) {
    return (
      <div className="auth-shell">
        <div className="auth-panel" style={{ maxWidth: 700 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div className="auth-badge" style={{ justifyContent: 'center' }}>
              <ShieldCheck size={14} />
              Secure Access
            </div>
            <h1 style={{ fontSize: 34, lineHeight: 1.1, marginBottom: 10 }}>Welcome to TicketFlow</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Select your portal to continue</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {ROLE_CARDS.map((card) => {
              const Icon = card.icon
              return (
                <button
                  key={card.id}
                  onClick={() => {
                    setSelectedRole(card.id)
                    setMode(getPreferredMode(card.id, authConfig))
                    setError('')
                    setForm({ name: '', email: '', password: '', confirmPassword: '' })
                  }}
                  style={{
                    background: card.bg,
                    border: 'none',
                    borderRadius: 14,
                    padding: '28px 16px 22px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 14,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    color: '#fff',
                    textAlign: 'left',
                  }}
                  className="login-role-card"
                >
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 2 }}>{card.label}</div>
                    <div style={{ fontSize: 11, opacity: 0.85 }}>Portal</div>
                  </div>
                </button>
              )
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: 28 }}>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>© {new Date().getFullYear()} TicketFlow. All rights reserved.</p>
          </div>
        </div>
      </div>
    )
  }

  // ========== LOGIN FORM VIEW ==========
  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div>
          <button
            onClick={() => { setSelectedRole(null); setError('') }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, padding: 0 }}
          >
            ← Back to portal selection
          </button>
          <div className="auth-badge">
            <ShieldCheck size={14} />
            {displayLabel} Portal
          </div>
          <h1 style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 10 }}>{displayLabel} {modeTitle}</h1>
        </div>

        <div className="card auth-card">
          <div style={{ marginBottom: 20 }}>
            {registrationAllowed && (mode === 'login' || mode === 'register') ? (
              <div className="auth-tabs">
                <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')} type="button">
                  Login
                </button>
                <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')} type="button">
                  Create Account
                </button>
              </div>
            ) : null}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mode === 'register' && registrationAllowed && (
              <div>
                <label>Full Name</label>
                <div className="input-with-icon">
                  <UserRound size={15} />
                  <input type="text" value={form.name} onChange={handleChange('name')} placeholder="Your name" autoComplete="name" />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'forgot-password' || mode === 'verify-otp') && (
              <div>
                <label>Email</label>
                <div className="input-with-icon">
                  <Mail size={15} />
                  <input type="email" value={form.email} onChange={handleChange('email')} placeholder="your@email.com" autoComplete="username" disabled={mode === 'verify-otp'} />
                </div>
              </div>
            )}

            {mode === 'verify-otp' && (
              <div>
                <label>One-Time Password (OTP)</label>
                <div className="input-with-icon">
                  <LockKeyhole size={15} />
                  <input type="text" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" autoComplete="one-time-code" />
                </div>
              </div>
            )}

            {(mode === 'login' || mode === 'register' || mode === 'verify-otp') && (
              <div>
                <label>{mode === 'verify-otp' ? 'New Password' : 'Password'}</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <LockKeyhole size={15} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange('password')}
                    placeholder={mode === 'verify-otp' ? 'New password' : mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                    autoComplete={mode === 'register' ? 'new-password' : mode === 'verify-otp' ? 'new-password' : 'current-password'}
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {mode === 'login' && (
                  <div style={{ textAlign: 'right', marginTop: 6 }}>
                    <button type="button" onClick={() => { setMode('forgot-password'); setError(''); }} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 12, cursor: 'pointer' }}>Forgot Password?</button>
                  </div>
                )}
              </div>
            )}

            {mode === 'register' && registrationAllowed && (
              <div>
                <label>Confirm Password</label>
                <div className="input-with-icon" style={{ position: 'relative' }}>
                  <LockKeyhole size={15} />
                  <input 
                    type={showConfirmPassword ? 'text' : 'password'} 
                    value={form.confirmPassword} 
                    onChange={handleChange('confirmPassword')} 
                    placeholder="Repeat your password" 
                    autoComplete="new-password" 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text-muted)' }}
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {error && <div className="inline-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
              {loading
                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> {mode === 'login' ? 'Signing in...' : mode === 'forgot-password' ? 'Sending OTP...' : mode === 'verify-otp' ? 'Verifying...' : 'Creating account...'}</>
                : mode === 'login' ? `Login as ${displayLabel}` : mode === 'forgot-password' ? 'Send OTP' : mode === 'verify-otp' ? 'Reset Password' : `Create ${displayLabel} account`}
            </button>
            
            {(mode === 'forgot-password' || mode === 'verify-otp') && (
              <button className="btn btn-secondary" type="button" onClick={() => { setMode('login'); setError(''); }} style={{ justifyContent: 'center', marginTop: 4 }}>
                Back to Login
              </button>
            )}
          </form>

          {googleAllowed && (
            <>
              <div className="auth-divider">or</div>

              {googleEnabled ? (
                <div>
                  <div ref={googleButtonRef} className={googleBusy ? 'google-button-disabled' : ''} />
                </div>
              ) : (
                <div className="google-unavailable">
                  Add `GOOGLE_CLIENT_ID` to your local `.env` file to enable Google sign-in.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
