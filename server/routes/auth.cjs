const express = require('express')
const {
  ROLES,
  canBootstrapManagerAccount,
  createAuthToken,
  createUserAccount,
  emailExistsAcrossRoles,
  findOrCreateGoogleUser,
  getAuthConfig,
  getStoredUserProfile,
  isLegacyManagerUser,
  requireAuth,
  validateGoogleCredential,
  validateUserCredentials,
  hashPassword,
} = require('../auth.cjs')

function canAccessTicket(user, ticket) {
  if (user.role === ROLES.manager) return true
  if (user.role === ROLES.operator) return ticket.assigned_to === user.id
  if (ticket.reporter_user_id) return ticket.reporter_user_id === user.id
  return ticket.reporter_email?.toLowerCase() === user.email.toLowerCase()
}

module.exports = (store) => {
  const router = express.Router()
  const otpCache = new Map() // target -> { otp, expiresAt }

  const resolveRole = (role) => {
    if (!role) return null
    return Object.values(ROLES).includes(role) ? role : null
  }

  router.get('/config', async (req, res) => {
    try {
      const config = await getAuthConfig(store)
      res.json({ success: true, data: config })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/register', async (req, res) => {
    try {
      const { role, name, email, password } = req.body
      const normalizedRole = resolveRole(role)

      if (!normalizedRole) return res.status(400).json({ success: false, error: 'Choose a valid login role' })
      if (normalizedRole === ROLES.employee) return res.status(403).json({ success: false, error: 'Employee accounts are created by a manager only' })
      if (normalizedRole === ROLES.operator) return res.status(403).json({ success: false, error: 'Operator accounts are created by a manager only' })

      if (normalizedRole === ROLES.manager) {
        const canBootstrap = await canBootstrapManagerAccount(store)
        if (!canBootstrap) {
          return res.status(403).json({
            success: false,
            error: 'Manager account creation is closed. Please sign in with an approved manager account.',
          })
        }
      }

      if (!name || !email || !password) return res.status(400).json({ success: false, error: 'Name, email, and password are required' })
      if (password.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' })

      const exists = await emailExistsAcrossRoles(store, email)
      if (exists) return res.status(400).json({ success: false, error: 'An account with this email already exists' })

      const user = await createUserAccount(store, { role: normalizedRole, name, email, password })
      res.status(201).json({
        success: true,
        data: {
          token: createAuthToken(user),
          user,
        },
        message: 'Account created successfully',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/login', async (req, res) => {
    try {
      const { role, email, password } = req.body
      const normalizedRole = resolveRole(role)
      if (!normalizedRole) return res.status(400).json({ success: false, error: 'Choose a valid login role' })

      const user = await validateUserCredentials(store, normalizedRole, email, password)

      if (!user) return res.status(401).json({ success: false, error: 'Invalid email or password' })

      res.json({
        success: true,
        data: {
          token: createAuthToken(user),
          user,
        },
        message: 'Login successful',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/google', async (req, res) => {
    try {
      const { role, credential } = req.body
      const normalizedRole = resolveRole(role)

      if (!normalizedRole) return res.status(400).json({ success: false, error: 'Choose a valid login role' })
      if (normalizedRole === ROLES.employee) return res.status(403).json({ success: false, error: 'Employee Google sign-in is not enabled. Use the credentials shared by your manager.' })
      if (normalizedRole === ROLES.operator) return res.status(403).json({ success: false, error: 'Operator Google sign-in is not enabled. Use the credentials shared by your manager.' })
      if (!credential) return res.status(400).json({ success: false, error: 'Google credential is required' })

      const googleProfile = await validateGoogleCredential(credential)

      if (normalizedRole === ROLES.manager) {
        const existingManager = await store.findManagerByEmail(googleProfile.email)
        const canBootstrap = await canBootstrapManagerAccount(store)
        if (!existingManager && !canBootstrap) {
          return res.status(403).json({
            success: false,
            error: 'Manager Google sign-in is limited to approved manager accounts.',
          })
        }
      }

      const user = await findOrCreateGoogleUser(store, normalizedRole, googleProfile)

      res.json({
        success: true,
        data: {
          token: createAuthToken(user),
          user,
        },
        message: 'Google login successful',
      })
    } catch (error) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Google login failed',
      })
    }
  })

  router.delete('/manager', requireAuth, async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) return res.status(403).json({ success: false, error: 'Only managers can perform this action' })
      if (isLegacyManagerUser(req.user)) return res.status(403).json({ success: false, error: 'Legacy manager account cannot be deleted from the dashboard. Remove the MANAGER_PASSWORD environment variable instead.' })

      const manager = await store.findManagerByEmail(req.user.email)
      if (!manager) return res.status(404).json({ success: false, error: 'Manager account not found' })

      await store.deleteManager(manager.id)

      res.json({
        success: true,
        message: 'Manager account deleted. A new manager can now sign up.',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/forgot-password', async (req, res) => {
    try {
      const { email, role } = req.body
      const normalizedRole = resolveRole(role)
      if (!normalizedRole) return res.status(400).json({ success: false, error: 'Invalid role' })

      const user = await getStoredUserProfile(store, normalizedRole, email)
      if (!user) {
        return res.json({ success: true, message: 'If the email exists, an OTP was sent.' })
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString()
      otpCache.set(email.toLowerCase(), { otp, expiresAt: Date.now() + 10 * 60 * 1000 })

      console.log(`\n========================================`);
      console.log(`Mock Email sent to: ${email}`);
      console.log(`Subject: Your Password Reset OTP`);
      console.log(`OTP: ${otp}`);
      console.log(`========================================\n`);

      res.json({ success: true, message: 'OTP sent successfully (Check server console)' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/reset-password', async (req, res) => {
    try {
      const { email, role, otp, newPassword } = req.body
      const normalizedRole = resolveRole(role)
      
      if (!email || !otp || !newPassword) return res.status(400).json({ success: false, error: 'Missing required fields' })
      if (newPassword.length < 8) return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' })

      const cached = otpCache.get(email.toLowerCase())
      if (!cached) return res.status(400).json({ success: false, error: 'OTP expired or invalid' })
      if (Date.now() > cached.expiresAt) {
        otpCache.delete(email.toLowerCase())
        return res.status(400).json({ success: false, error: 'OTP expired' })
      }
      if (cached.otp !== otp) return res.status(400).json({ success: false, error: 'Invalid OTP' })

      const user = await getStoredUserProfile(store, normalizedRole, email)
      if (!user) return res.status(404).json({ success: false, error: 'User not found' })

      const hashed = hashPassword(newPassword)
      if (normalizedRole === ROLES.manager) await store.updateManager(user.id, { password_hash: hashed })
      else if (normalizedRole === ROLES.employee) await store.updateEmployee(user.id, { password_hash: hashed })
      else if (normalizedRole === ROLES.operator) await store.updateOperator(user.id, { password_hash: hashed })

      otpCache.delete(email.toLowerCase())

      res.json({ success: true, message: 'Password reset successfully' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.get('/me', requireAuth, async (req, res) => {
    try {
      const user = isLegacyManagerUser(req.user)
        ? req.user
        : await getStoredUserProfile(store, req.user.role, req.user.email)

      if (!user) {
        return res.status(401).json({ success: false, error: 'This account is no longer available. Please contact your manager.' })
      }

      res.json({
        success: true,
        data: { user },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/logout', requireAuth, (req, res) => {
    res.json({
      success: true,
      message: 'Logged out successfully',
    })
  })

  return router
}
