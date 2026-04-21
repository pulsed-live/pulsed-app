export default function QRPage() {
  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div
        style={{
          minHeight: '100vh',
          background: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0,
            padding: '64px 48px',
          }}
        >
          {/* PULSED wordmark */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 48,
            }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: '50%',
                background: '#ff8c00',
                display: 'inline-block',
                boxShadow: '0 0 10px #ff8c00aa',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                color: '#ff8c00',
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.18em',
              }}
            >
              PULSED
            </span>
          </div>

          {/* QR code */}
          <div
            style={{
              padding: 16,
              background: '#ffffff',
              border: '1.5px solid #e8e8e8',
              borderRadius: 16,
              boxShadow: '0 2px 24px rgba(0,0,0,0.07)',
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=https://map.pulsedapp.live"
              alt="QR code linking to map.pulsedapp.live"
              width={300}
              height={300}
              style={{ display: 'block', borderRadius: 4 }}
            />
          </div>

          {/* URL label */}
          <div
            style={{
              marginTop: 28,
              color: '#1a1a1a',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            map.pulsedapp.live
          </div>

          {/* Event label */}
          <div
            style={{
              marginTop: 10,
              color: '#999999',
              fontSize: 11,
              letterSpacing: '0.08em',
              fontWeight: 400,
            }}
          >
            va-hi porchfest 2026
          </div>
        </div>
      </div>
    </>
  )
}
