export default function QRPage() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&display=swap"
        rel="stylesheet"
      />
      <style>{`
        @keyframes driftA {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.97); }
        }
        @keyframes driftB {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-50px, 40px) scale(1.08); }
          66% { transform: translate(30px, -20px) scale(0.95); }
        }
        @keyframes driftC {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(25px, 35px) scale(1.04); }
        }
        .qr-blob {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
        }
        .qr-blob-a {
          width: 700px; height: 600px;
          top: -180px; right: -160px;
          background: radial-gradient(ellipse at 40% 40%, rgba(210,205,200,0.38) 0%, rgba(165,160,155,0.15) 45%, transparent 75%);
          filter: blur(120px);
          animation: driftA 26s ease-in-out infinite;
        }
        .qr-blob-b {
          width: 650px; height: 750px;
          bottom: -120px; left: -180px;
          background: radial-gradient(ellipse at 60% 50%, rgba(215,208,200,0.30) 0%, rgba(170,163,155,0.11) 50%, transparent 78%);
          filter: blur(140px);
          animation: driftB 32s ease-in-out infinite;
        }
        .qr-blob-c {
          width: 500px; height: 480px;
          top: 35%; left: 25%;
          background: radial-gradient(ellipse at 50% 50%, rgba(190,183,175,0.20) 0%, transparent 70%);
          filter: blur(100px);
          animation: driftC 20s ease-in-out infinite;
        }
      `}</style>

      {/* Blob background */}
      <div className="qr-blob qr-blob-a" />
      <div className="qr-blob qr-blob-b" />
      <div className="qr-blob qr-blob-c" />

      <div
        style={{
          minHeight: '100vh',
          background: '#0a0a0f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'JetBrains Mono', monospace",
          position: 'relative',
          zIndex: 1,
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

          {/* QR code — white card for scannability */}
          <div
            style={{
              padding: 20,
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 0 60px rgba(255,140,0,0.12), 0 4px 32px rgba(0,0,0,0.4)',
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
              color: '#ffffffdd',
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            map.pulsedapp.live
          </div>

          {/* Tagline */}
          <div
            style={{
              marginTop: 14,
              color: '#ff8c00',
              fontSize: 11,
              letterSpacing: '0.14em',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            don't follow the noise
          </div>

          {/* Description */}
          <div
            style={{
              marginTop: 10,
              color: '#ffffff44',
              fontSize: 11,
              letterSpacing: '0.04em',
              fontWeight: 400,
              textAlign: 'center',
              maxWidth: 260,
              lineHeight: 1.7,
            }}
          >
            real-time map of every band playing at va-hi porchfest — see what's live, right now
          </div>

          {/* Event label */}
          <div
            style={{
              marginTop: 20,
              color: '#ffffff22',
              fontSize: 10,
              letterSpacing: '0.10em',
              fontWeight: 400,
            }}
          >
            virginia highland porchfest · may 16, 2026
          </div>
        </div>
      </div>
    </>
  )
}
