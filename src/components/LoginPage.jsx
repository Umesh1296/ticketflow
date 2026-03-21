import { useEffect, useMemo, useRef, useState } from 'react'
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

const ROLE_OPTIONS = [
  { id: 'manager', label: 'Manager Login', helper: 'Full dashboard and team oversight' },
  { id: 'employee', label: 'Employee Login', helper: 'Use manager-shared credentials' },
  { id: 'operator', label: 'Operator Login', helper: 'Use manager-shared credentials' },
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

export default function LoginPage({ API, addToast, authConfig, onGoogleLogin, onLogin, onRegister }) {
  const [selectedRole, setSelectedRole] = useState('manager')
  const [mode, setMode] = useState(() => getPreferredMode('manager', authConfig))
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

  const operatorSelected = selectedRole === 'operator'
  const selfRegistrationRoles = authConfig.localRegistrationRoles || ['manager']
  const googleAuthRoles = authConfig.googleAuthRoles || ['manager']
  const registrationAllowed = selfRegistrationRoles.includes(selectedRole)
  const googleAllowed = googleAuthRoles.includes(selectedRole)
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

  const currentRoleInfo = ROLE_OPTIONS.find((role) => role.id === selectedRole)

  return (
    <div className="auth-shell">
      <div className="auth-panel">
        <div>
          <div className="auth-badge">
            <ShieldCheck size={14} />
            Role Based Access
          </div>
          <h1 style={{ fontSize: 38, lineHeight: 1.1, marginBottom: 14 }}>Choose how you want to sign in</h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 500, fontSize: 15 }}>
            Employees can raise and track tickets, operators can manage assigned work, and managers can oversee the full dashboard, employee access, operator team, and assignment logs.
          </p>
        </div>

        <div className="card auth-card">
          <div style={{ marginBottom: 20 }}>
            <div className="role-tabs role-tabs-three">
              {ROLE_OPTIONS.map((role) => (
                <button
                  key={role.id}
                  className={`role-tab ${selectedRole === role.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedRole(role.id)}
                >
                  <span>{role.label}</span>
                  <span className="role-tab-helper">{role.helper}</span>
                </button>
              ))}
            </div>

            {registrationAllowed ? (
              <div className="auth-tabs">
                <button className={`auth-tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')} type="button">
                  Login
                </button>
                <button className={`auth-tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')} type="button">
                  Create Account
                </button>
              </div>
            ) : (
              <div className="operator-login-note">
                <Wrench size={14} />
                {selectedRole === 'manager'
                  ? 'Manager access is restricted to approved administrator accounts. Public sign-up is disabled after the first setup.'
                  : selectedRole === 'employee'
                    ? 'Employee accounts are created by a manager and shared directly with the employee.'
                    : 'Operator accounts are created by a manager and shared directly with the operator.'}
              </div>
            )}

            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{currentRoleInfo?.label} - {modeTitle}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {mode === 'forgot-password'
                ? 'Enter your email to receive a 6-digit OTP to reset your password.'
                : mode === 'verify-otp'
                  ? 'Check your email (or console) for the OTP and enter your new password.'
                  : operatorSelected
                    ? 'Use the email and password shared by your manager to open your assigned-work dashboard.'
                    : selectedRole === 'employee'
                      ? 'Use the email and password shared by your manager to access ticket raising and status tracking.'
                    : mode === 'login'
                      ? 'Use your approved manager account to continue.'
                      : 'Create the first manager account to bootstrap the workspace.'}
            </p>
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
                : mode === 'login' ? `Login as ${selectedRole}` : mode === 'forgot-password' ? 'Send OTP' : mode === 'verify-otp' ? 'Reset Password' : `Create ${selectedRole} account`}
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
                  <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 10 }}>
                    Continue with Google using an approved manager email.
                  </p>
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
