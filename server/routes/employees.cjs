const express = require('express')
const {
  DEFAULT_EMPLOYEE_PASSWORD,
  ROLES,
  createUserAccount,
  emailExistsAcrossRoles,
  hashPassword,
} = require('../auth.cjs')

async function getEmployeeTicketStats(store, employee) {
  const employeeEmail = String(employee.email || '').toLowerCase()
  const allTickets = await store.getTickets()
  const tickets = allTickets.filter((ticket) => ticket.reporter_user_id === employee.id || ticket.reporter_email?.toLowerCase() === employeeEmail)

  const activeTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status))
  const resolvedTickets = tickets.filter((ticket) => ['resolved', 'closed'].includes(ticket.status))
  const lastTicket = [...tickets].sort((left, right) => new Date(right.created_at) - new Date(left.created_at))[0] || null

  return {
    total_tickets: tickets.length,
    active_tickets: activeTickets.length,
    resolved_tickets: resolvedTickets.length,
    last_ticket_at: lastTicket?.created_at || null,
  }
}

async function serializeEmployee(store, employee) {
  const stats = await getEmployeeTicketStats(store, employee)
  return {
    id: employee.id,
    display_id: employee.display_id || null,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    provider: employee.provider || 'local',
    created_at: employee.created_at || null,
    last_set_password: employee.last_set_password || null,
    ...stats,
  }
}

module.exports = (store) => {
  const router = express.Router()

  router.get('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only managers can view employees' })
      }

      const rawEmployees = await store.getEmployees()
      const employees = await Promise.all(
        rawEmployees.map((employee) => serializeEmployee(store, employee))
      )
      
      employees.sort((left, right) => new Date(right.created_at) - new Date(left.created_at))

      res.json({ success: true, data: employees, count: employees.length })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only managers can create employees' })
      }

      const { name, email, password } = req.body
      if (!name || !email) {
        return res.status(400).json({ success: false, error: 'Name and email are required' })
      }

      if (await emailExistsAcrossRoles(store, email)) {
        return res.status(400).json({ success: false, error: 'An account with this email already exists' })
      }

      const resolvedPassword = String(password || '').trim() || DEFAULT_EMPLOYEE_PASSWORD
      if (resolvedPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' })
      }

      const user = await createUserAccount(store, {
        role: ROLES.employee,
        name: String(name).trim(),
        email: String(email).trim(),
        password: resolvedPassword,
      })

      const employee = await store.findEmployeeById(user.id)
      const serialized = await serializeEmployee(store, employee)

      // Build display-id-based password
      const finalPassword = !String(password || '').trim() && employee.display_id ? `Enduser@${employee.display_id}` : resolvedPassword
      // Re-hash with the ID-based password if we used the default
      if (!String(password || '').trim() && employee.display_id) {
        await store.updateEmployee(employee.id, { password_hash: hashPassword(finalPassword), last_set_password: finalPassword })
      } else {
        await store.updateEmployee(employee.id, { last_set_password: finalPassword })
      }

      const updatedSerialized = await serializeEmployee(store, await store.findEmployeeById(user.id))

      res.status(201).json({
        success: true,
        data: {
          employee: updatedSerialized,
          credentials: {
            email: employee.email,
            password: finalPassword,
          },
        },
        message: `End user ${employee.name} added successfully`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.post('/:id/reset-password', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only managers can reset employee passwords' })
      }

      const employee = await store.findEmployeeById(req.params.id)
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' })
      }

      // Use ID-based default password if no custom password provided
      const customPassword = String(req.body?.password || '').trim()
      const resolvedPassword = customPassword || (employee.display_id ? `Enduser@${employee.display_id}` : DEFAULT_EMPLOYEE_PASSWORD)
      if (resolvedPassword.length < 8) {
        return res.status(400).json({ success: false, error: 'Password must be at least 8 characters long' })
      }

      const updatedEmployee = await store.updateEmployee(employee.id, {
        password_hash: hashPassword(resolvedPassword),
        last_set_password: resolvedPassword,
        provider: 'local',
        google_sub: null,
      })

      const serialized = await serializeEmployee(store, updatedEmployee)

      res.json({
        success: true,
        data: {
          employee: serialized,
          credentials: {
            email: updatedEmployee.email,
            password: resolvedPassword,
          },
        },
        message: `Password reset for ${updatedEmployee.name}`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  router.delete('/:id', async (req, res) => {
    try {
      if (req.user.role !== ROLES.manager) {
        return res.status(403).json({ success: false, error: 'Only managers can remove employees' })
      }

      const employee = await store.findEmployeeById(req.params.id)
      if (!employee) {
        return res.status(404).json({ success: false, error: 'Employee not found' })
      }

      const stats = await getEmployeeTicketStats(store, employee)
      await store.deleteEmployee(employee.id)

      res.json({
        success: true,
        data: {
          removed_employee: {
            id: employee.id,
            name: employee.name,
            email: employee.email,
          },
          tickets_retained: stats.total_tickets,
        },
        message: `Employee ${employee.name} removed. ${stats.total_tickets} ticket${stats.total_tickets !== 1 ? 's remain' : ' remains'} in history.`,
      })
    } catch (err) {
      res.status(500).json({ success: false, error: err.message })
    }
  })

  return router
}
