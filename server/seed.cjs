const { v4: uuidv4 } = require('uuid')
const { initializeDatabase } = require('./database.cjs')
const { autoAssignTicket, calculateSLADeadline } = require('./autoAssign.cjs')

const store = initializeDatabase()

const operators = [
  { id: uuidv4(), name: 'Alice Johnson', email: 'alice@support.com', skills: ['billing', 'account', 'subscription'], max_load: 6, status: 'available' },
  { id: uuidv4(), name: 'Bob Martinez', email: 'bob@support.com', skills: ['technical', 'network'], max_load: 5, status: 'available' },
  { id: uuidv4(), name: 'Carol White', email: 'carol@support.com', skills: ['technical', 'software'], max_load: 5, status: 'available' },
  { id: uuidv4(), name: 'David Chen', email: 'david@support.com', skills: ['hardware', 'technical'], max_load: 4, status: 'available' },
  { id: uuidv4(), name: 'Emma Wilson', email: 'emma@support.com', skills: ['billing', 'subscription'], max_load: 6, status: 'available' },
  { id: uuidv4(), name: 'Frank Kumar', email: 'frank@support.com', skills: ['network', 'infrastructure'], max_load: 4, status: 'available' },
  { id: uuidv4(), name: 'Grace Lee', email: 'grace@support.com', skills: ['account', 'technical'], max_load: 7, status: 'available' },
  { id: uuidv4(), name: 'Henry Brown', email: 'henry@support.com', skills: ['hardware', 'network', 'technical'], max_load: 5, status: 'offline' },
]

const ticketTemplates = [
  { title: 'Cannot connect to internet - entire office down', description: 'Our entire office cannot connect to the internet since 9 AM. Business is halted.', priority: 'critical', category: 'network', reporter_name: 'John Smith', reporter_email: 'john.smith@company.com' },
  { title: 'Server crash - production database unreachable', description: 'Production server crashed. Database is unreachable and customers are affected.', priority: 'critical', category: 'infrastructure', reporter_name: 'Sarah Connor', reporter_email: 'sarah@techcorp.com' },
  { title: 'Double charged for subscription', description: 'I was charged twice for my annual subscription this month. Please refund immediately.', priority: 'high', category: 'billing', reporter_name: 'Mike Davis', reporter_email: 'mike.davis@gmail.com' },
  { title: 'Cannot login - password reset not working', description: 'I have been locked out of my account and password reset emails are not arriving.', priority: 'high', category: 'account', reporter_name: 'Lisa Anderson', reporter_email: 'lisa.a@outlook.com' },
  { title: 'Software installation fails', description: 'Installation fails on Windows 11 with error code 0x80070005.', priority: 'high', category: 'software', reporter_name: 'Tom Wilson', reporter_email: 'twilson@business.net' },
  { title: 'Laptop screen flickering intermittently', description: 'Screen starts flickering after 30 minutes of use and the issue persists after driver updates.', priority: 'medium', category: 'hardware', reporter_name: 'Amy Zhang', reporter_email: 'amy.zhang@company.org' },
  { title: 'Slow internet speed', description: 'Internet speed is consistently half of the expected bandwidth.', priority: 'medium', category: 'network', reporter_name: 'Carlos Rivera', reporter_email: 'carlos.r@home.com' },
  { title: 'Invoice PDF not generating correctly', description: 'Downloaded invoice is missing line items and totals do not match.', priority: 'medium', category: 'billing', reporter_name: 'Patricia Kim', reporter_email: 'pkim@finance.co' },
  { title: 'Request to upgrade subscription plan', description: 'Please upgrade our current plan from Basic to Premium without losing data.', priority: 'low', category: 'subscription', reporter_name: 'Robert Taylor', reporter_email: 'r.taylor@email.com' },
  { title: 'Need to add secondary email to account', description: 'I want to add a backup email for security notifications.', priority: 'low', category: 'account', reporter_name: 'Diana Prince', reporter_email: 'diana.p@webmail.com' },
]

store.replaceAll({
  managers: store.getManagers(),
  employees: store.getEmployees(),
  operators: [],
  tickets: [],
  assignment_logs: [],
  sla_rules: store.getSlaRules(),
})

operators.forEach((operator) => {
  store.insertOperator({
    ...operator,
    current_load: 0,
    created_at: new Date().toISOString(),
  })
})

const slaRules = store.getSlaRules()

ticketTemplates.forEach((ticketTemplate) => {
  const createdAt = new Date()
  createdAt.setHours(createdAt.getHours() - Math.floor(Math.random() * 72))
  const id = uuidv4()
  const slaDeadline = calculateSLADeadline(ticketTemplate.priority, slaRules)

  const ticket = {
    id,
    title: ticketTemplate.title,
    description: ticketTemplate.description,
    priority: ticketTemplate.priority,
    category: ticketTemplate.category,
    status: 'open',
    assigned_to: null,
    created_at: createdAt.toISOString(),
    updated_at: createdAt.toISOString(),
    sla_deadline: slaDeadline,
    resolved_at: null,
    reporter_name: ticketTemplate.reporter_name,
    reporter_email: ticketTemplate.reporter_email,
  }

  store.insertTicket(ticket)
  autoAssignTicket(store, ticket)
})

console.log('Seeded TicketFlow sample data.')
