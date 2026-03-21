const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')
const dns = require('dns')
dns.setServers(['8.8.8.8', '8.8.4.4'])
require('dotenv').config({ path: path.join(__dirname, '../.env') })
const {
  Manager,
  Employee,
  Operator,
  Ticket,
  AssignmentLog,
  Report,
  SlaRule
} = require('./models.cjs')

const DB_PATH = path.join(__dirname, 'ticketflow-data.json')

async function migrate() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('MONGO_URI is missing from .env')
    process.exit(1)
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log('No ticketflow-data.json found. Nothing to migrate.')
    process.exit(0)
  }

  console.log('Connecting to MongoDB...')
  try {
    await mongoose.connect(mongoUri)
    console.log('Connected!')

    const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'))
    
    // Helper to insert data, ignoring duplicates (id collision)
    const insertData = async (Model, items, name) => {
      if (!items || items.length === 0) return
      let added = 0
      for (const item of items) {
        // use id or unique fallback
        const exists = await Model.findOne({ id: item.id || crypto.randomUUID() })
        if (!exists) {
          try {
            await Model.create(item)
            added++
          } catch (e) {
            console.error(`Error inserting ${name} ${item.id}:`, e.message)
          }
        }
      }
      console.log(`Migrated ${added}/${items.length} ${name} (Skipped existing)`)
    }

    await insertData(Manager, data.managers, 'Managers')
    await insertData(Employee, data.employees, 'Employees')
    await insertData(Operator, data.operators, 'Operators')
    await insertData(Ticket, data.tickets, 'Tickets')
    await insertData(AssignmentLog, data.assignment_logs, 'Assignment Logs')
    await insertData(Report, data.reports, 'Reports')

    // Sla Rules
    if (data.sla_rules && data.sla_rules.length > 0) {
      for (const rule of data.sla_rules) {
        const exists = await SlaRule.findOne({ priority: rule.priority })
        if (!exists) {
          await SlaRule.create(rule)
        }
      }
      console.log('Migrated SLA Rules')
    }

    console.log('\nMigration Complete! Data from ticketflow-data.json has been safely copied to MongoDB.')
    console.log('You can now use the application. The JSON file is no longer used and can be deleted.')
    process.exit(0)
  } catch (err) {
    console.error('Migration failed:', err)
    process.exit(1)
  }
}

migrate()
