const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { DEFAULT_OPERATOR_PASSWORD, ROLES, hashPassword } = require('../auth.cjs')
const { autoAssignTicket } = require('../autoAssign.cjs')
const { normalizeSkills } = require('../taxonomy.cjs')

const VALID_OPERATOR_STATUSES = ['available', 'busy', 'offline']

function serializeOperator(operator) {
  const { password_hash, ...safeOperator } = operator
  const current_load = safeOperator.current_load || 0
  const max_load = safeOperator.max_load || 5
  return {
    ...safeOperator,
    load_percentage: Math.round((current_load / max_load) * 100),
    available_slots: max_load - current_load,
  }
}

module.exports = (store) => {
  const router = express.Router()

  router.get('/me', async (req, res) => {
    try {
      if (req.user.role !== ROLES.operator) {
        return res.status(403).json({ success: false, error: 'Only operators can view this profile' })
      }

      const operator = await store.findOperatorById(req.user.id)
      if (!operator) {
        return res.status(404).json({ success: false, error: 'Operator not found' })
      }

      res.json({ success: true, data: serializeOperator(operator) })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.put('/me/status', async (req, res) => {
    try {
      if (req.user.role !== ROLES.operator) {
        return res.status(403).json({ success: false, error: 'Only operators can update their own status' })
      }

      const { status } = req.body
      if (!['available', 'busy', 'offline'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Choose available, busy, or offline' })
      }

      const operator = await store.findOperatorById(req.user.id)
      if (!operator) {
        return res.status(404).json({ success: false, error: 'Operator not found' })
      }

      const updated = await store.updateOperator(req.user.id, { status })
      res.json({ success: true, data: serializeOperator(updated), message: `Status updated to ${status}` })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.get('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can view all operators' })
      }

      const { status } = req.query
      const allOperators = await store.getOperators()
      const operators = allOperators
        .filter((operator) => !status || operator.status === status)
        .sort((left, right) => (left.current_load || 0) - (right.current_load || 0) || left.name.localeCompare(right.name))
        .map(serializeOperator)

      res.json({ success: true, data: operators, count: operators.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can create operators' })
      }

      const { name, email, skills, max_load = 5, status = 'available', password } = req.body
      if (!name || !email || !skills || !Array.isArray(skills)) {
        return res.status(400).json({ success: false, error: 'Required: name, email, skills (array)' })
      }
      const normalizedSkills = normalizeSkills(skills)
      if (!normalizedSkills.length) {
        return res.status(400).json({ success: false, error: 'Select at least one valid support category' })
      }
      const normalizedMaxLoad = Number.parseInt(max_load, 10)
      if (!Number.isInteger(normalizedMaxLoad) || normalizedMaxLoad < 1) {
        return res.status(400).json({ success: false, error: 'Max ticket load must be at least 1' })
      }
      if (!VALID_OPERATOR_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, error: 'Choose available, busy, or offline' })
      }

      const existingOperators = await store.getOperators()
      if (existingOperators.some((operator) => operator.email.toLowerCase() === email.toLowerCase())) {
        return res.status(400).json({ success: false, error: 'Email already exists' })
      }

      const resolvedPassword = String(password || '').trim() || DEFAULT_OPERATOR_PASSWORD

      const operator = {
        id: uuidv4(),
        name,
        email: email.toLowerCase(),
        skills: normalizedSkills,
        current_load: 0,
        max_load: normalizedMaxLoad,
        status,
        role: ROLES.operator,
        provider: 'local',
        password_hash: hashPassword(resolvedPassword),
        created_at: new Date().toISOString(),
      }

      await store.insertOperator(operator)

      res.status(201).json({
        success: true,
        data: {
          operator: serializeOperator(operator),
          credentials: {
            email: operator.email,
            password: resolvedPassword,
          },
        },
        message: `Operator ${name} added successfully`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can update operators' })
      }

      const { status, max_load, skills, password } = req.body
      const operator = await store.findOperatorById(req.params.id)
      if (!operator) {
        return res.status(404).json({ success: false, error: 'Operator not found' })
      }
      const updates = {}

      if (status) {
        if (!VALID_OPERATOR_STATUSES.includes(status)) {
          return res.status(400).json({ success: false, error: 'Choose available, busy, or offline' })
        }
        updates.status = status
      }

      if (max_load !== undefined) {
        const normalizedMaxLoad = Number.parseInt(max_load, 10)
        if (!Number.isInteger(normalizedMaxLoad) || normalizedMaxLoad < 1) {
          return res.status(400).json({ success: false, error: 'Max ticket load must be at least 1' })
        }
        updates.max_load = normalizedMaxLoad
      }

      if (skills !== undefined) {
        const normalizedSkills = normalizeSkills(skills)
        if (!normalizedSkills.length) {
          return res.status(400).json({ success: false, error: 'Select at least one valid support category' })
        }
        updates.skills = normalizedSkills
      }

      if (String(password || '').trim()) {
        updates.password_hash = hashPassword(String(password).trim())
      }

      const updated = await store.updateOperator(req.params.id, updates)

      res.json({ success: true, data: serializeOperator(updated), message: 'Operator updated successfully' })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/:id/reset-password', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can reset operator passwords' })
      }

      const operator = await store.findOperatorById(req.params.id)
      if (!operator) {
        return res.status(404).json({ success: false, error: 'Operator not found' })
      }

      const resolvedPassword = String(req.body?.password || '').trim() || DEFAULT_OPERATOR_PASSWORD
      if (resolvedPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' })
      }

      const updated = await store.updateOperator(operator.id, {
        password_hash: hashPassword(resolvedPassword),
      })

      res.json({
        success: true,
        data: {
          operator: serializeOperator(updated),
          credentials: {
            email: updated.email,
            password: resolvedPassword,
          },
        },
        message: `Password reset for ${updated.name}`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can remove operators' })
      }

      const operator = await store.findOperatorById(req.params.id)
      if (!operator) {
        return res.status(404).json({ success: false, error: 'Operator not found' })
      }

      const allTickets = await store.getTickets()
      const activeTickets = allTickets.filter((ticket) => ticket.assigned_to === operator.id && !['resolved', 'closed'].includes(ticket.status))

      await store.deleteOperator(operator.id)

      let reassignedCount = 0
      let queuedCount = 0

      // Execute assignments sequentially to update operator loads accurately
      for (const ticket of activeTickets) {
        await store.updateTicket(ticket.id, {
          assigned_to: null,
          status: 'open',
          updated_at: new Date().toISOString(),
        })

        const result = await autoAssignTicket(store, {
          ...ticket,
          assigned_to: null,
          status: 'open',
        })

        if (result?.success) {
          reassignedCount += 1
        } else {
          queuedCount += 1
        }
      }

      res.json({
        success: true,
        data: {
          removed_operator: {
            id: operator.id,
            name: operator.name,
            email: operator.email,
          },
          affected_tickets: activeTickets.length,
          reassigned_tickets: reassignedCount,
          queued_tickets: queuedCount,
        },
        message: activeTickets.length
          ? `Operator ${operator.name} removed. ${reassignedCount} ticket${reassignedCount !== 1 ? 's' : ''} reassigned and ${queuedCount} queued.`
          : `Operator ${operator.name} removed successfully.`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
