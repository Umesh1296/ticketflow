const express = require('express')
const { v4: uuidv4 } = require('uuid')
const { ROLES } = require('../auth.cjs')
const { autoAssignTicket, calculateSLADeadline, getSLAStatus } = require('../autoAssign.cjs')
const { isSupportedCategory, normalizeCategory } = require('../taxonomy.cjs')

const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low']

function canAccessTicket(user, ticket) {
  if (user.role === ROLES.manager) return true
  if (user.role === ROLES.operator) return ticket.assigned_to === user.id
  if (ticket.reporter_user_id) return ticket.reporter_user_id === user.id
  return ticket.reporter_email?.toLowerCase() === user.email.toLowerCase()
}

module.exports = (store) => {
  const router = express.Router()

  const handleResolution = async (ticket, now) => {
    const operator = await store.findOperatorById(ticket.assigned_to)
    if (operator) {
      const nextLoad = Math.max(0, (operator.current_load || 0) - 1)
      await store.updateOperator(operator.id, {
        current_load: nextLoad,
        status: nextLoad < operator.max_load && operator.status !== 'offline' ? 'available' : operator.status,
      })
    }
    await store.insertReport({
      id: uuidv4(),
      ticket_id: ticket.id,
      ticket: { ...ticket, status: 'resolved', resolved_at: now },
      resolved_at: now,
      operator_name: operator?.name || 'Unknown',
      operator_email: operator?.email || 'Unknown',
      reporter_name: ticket.reporter_name,
      reporter_email: ticket.reporter_email,
      sla_status: getSLAStatus({ ...ticket, status: 'resolved', resolved_at: now })
    })
  }

  router.get('/', async (req, res) => {
    try {
      const { status, priority, category, assigned_to } = req.query
      const normalizedCategoryFilter = category ? normalizeCategory(category) : null
      
      const operators = await store.getOperators()
      const operatorsById = new Map(operators.map((operator) => [operator.id, operator]))

      const allTickets = await store.getTickets()
      const tickets = allTickets
        .filter((ticket) => canAccessTicket(req.user, ticket))
        .filter((ticket) => !status || ticket.status === status)
        .filter((ticket) => !priority || ticket.priority === priority)
        .filter((ticket) => !normalizedCategoryFilter || ticket.category === normalizedCategoryFilter)
        .filter((ticket) => !assigned_to || ticket.assigned_to === assigned_to)
        .sort((left, right) => {
          const priorityRank = { critical: 1, high: 2, medium: 3, low: 4 }
          return priorityRank[left.priority] - priorityRank[right.priority] || new Date(right.created_at) - new Date(left.created_at)
        })
        .map((ticket) => {
          const operator = operatorsById.get(ticket.assigned_to)
          return {
            ...ticket,
            operator_name: operator?.name || null,
            operator_email: operator?.email || null,
            sla_status: getSLAStatus(ticket),
          }
        })

      res.json({ success: true, data: tickets, count: tickets.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.get('/reports', async (req, res) => {
    try {
      const allReports = await store.getReports()
      const reports = allReports
        .filter((report) => canAccessTicket(req.user, report.ticket))
        .sort((left, right) => new Date(right.resolved_at) - new Date(left.resolved_at))
      res.json({ success: true, data: reports })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.get('/:id', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket || !canAccessTicket(req.user, ticket)) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const operator = await store.findOperatorById(ticket.assigned_to)
      let logs = []
      
      if (req.user.role === ROLES.manager) {
        const allLogs = await store.getAssignmentLogs()
        const ticketLogs = allLogs
          .filter((log) => log.ticket_id === req.params.id)
          .sort((left, right) => new Date(right.assigned_at) - new Date(left.assigned_at))
        
        logs = await Promise.all(ticketLogs.map(async (log) => {
          const op = await store.findOperatorById(log.operator_id)
          return {
            ...log,
            operator_name: op?.name || null,
          }
        }))
      }

      res.json({
        success: true,
        data: {
          ...ticket,
          operator_name: operator?.name || null,
          operator_email: operator?.email || null,
          sla_status: getSLAStatus(ticket),
          assignment_history: logs,
        },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.employee) {
        return res.status(403).json({ success: false, error: 'Only employees can raise new tickets' })
      }

      const { title, description, priority, category } = req.body
      if (!title || !description || !priority || !category) {
        return res.status(400).json({ success: false, error: 'Missing required fields' })
      }
      if (!VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Choose a valid priority level' })
      }
      const normalizedCategory = normalizeCategory(category)
      if (!isSupportedCategory(normalizedCategory)) {
        return res.status(400).json({ success: false, error: 'Choose a valid ticket category' })
      }

      const rules = await store.getSlaRules()

      const now = new Date().toISOString()
      const ticket = {
        id: uuidv4(),
        title,
        description,
        priority,
        category: normalizedCategory,
        status: 'open',
        assigned_to: null,
        created_at: now,
        updated_at: now,
        sla_deadline: calculateSLADeadline(priority, rules),
        resolved_at: null,
        reporter_name: req.user.name,
        reporter_email: req.user.email,
        reporter_user_id: req.user.id,
      }

      await store.insertTicket(ticket)
      const assignmentResult = await autoAssignTicket(store, ticket)
      const finalTicket = await store.findTicketById(ticket.id)
      const operator = await store.findOperatorById(finalTicket.assigned_to)

      res.status(201).json({
        success: true,
        data: {
          ticket: {
            ...finalTicket,
            operator_name: operator?.name || null,
            sla_status: getSLAStatus(finalTicket),
          },
          assignment: assignmentResult,
        },
        message: assignmentResult?.success
          ? `Ticket created and assigned to ${assignmentResult.operator.name}`
          : 'Ticket created. No operators available for auto-assignment.',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.put('/:id', async (req, res) => {
    try {
      const ticket = await store.findTicketById(req.params.id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      const now = new Date().toISOString()
      let resolvedAt = ticket.resolved_at

      if (req.user.role === ROLES.operator) {
        if (!canAccessTicket(req.user, ticket)) {
          return res.status(403).json({ success: false, error: 'This ticket is not assigned to you' })
        }

        const { status } = req.body
        if (!['in_progress', 'resolved', 'closed'].includes(status)) {
          return res.status(400).json({ success: false, error: 'Operators can mark tickets as in progress, resolved, or closed only' })
        }

        if ((status === 'resolved' || status === 'closed') && !['resolved', 'closed'].includes(ticket.status) && ticket.assigned_to) {
          resolvedAt = now
          await handleResolution(ticket, now)
        }

        const updated = await store.updateTicket(req.params.id, {
          status,
          resolved_at: status === 'resolved' ? resolvedAt : ticket.resolved_at,
          updated_at: now,
        })

        const assignedOperator = await store.findOperatorById(updated.assigned_to)
        return res.json({
          success: true,
          data: {
            ...updated,
            operator_name: assignedOperator?.name || null,
            sla_status: getSLAStatus(updated),
          },
          message: `Ticket marked as ${status.replace('_', ' ')}`,
        })
      }

      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can update ticket workflow' })
      }

      const { status, priority } = req.body
      if (priority && !VALID_PRIORITIES.includes(priority)) {
        return res.status(400).json({ success: false, error: 'Choose a valid priority level' })
      }

      if ((status === 'resolved' || status === 'closed') && !['resolved', 'closed'].includes(ticket.status)) {
        resolvedAt = now
        if (ticket.assigned_to) {
          await handleResolution(ticket, now)
        }
      }

      const updated = await store.updateTicket(req.params.id, {
        status: status || ticket.status,
        priority: priority || ticket.priority,
        resolved_at: resolvedAt,
        updated_at: now,
      })

      const operator = await store.findOperatorById(updated.assigned_to)
      res.json({
        success: true,
        data: {
          ...updated,
          operator_name: operator?.name || null,
          sla_status: getSLAStatus(updated),
        },
        message: 'Ticket updated successfully',
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/:id/reassign', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can reassign tickets' })
      }

      const ticket = await store.findTicketById(req.params.id)
      if (!ticket) {
        return res.status(404).json({ success: false, error: 'Ticket not found' })
      }

      if (ticket.assigned_to) {
        const operator = await store.findOperatorById(ticket.assigned_to)
        if (operator) {
          await store.updateOperator(operator.id, {
            current_load: Math.max(0, (operator.current_load || 0) - 1),
          })
        }
        await store.updateTicket(ticket.id, {
          assigned_to: null,
          status: 'open',
        })
      }

      const result = await autoAssignTicket(store, { ...ticket, assigned_to: null, status: 'open' })
      res.json({ success: true, data: result, message: result.success ? `Reassigned to ${result.operator.name}` : result.reason })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.get('/:id/logs', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only admin can view assignment logs' })
      }

      const allLogs = await store.getAssignmentLogs()
      const sortedLogs = allLogs
        .filter((log) => log.ticket_id === req.params.id)
        .sort((left, right) => new Date(right.assigned_at) - new Date(left.assigned_at))

      const logs = await Promise.all(sortedLogs.map(async (log) => {
        const operator = await store.findOperatorById(log.operator_id)
        return {
          ...log,
          operator_name: operator?.name || null,
          operator_email: operator?.email || null,
        }
      }))

      res.json({ success: true, data: logs })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
