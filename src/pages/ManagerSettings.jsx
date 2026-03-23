import { useState } from 'react'
import { AlertTriangle, KeyRound, Shield, Trash2, UserRound } from 'lucide-react'
import { getFriendlyErrorMessage } from '../lib/api.js'

export default function ManagerSettings({ API, addToast, user, onAccountDeleted }) {
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  const handleDeleteAccount = async () => {
    if (confirmText !== 'DELETE') {
      addToast('Type DELETE to confirm', 'error')
      return
    }

    setDeleting(true)
    try {
      const { data } = await API.delete('/auth/manager')
      addToast(data.message || 'Admin account deleted. A new admin can now sign up.', 'success')
      onAccountDeleted()
    } catch (err) {
      if (err.response?.status === 401) {
        return
      }

      addToast(getFriendlyErrorMessage(err, 'Failed to delete admin account'), 'error')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fade-in">
      <div className="section-header">
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Settings</h1>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <Shield size={18} color="var(--accent)" />
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>Account Information</h2>
        </div>

        <div className="responsive-two-col">
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Name</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserRound size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: 14 }}>{user?.name || 'N/A'}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Email</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <KeyRound size={14} color="var(--text-secondary)" />
              <span style={{ fontSize: 14, fontFamily: 'var(--mono)' }}>{user?.email || 'N/A'}</span>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Role</div>
            <span className="badge badge-assigned" style={{ textTransform: 'capitalize' }}>{user?.role === 'manager' ? 'Admin' : (user?.role || 'admin')}</span>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Provider</div>
            <span style={{ fontSize: 14, textTransform: 'capitalize' }}>{user?.provider || 'local'}</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 24, borderLeft: '3px solid var(--red)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={18} color="var(--red)" />
          <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>Danger Zone</h2>
        </div>

        <div style={{ marginBottom: 18 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Delete Admin Account</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>
            This will permanently delete your admin login credentials. All existing data will remain intact.
          </p>
          <p style={{ color: 'var(--red)', fontSize: 12, fontWeight: 500 }}>
            ⚠ This action cannot be undone.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ color: 'var(--red)' }}>Type <strong>DELETE</strong> to confirm</label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE here"
              style={{ borderColor: confirmText === 'DELETE' ? 'var(--red)' : undefined }}
            />
          </div>
          <button
            className="btn btn-secondary"
            onClick={handleDeleteAccount}
            disabled={confirmText !== 'DELETE' || deleting}
            style={{
              color: confirmText === 'DELETE' ? '#fff' : 'var(--text-muted)',
              background: confirmText === 'DELETE' ? 'var(--red)' : 'transparent',
              borderColor: 'rgba(248,81,73,0.4)',
              minWidth: 180,
              justifyContent: 'center',
            }}
          >
            {deleting ? (
              <><div className="spinner" style={{ width: 14, height: 14 }} /> Deleting...</>
            ) : (
              <><Trash2 size={14} /> Delete Admin Account</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
