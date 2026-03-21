const TICKET_CATEGORIES = Object.freeze([
  'billing',
  'technical',
  'network',
  'hardware',
  'software',
  'account',
  'subscription',
  'infrastructure',
])

const CATEGORY_ALIASES = Object.freeze({
  payment: 'billing',
  refund: 'billing',
  connectivity: 'network',
  installation: 'software',
  device: 'hardware',
  server: 'infrastructure',
  password: 'account',
  security: 'account',
})

function normalizeCategory(value) {
  const normalized = String(value || '').trim().toLowerCase()
  return CATEGORY_ALIASES[normalized] || normalized
}

function isSupportedCategory(value) {
  return TICKET_CATEGORIES.includes(normalizeCategory(value))
}

function normalizeSkills(skills) {
  const nextSkills = []
  const seen = new Set()

  for (const skill of Array.isArray(skills) ? skills : []) {
    const normalized = normalizeCategory(skill)
    if (!isSupportedCategory(normalized) || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    nextSkills.push(normalized)
  }

  return nextSkills
}

module.exports = {
  TICKET_CATEGORIES,
  normalizeCategory,
  normalizeSkills,
  isSupportedCategory,
}
