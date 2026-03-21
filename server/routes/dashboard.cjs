const express = require('express')
const { getSLAStatus } = require('../autoAssign.cjs')

module.exports = (store) => {
  const router = express.Router()

  router.get('/stats', async (req, res) => {
    try {
      const [tickets, operators, logs] = await Promise.all([
        store.getTickets(),
        store.getOperators(),
        store.getAssignmentLogs()
      ])
      
      const operatorsById = new Map(operators.map((operator) => [operator.id, operator]))

      const countBy = (items, key) =>
        Object.entries(items.reduce((acc, item) => {
          const value = item[key]
          acc[value] = (acc[value] || 0) + 1
          return acc
        }, {})).map(([value, count]) => ({ [key]: value, count }))

      const activeTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status))
      let slaBreached = 0
      let slaAtRisk = 0
      let slaOk = 0

      activeTickets.forEach((ticket) => {
        const sla = getSLAStatus(ticket)
        if (sla.status === 'breached') slaBreached += 1
        else if (sla.status === 'critical' || sla.status === 'warning') slaAtRisk += 1
        else slaOk += 1
      })

      const resolvedTickets = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status))
      const slaMetCount = resolvedTickets.filter((ticket) => ticket.resolved_at && new Date(ticket.resolved_at) <= new Date(ticket.sla_deadline)).length
      const complianceRate = resolvedTickets.length ? Math.round((slaMetCount / resolvedTickets.length) * 100) : 100

      const recentTickets = [...tickets]
        .sort((left, right) => new Date(right.created_at) - new Date(left.created_at))
        .slice(0, 5)
        .map((ticket) => ({
          ...ticket,
          operator_name: operatorsById.get(ticket.assigned_to)?.name || null,
          operator_email: operatorsById.get(ticket.assigned_to)?.email || null,
          sla_status: getSLAStatus(ticket),
        }))

      const assignmentOverview = [...tickets]
        .filter((ticket) => ticket.assigned_to)
        .sort((left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at))
        .slice(0, 10)
        .map((ticket) => ({
          ...ticket,
          operator_name: operatorsById.get(ticket.assigned_to)?.name || null,
          operator_email: operatorsById.get(ticket.assigned_to)?.email || null,
          sla_status: getSLAStatus(ticket),
        }))

      // recentAssignments requires findTicketById and findOperatorById, let's fetch in parallel
      const sortedLogs = [...logs]
        .sort((left, right) => new Date(right.assigned_at) - new Date(left.assigned_at))
        .slice(0, 10)
      
      const recentAssignments = await Promise.all(
        sortedLogs.map(async (log) => {
          const ticket = await store.findTicketById(log.ticket_id)
          const operator = operatorsById.get(log.operator_id) || await store.findOperatorById(log.operator_id)
          return {
            ...log,
            ticket_title: ticket?.title || 'Unknown ticket',
            priority: ticket?.priority || 'low',
            operator_name: operator?.name || 'Unknown operator',
          }
        })
      )

      const since = new Date()
      since.setDate(since.getDate() - 7)
      const dailyMap = new Map()
      tickets
        .filter((ticket) => new Date(ticket.created_at) >= since)
        .forEach((ticket) => {
          const date = new Date(ticket.created_at).toISOString().slice(0, 10)
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1)
        })
      const dailyTickets = [...dailyMap.entries()].sort().map(([date, count]) => ({ date, count }))

      const topOperators = operators
        .map((operator) => ({
          name: operator.name,
          email: operator.email,
          total_resolved: tickets.filter((ticket) => ticket.assigned_to === operator.id && ['resolved', 'closed'].includes(ticket.status)).length,
        }))
        .sort((left, right) => right.total_resolved - left.total_resolved)
        .slice(0, 5)

      res.json({
        success: true,
        data: {
          overview: {
            total_tickets: tickets.length,
            open_tickets: tickets.filter((ticket) => ticket.status === 'open').length,
            assigned_tickets: tickets.filter((ticket) => ticket.status === 'assigned').length,
            in_progress_tickets: tickets.filter((ticket) => ticket.status === 'in_progress').length,
            resolved_tickets: tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status)).length,
          },
          sla: {
            compliance_rate: complianceRate,
            breached: slaBreached,
            at_risk: slaAtRisk,
            ok: slaOk,
          },
          tickets_by_status: countBy(tickets, 'status'),
          tickets_by_priority: countBy(tickets, 'priority'),
          tickets_by_category: countBy(tickets, 'category').sort((left, right) => right.count - left.count).slice(0, 8),
          operators: {
            total: operators.length,
            available: operators.filter((operator) => operator.status === 'available').length,
            busy: operators.filter((operator) => operator.status === 'busy').length,
            offline: operators.filter((operator) => operator.status === 'offline').length,
            total_active_tickets: operators.reduce((sum, operator) => sum + (operator.current_load || 0), 0),
          },
          recent_tickets: recentTickets,
          assignment_overview: assignmentOverview,
          recent_assignments: recentAssignments,
          daily_tickets: dailyTickets,
          top_operators: topOperators,
        },
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
