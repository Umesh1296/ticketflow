export const TICKET_CATEGORIES = Object.freeze([
  'billing',
  'technical',
  'network',
  'hardware',
  'software',
  'account',
  'subscription',
  'infrastructure',
])

export function formatCategoryLabel(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
