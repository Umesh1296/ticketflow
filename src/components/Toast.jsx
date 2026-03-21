import { AlertCircle, CheckCircle2, Info } from 'lucide-react'

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

export default function Toast({ message, type = 'info' }) {
  const Icon = ICONS[type] || Info

  return (
    <div className={`toast ${type}`}>
      <Icon size={16} />
      <div>{message}</div>
    </div>
  )
}
