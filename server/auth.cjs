const crypto = require('crypto')
const { v4: uuidv4 } = require('uuid')
const { OAuth2Client } = require('google-auth-library')

const ROLES = {
  manager: 'manager',
  employee: 'employee',
  operator: 'operator',
}

const LEGACY_MANAGER_PROFILE = {
  id: 'legacy-manager',
  name: process.env.MANAGER_NAME || 'TicketFlow Manager',
  email: process.env.MANAGER_EMAIL || 'manager@ticketflow.local',
  role: ROLES.manager,
  provider: 'legacy',
}

const LEGACY_MANAGER_PASSWORD = process.env.MANAGER_PASSWORD || ''
const DEFAULT_EMPLOYEE_PASSWORD = process.env.EMPLOYEE_DEFAULT_PASSWORD || 'Employee@123'
const DEFAULT_OPERATOR_PASSWORD = process.env.OPERATOR_DEFAULT_PASSWORD || 'Operator@123'
const AUTH_SECRET = process.env.TICKETFLOW_AUTH_SECRET || 'ticketflow-local-secret'
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || ''
const SESSION_TTL_MS = 1000 * 60 * 60 * 12

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null

function sign(value) {
  return crypto.createHmac('sha256', AUTH_SECRET).update(value).digest('base64url')
}

function getRoleCollection(role) {
  if (role === ROLES.manager) return 'Managers'
  if (role === ROLES.operator) return 'Operators'
  return 'Employees'
}

function getRoleMethods(store, role) {
  if (role === ROLES.manager) {
    return {
      all: store.getManagers.bind(store),
      findByEmail: store.findManagerByEmail.bind(store),
      findById: store.findManagerById.bind(store),
      insert: store.insertManager.bind(store),
      update: store.updateManager.bind(store),
    }
  }

  if (role === ROLES.operator) {
    return {
      all: store.getOperators.bind(store),
      findByEmail: store.findOperatorByEmail.bind(store),
      findById: store.findOperatorById.bind(store),
      insert: store.insertOperator.bind(store),
      update: store.updateOperator.bind(store),
    }
  }

  return {
    all: store.getEmployees.bind(store),
    findByEmail: store.findEmployeeByEmail.bind(store),
    findById: store.findEmployeeById.bind(store),
    insert: store.insertEmployee.bind(store),
    update: store.updateEmployee.bind(store),
  }
}

function isValidRole(role) {
  return Object.values(ROLES).includes(role)
}

function sanitizeUser(user, fallbackRole = null) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role || fallbackRole || null,
    provider: user.provider || 'local',
  }
}

