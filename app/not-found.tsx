export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "'JetBrains Mono', monospace",
      textAlign: 'center',
    }}>

      {/* Wordmark — orange gradient */}
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        marginBottom: 32,
        background: 'linear-gradient(90deg, #ff8c00, #ff6b20)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
        PULSED
      </div>

      {/* 404 number */}
      <div style={{
        fontSize: 96,
        fontWeight: 700,
        color: '#e8e8e8',
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
        color: '#111',
        letterSpacing: '-0.02em',
      }}>
        lost in the noise?
      </p>
      <p style={{
        marginTop: 8,
        fontSize: 13,
        color: '#999',
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
          background: 'linear-gradient(90deg, #ff8c00, #ff6b20)',
          color: '#fff',
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
