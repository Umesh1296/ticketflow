const { v4: uuidv4 } = require('uuid')

function calculateAssignmentScore(operator, ticket) {
  let score = 0
  const reasons = []
  const operatorSkills = operator.skills || []
  const ticketCategory = ticket.category.toLowerCase()

  const hasExactSkill = operatorSkills.some((skill) => skill.toLowerCase() === ticketCategory)
  const hasRelatedSkill = operatorSkills.some(
    (skill) => skill.toLowerCase().includes(ticketCategory) || ticketCategory.includes(skill.toLowerCase()),
  )

  if (hasExactSkill) {
    score += 50
    reasons.push(`Exact skill match for "${ticket.category}"`)
  } else if (hasRelatedSkill) {
    score += 25
    reasons.push(`Related skill match for "${ticket.category}"`)
  } else {
    score += 5
    reasons.push('No direct skill match (general assignment)')
  }

  const loadRatio = operator.max_load > 0 ? (operator.current_load || 0) / operator.max_load : 1

  if (loadRatio === 0) {
    score += 30
    reasons.push('Completely free (no active tickets)')
  } else if (loadRatio <= 0.25) {
    score += 25
    reasons.push('Very light workload')
  } else if (loadRatio <= 0.5) {
    score += 15
    reasons.push('Moderate workload')
  } else if (loadRatio <= 0.75) {
    score += 8
    reasons.push('Heavy workload')
  } else {
    score += 2
    reasons.push('Near capacity')
  }

  if (operator.status === 'available') {
    score += 20
    reasons.push('Operator is available')
  } else if (operator.status === 'busy') {
    score += 5
    reasons.push('Operator is busy but can take more')
  }

  if (ticket.priority === 'critical' && loadRatio === 0) {
    score += 15
    reasons.push('Critical ticket priority boost')
  }

  return { score, reasons }
}

async function autoAssignTicket(store, ticket) {
  const allOperators = await store.getOperators()
  const operators = allOperators
    .filter((operator) => operator.status !== 'offline' && (operator.current_load || 0) < operator.max_load)
    .sort((left, right) => (left.current_load || 0) - (right.current_load || 0))

  if (operators.length === 0) {
    return {
      success: false,
      reason: 'No available operators at this time. Ticket queued.',
    }
  }

  const scored = operators.map((operator) => {
    const { score, reasons } = calculateAssignmentScore(operator, ticket)
    return { operator, score, reasons }
  })

  scored.sort((left, right) => right.score - left.score)

  const winner = scored[0]
  const { operator, score, reasons } = winner
  const now = new Date().toISOString()
  const currentLoad = operator.current_load || 0
  const nextLoad = currentLoad + 1

  await store.updateTicket(ticket.id, {
    assigned_to: operator.id,
    status: 'assigned',
    updated_at: now,
  })

  await store.updateOperator(operator.id, {
    current_load: nextLoad,
    status: nextLoad >= operator.max_load ? 'busy' : operator.status,
  })

  await store.insertAssignmentLog({
    id: uuidv4(),
    ticket_id: ticket.id,
    operator_id: operator.id,
    reason: reasons.join('; '),
    score,
    assigned_at: now,
  })

  return {
    success: true,
    operator: {
      id: operator.id,
      name: operator.name,
      email: operator.email,
    },
    score,
    reasons,
    allCandidates: scored.map((candidate) => ({
      name: candidate.operator.name,
      score: candidate.score,
    })),
  }
}

function calculateSLADeadline(priority, slaRules) {
  const rule = slaRules.find((item) => item.priority === priority)
  const hours = rule ? rule.hours_limit : 24
  const deadline = new Date()
  deadline.setHours(deadline.getHours() + hours)
  return deadline.toISOString()
}

function getSLAStatus(ticket) {
  const now = new Date()
  const deadline = new Date(ticket.sla_deadline)
  const diffMs = deadline - now
  const diffHours = diffMs / (1000 * 60 * 60)

  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    return { status: 'met', label: 'SLA Met', color: 'green' }
  }

  if (diffMs < 0) {
    return { status: 'breached', label: `Breached ${Math.abs(Math.round(diffHours))}h ago`, color: 'red' }
  }

  if (diffHours <= 1) {
    return { status: 'critical', label: `${Math.round(diffHours * 60)}m remaining`, color: 'red' }
  }

  if (diffHours <= 4) {
    return { status: 'warning', label: `${Math.round(diffHours)}h remaining`, color: 'orange' }
  }

  return { status: 'ok', label: `${Math.round(diffHours)}h remaining`, color: 'green' }
}

module.exports = { autoAssignTicket, calculateSLADeadline, getSLAStatus }
