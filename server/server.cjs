require('dotenv').config()

const express = require('express')
const cors = require('cors')
const path = require('path')
const { requireAuth, requireActiveUser, requireRole, ROLES } = require('./auth.cjs')
const { initializeDatabase } = require('./database.cjs')

const app = express()
const db = initializeDatabase()

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`)
  next()
})

app.use('/api/auth', require('./routes/auth.cjs')(db))
app.use('/api/tickets', requireAuth, requireActiveUser(db), require('./routes/tickets.cjs')(db))
app.use('/api/employees', requireAuth, requireActiveUser(db), require('./routes/employees.cjs')(db))
app.use('/api/operators', requireAuth, requireActiveUser(db), require('./routes/operators.cjs')(db))
app.use('/api/dashboard', requireAuth, requireActiveUser(db), requireRole(ROLES.manager), require('./routes/dashboard.cjs')(db))

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'TicketFlow API is running',
    timestamp: new Date().toISOString(),
    database: 'connected',
  })
})

app.use((err, req, res, next) => {
  console.error('Server Error:', err.message)
  res.status(500).json({ success: false, error: 'Internal server error' })
})

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')))

  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, '../dist', 'index.html'))
  })
} else {
  // Fallback for API routes when not in production
  app.use((req, res) => {
    res.status(404).json({ success: false, error: `Route ${req.path} not found` })
  })
}

const PORT = process.env.PORT || 5000
app.listen(PORT, () => {
  console.log(`TicketFlow API running on http://localhost:${PORT}`)
})

module.exports = app
