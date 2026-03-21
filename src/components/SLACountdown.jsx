import { useEffect, useState } from 'react'

export default function SLACountdown({ deadline, status }) {
  const [timeLeft, setTimeLeft] = useState('')
  const [isBreached, setIsBreached] = useState(false)

  useEffect(() => {
    if (status === 'resolved' || status === 'closed') {
      setTimeLeft('SLA stopped (Resolved)')
      setIsBreached(false)
      return
    }

    if (!deadline) {
      setTimeLeft('No SLA')
      setIsBreached(false)
      return
    }

    const updateTimer = () => {
      const now = new Date().getTime()
      const target = new Date(deadline).getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft('SLA Breached')
        setIsBreached(true)
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s remaining`)
        setIsBreached(false)
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)

    return () => clearInterval(timer)
  }, [deadline, status])

  const color = status === 'resolved' || status === 'closed'
    ? 'var(--text-muted)'
    : isBreached
      ? 'var(--red)'
      : 'var(--amber)'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {isBreached && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1s infinite' }} />}
      {!isBreached && status !== 'resolved' && status !== 'closed' && deadline && (
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amber)', opacity: 0.8 }} />
      )}
      <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color, fontWeight: isBreached ? 600 : 500 }}>
        {timeLeft}
      </span>
    </div>
  )
}
