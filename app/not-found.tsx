export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'JetBrains Mono', monospace",
      textAlign: 'center',
    }}>

      {/* Wordmark */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.3em',
        color: '#ff8c00',
        textTransform: 'uppercase',
        marginBottom: 32,
      }}>
        PULSED
      </div>

      {/* 404 number */}
      <div style={{
        fontSize: 96,
        fontWeight: 700,
        color: '#1a1a2e',
        lineHeight: 1,
        letterSpacing: '-0.04em',
        userSelect: 'none',
      }}>
        404
      </div>

      {/* Message */}
      <p style={{
        marginTop: 24,
        fontSize: 18,
        fontWeight: 600,
        color: '#f0f0f0',
        letterSpacing: '-0.02em',
      }}>
        lost in the noise?
      </p>
      <p style={{
        marginTop: 8,
        fontSize: 13,
        color: '#555',
        maxWidth: 280,
        lineHeight: 1.6,
      }}>
        this page doesn&apos;t exist — but there&apos;s live music that does.
      </p>

      {/* CTA */}
      <a
        href="https://map.pulsedapp.live"
        style={{
          marginTop: 36,
          display: 'inline-block',
          padding: '12px 28px',
          background: '#ff8c00',
          color: '#000',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textDecoration: 'none',
          borderRadius: 8,
          textTransform: 'uppercase',
        }}
      >
        back to the map →
      </a>

    </div>
  )
}
