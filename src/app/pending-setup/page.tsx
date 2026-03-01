export default function PendingSetupPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f8fafc',
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#fffbeb',
            border: '2px solid #fde68a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            margin: '0 auto 20px',
          }}
        >
          !
        </div>
        <h1
          style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#0f172a',
            marginBottom: 8,
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}
        >
          Account pending setup
        </h1>
        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
          Your account has been created but hasn&apos;t been assigned a role yet. Please contact
          your manager to get access.
        </p>
        <form action="/auth/signout" method="post" style={{ marginTop: 20 }}>
          <button
            type="submit"
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '8px 16px',
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#334155',
              cursor: 'pointer',
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