function createAuthToken(user) {
  const payload = {
    ...sanitizeUser(user),
    exp: Date.now() + SESSION_TTL_MS,
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encodedPayload}.${sign(encodedPayload)}`
}

function verifyAuthToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) {
    return null
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'))
    if (!payload.exp || payload.exp < Date.now()) {
      return null
    }

    return sanitizeUser(payload, ROLES.manager)
  } catch {
    return null
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.includes(':')) {
    return false
  }

  const [salt, storedHash] = storedPasswordHash.split(':')
  const derivedHash = crypto.scryptSync(password, salt, 64)
  const storedBuffer = Buffer.from(storedHash, 'hex')

  return storedBuffer.length === derivedHash.length && crypto.timingSafeEqual(storedBuffer, derivedHash)
}

async function emailExistsAcrossRoles(store, email) {
  const [manager, employee, operator] = await Promise.all([
    store.findManagerByEmail(email),
    store.findEmployeeByEmail(email),
    store.findOperatorByEmail(email)
  ])
  
  return Boolean(
    manager || employee || operator ||
    (LEGACY_MANAGER_PASSWORD && LEGACY_MANAGER_PROFILE.email.toLowerCase() === String(email).toLowerCase())
  )
}

async function canBootstrapManagerAccount(store) {
  const managers = await store.getManagers()
  return managers.length === 0 && !LEGACY_MANAGER_PASSWORD
}

async function createUserAccount(store, { role, name, email, password, provider = 'local', google_sub = null }) {
  const methods = getRoleMethods(store, role)
  const user = {
    id: uuidv4(),
    name,
    email: email.toLowerCase(),
    password_hash: password ? hashPassword(password) : null,
    provider,
    google_sub,
    role,
    created_at: new Date().toISOString(),
  }

  await methods.insert(user)
  return sanitizeUser(user, role)
}

async function getAuthConfig(store) {
  const managerBootstrapEnabled = await canBootstrapManagerAccount(store)
  const [managers, employees, operators] = await Promise.all([
    store.getManagers(),
    store.getEmployees(),
    store.getOperators()
  ])

  return {
    googleEnabled: Boolean(GOOGLE_CLIENT_ID),
    googleClientId: GOOGLE_CLIENT_ID || null,
    localRegistrationEnabled: true,
    localRegistrationRoles: managerBootstrapEnabled ? [ROLES.manager] : [],
    googleAuthRoles: GOOGLE_CLIENT_ID ? [ROLES.manager] : [],
    managerCount: managers.length,
    employeeCount: employees.length,
    operatorCount: operators.length,
    legacyLoginEnabled: Boolean(LEGACY_MANAGER_PASSWORD),
    managerBootstrapEnabled,
    roles: Object.values(ROLES),
  }
}

async function getStoredUserProfile(store, role, email) {
  if (!isValidRole(role)) return null

  const methods = getRoleMethods(store, role)
  let user = await methods.findByEmail(email)
  if (!user) return null

  if (user.role !== role) {
    await methods.update(user.id, { role })
  }

  const freshUser = await methods.findById(user.id)
  return sanitizeUser(freshUser || user, role)
}

function getLegacyManagerProfile() {
  return { ...LEGACY_MANAGER_PROFILE }
}

function isLegacyManagerUser(user) {
  return Boolean(
    user
    && user.role === ROLES.manager
    && user.email?.toLowerCase() === LEGACY_MANAGER_PROFILE.email.toLowerCase()
    && LEGACY_MANAGER_PASSWORD,
  )
}

async function validateUserCredentials(store, role, email, password) {
  if (!isValidRole(role)) return null

  const methods = getRoleMethods(store, role)
  let user = await methods.findByEmail(email)

  if (user) {
    if (user.role !== role) {
      await methods.update(user.id, { role })
    }

    const latestUser = await methods.findById(user.id) || user

    if (role === ROLES.operator && !latestUser.password_hash) {
      if (password === DEFAULT_OPERATOR_PASSWORD) {
        return sanitizeUser(latestUser, role)
      }
    } else if (verifyPassword(password, latestUser.password_hash)) {
      return sanitizeUser(latestUser, role)
    }
  }

  if (
    role === ROLES.manager
    && email?.toLowerCase() === LEGACY_MANAGER_PROFILE.email.toLowerCase()
    && password === LEGACY_MANAGER_PASSWORD
  ) {
    return getLegacyManagerProfile()
  }

  return null
}

async function validateGoogleCredential(credential) {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    const error = new Error('Google sign-in is not configured yet')
    error.statusCode = 503
    throw error
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: GOOGLE_CLIENT_ID,
  })

  const payload = ticket.getPayload()
  if (!payload?.email || !payload.email_verified) {
    const error = new Error('Your Google account email could not be verified')
    error.statusCode = 401
    throw error
  }

  return {
    name: payload.name || payload.email.split('@')[0],
    email: payload.email.toLowerCase(),
    google_sub: payload.sub,
    provider: 'google',
  }
}

async function findOrCreateGoogleUser(store, role, googleProfile) {
  if (!isValidRole(role)) throw new Error('Invalid role provided')

  const methods = getRoleMethods(store, role)
  const existingUser = await methods.findByEmail(googleProfile.email)

  if (existingUser) {
    if (existingUser.provider !== 'google' || existingUser.google_sub !== googleProfile.google_sub || existingUser.role !== role) {
      await methods.update(existingUser.id, {
        provider: 'google',
        google_sub: googleProfile.google_sub,
        role,
      })
    }

    const updatedUser = await methods.findById(existingUser.id)
    return sanitizeUser(updatedUser || existingUser, role)
  }

  if (await emailExistsAcrossRoles(store, googleProfile.email)) {
    const error = new Error('This email is already used by another account')
    error.statusCode = 409
    throw error
  }

  return await createUserAccount(store, {
    role,
    name: googleProfile.name,
    email: googleProfile.email,
    password: null,
    provider: 'google',
    google_sub: googleProfile.google_sub,
  })
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  const user = verifyAuthToken(token)

  if (!user) return res.status(401).json({ success: false, error: 'Authentication required' })

  req.user = user
  next()
}

function requireActiveUser(store) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'Authentication required' })
      }

      if (isLegacyManagerUser(req.user)) {
        return next()
      }

      const user = await getStoredUserProfile(store, req.user.role, req.user.email)
      if (!user) {
        return res.status(401).json({ success: false, error: 'This account is no longer available. Please contact your manager.' })
      }

      req.user = user
      next()
    } catch (err) {
      res.status(500).json({ success: false, error: 'Internal server error' })
    }
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Authentication required' })

    if (!allowedRoles.includes(req.user.role)) {
      const roleLabel = req.user.role || 'This account'
      return res.status(403).json({ success: false, error: `${roleLabel} access is not allowed here` })
    }

    next()
  }
}

module.exports = {
  DEFAULT_EMPLOYEE_PASSWORD,
  DEFAULT_OPERATOR_PASSWORD,
  ROLES,
  createAuthToken,
  createUserAccount,
  emailExistsAcrossRoles,
  findOrCreateGoogleUser,
  getAuthConfig,
  getRoleCollection,
  getStoredUserProfile,
  hashPassword,
  canBootstrapManagerAccount,
  requireAuth,
  requireActiveUser,
  requireRole,
  sanitizeUser,
  isLegacyManagerUser,
  validateGoogleCredential,
  validateUserCredentials,
}
