const mongoose = require('mongoose')
const dns = require('dns')
dns.setServers(['8.8.8.8', '8.8.4.4'])
const {
  Manager,
  Employee,
  Operator,
  Ticket,
  AssignmentLog,
  Report,
  SlaRule
} = require('./models.cjs')
const { isSupportedCategory, normalizeCategory, normalizeSkills } = require('./taxonomy.cjs')

const DEFAULT_SLA_RULES = [
  { priority: 'critical', hours_limit: 1, description: 'Critical issues must be resolved within 1 hour' },
  { priority: 'high', hours_limit: 4, description: 'High priority issues must be resolved within 4 hours' },
  { priority: 'medium', hours_limit: 24, description: 'Medium priority issues must be resolved within 24 hours' },
  { priority: 'low', hours_limit: 72, description: 'Low priority issues must be resolved within 72 hours' },
]

function initializeDatabase() {
  if (mongoose.connection.readyState === 0) {
    if (!process.env.MONGO_URI) {
      console.error('\n🚨 CRITICAL ERROR: MONGO_URI is missing from .env\nPlease create a MongoDB database and provide the connection string in the .env file.\n')
    } else {
      mongoose.connect(process.env.MONGO_URI)
        .then(async () => {
          console.log('✅ Connected to MongoDB successfully.')
          const rules = await SlaRule.find()
          if (rules.length === 0) {
            await SlaRule.insertMany(DEFAULT_SLA_RULES)
            console.log('Inserted default SLA rules.')
          }
        })
        .catch(err => console.error('❌ MongoDB Connection Error:', err))
    }
  }

  return {
    async getManagers() { return Manager.find().lean() },
    async getEmployees() { return Employee.find().lean() },
    async getOperators() { return Operator.find().lean() },
    async getTickets() { return Ticket.find().lean() },
    async getAssignmentLogs() { return AssignmentLog.find().lean() },
    async getReports() { return Report.find().lean() },
    async getSlaRules() { return SlaRule.find().lean() },

    async findManagerById(id) { return Manager.findOne({ id }).lean() },
    async findManagerByEmail(email) { return Manager.findOne({ email: new RegExp(`^${email}$`, 'i') }).lean() },
    async findEmployeeById(id) { return Employee.findOne({ id }).lean() },
    async findEmployeeByEmail(email) { return Employee.findOne({ email: new RegExp(`^${email}$`, 'i') }).lean() },
    async findOperatorById(id) { return Operator.findOne({ id }).lean() },
    async findOperatorByEmail(email) { return Operator.findOne({ email: new RegExp(`^${email}$`, 'i') }).lean() },
    async findTicketById(id) { return Ticket.findOne({ id }).lean() },

    async insertManager(manager) { 
      const doc = new Manager(manager)
      await doc.save()
      return doc.toObject()
    },
    async insertEmployee(employee) { 
      const doc = new Employee(employee)
      await doc.save()
      return doc.toObject()
    },
    async insertOperator(operator) { 
      const skills = normalizeSkills(operator.skills)
      const doc = new Operator({ ...operator, skills: skills.length ? skills : ['technical'] })
      await doc.save()
      return doc.toObject()
    },
    async insertTicket(ticket) { 
      const doc = new Ticket({ ...ticket, category: normalizeCategory(ticket.category) })
      await doc.save()
      return doc.toObject()
    },
    async insertAssignmentLog(log) { 
      const doc = new AssignmentLog(log)
      await doc.save()
      return doc.toObject()
    },
    async insertReport(report) { 
      const doc = new Report(report)
      await doc.save()
      return doc.toObject()
    },

    async updateManager(id, updates) { return Manager.findOneAndUpdate({ id }, updates, { new: true }).lean() },
    async deleteManager(id) { return Manager.findOneAndDelete({ id }).lean() },
    async updateEmployee(id, updates) { return Employee.findOneAndUpdate({ id }, updates, { new: true }).lean() },
    async deleteEmployee(id) { return Employee.findOneAndDelete({ id }).lean() },
    async updateOperator(id, updates) { return Operator.findOneAndUpdate({ id }, updates, { new: true }).lean() },
    async deleteOperator(id) { return Operator.findOneAndDelete({ id }).lean() },
    async updateTicket(id, updates) { return Ticket.findOneAndUpdate({ id }, updates, { new: true }).lean() },
    
    // For local fallback compatibility
    async replaceAll() { throw new Error('replaceAll not supported in MongoDB adapter') },
    async save() { /* no-op in Mongo */ }
  }
}

module.exports = { initializeDatabase }
