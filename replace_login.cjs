const fs = require('fs')

let content = fs.readFileSync('src/components/LoginPage.jsx', 'utf8')

content = content.replace(
  "import { LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react'",
  "import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound, Wrench } from 'lucide-react'"
)

content = content.replace(
  "export default function LoginPage({ authConfig, onGoogleLogin, onLogin, onRegister }) {",
  "export default function LoginPage({ API, addToast, authConfig, onGoogleLogin, onLogin, onRegister }) {"
)

content = content.replace(
  "  const [form, setForm] = useState({\n    name: '',\n    email: '',\n    password: '',\n    confirmPassword: '',\n  })\n  const [error, setError] = useState('')\n  const [loading, setLoading] = useState(false)",
  `  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)`
)

content = content.replace(
  "  const modeTitle = useMemo(\n    () => (mode === 'login' ? 'Sign In' : 'Create Account'),\n    [mode],\n  )",
  `  const modeTitle = useMemo(
    () => {
      if (mode === 'forgot-password') return 'Reset Password'
      if (mode === 'verify-otp') return 'Verify OTP'
      return (mode === 'login' ? 'Sign In' : 'Create Account')
    },
    [mode],
  )`
)

content = content.replace(
  "  useEffect(() => {\n    setMode(getPreferredMode(selectedRole, authConfig))\n  }, [authConfig, selectedRole])\n\n  useEffect(() => {\n    if (!registrationAllowed && mode !== 'login') {\n      setMode('login')\n    }\n  }, [mode, registrationAllowed])",
  `  useEffect(() => {
    if (mode === 'forgot-password' || mode === 'verify-otp') return
    setMode(getPreferredMode(selectedRole, authConfig))
  }, [authConfig, selectedRole, mode])

  useEffect(() => {
    if (!registrationAllowed && mode === 'register') {
      setMode('login')
    }
  }, [mode, registrationAllowed])`
)

content = content.replace(
  `      if (mode === 'register') {
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
      }`,
  `      if (mode === 'forgot-password') {
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
      }`
)

const uiReplaceStr = `            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{currentRoleInfo?.label} - {modeTitle}</h2>
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
                : mode === 'login' ? \`Login as \${selectedRole}\` : mode === 'forgot-password' ? 'Send OTP' : mode === 'verify-otp' ? 'Reset Password' : \`Create \${selectedRole} account\`}
            </button>
            
            {(mode === 'forgot-password' || mode === 'verify-otp') && (
              <button className="btn btn-secondary" type="button" onClick={() => { setMode('login'); setError(''); }} style={{ justifyContent: 'center', marginTop: 4 }}>
                Back to Login
              </button>
            )}
          </form>`

const originalUiBlock = `            <h2 style={{ fontSize: 20, marginBottom: 6 }}>{currentRoleInfo?.label} - {modeTitle}</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              {operatorSelected
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

            <div>
              <label>Email</label>
              <div className="input-with-icon">
                <Mail size={15} />
                <input type="email" value={form.email} onChange={handleChange('email')} placeholder="your@email.com" autoComplete="username" />
              </div>
            </div>

            <div>
              <label>Password</label>
              <div className="input-with-icon">
                <LockKeyhole size={15} />
                <input
                  type="password"
                  value={form.password}
                  onChange={handleChange('password')}
                  placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>
            </div>

            {mode === 'register' && registrationAllowed && (
              <div>
                <label>Confirm Password</label>
                <div className="input-with-icon">
                  <LockKeyhole size={15} />
                  <input type="password" value={form.confirmPassword} onChange={handleChange('confirmPassword')} placeholder="Repeat your password" autoComplete="new-password" />
                </div>
              </div>
            )}

            {error && <div className="inline-error">{error}</div>}

            <button className="btn btn-primary" type="submit" disabled={loading} style={{ justifyContent: 'center', marginTop: 4 }}>
              {loading
                ? <><div className="spinner" style={{ width: 14, height: 14 }} /> {mode === 'login' ? 'Signing in...' : 'Creating account...'}</>
                : mode === 'login' ? \`Login as \${selectedRole}\` : \`Create \${selectedRole} account\`}
            </button>
          </form>`

content = content.replace(originalUiBlock, uiReplaceStr)
fs.writeFileSync('src/components/LoginPage.jsx', content)
