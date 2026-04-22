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
        @keyframes driftD {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40% { transform: translate(-30px, -40px) scale(1.06); }
          80% { transform: translate(20px, 15px) scale(0.96); }
        }
        .qr-blob {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
        }
        .qr-blob-a {
          width: 900px; height: 800px;
          top: -220px; right: -200px;
          background: radial-gradient(ellipse at 40% 40%, rgba(215,208,200,0.58) 0%, rgba(170,163,155,0.28) 40%, rgba(130,125,120,0.08) 65%, transparent 80%);
          filter: blur(110px);
          animation: driftA 26s ease-in-out infinite;
        }
        .qr-blob-b {
          width: 850px; height: 900px;
          bottom: -160px; left: -220px;
          background: radial-gradient(ellipse at 60% 50%, rgba(210,205,198,0.50) 0%, rgba(165,160,153,0.22) 45%, rgba(120,115,110,0.06) 68%, transparent 82%);
          filter: blur(130px);
          animation: driftB 32s ease-in-out infinite;
        }
        .qr-blob-c {
          width: 600px; height: 560px;
          top: 30%; left: 20%;
          background: radial-gradient(ellipse at 50% 50%, rgba(200,193,183,0.38) 0%, rgba(155,148,138,0.12) 55%, transparent 75%);
          filter: blur(90px);
          animation: driftC 20s ease-in-out infinite;
        }
        .qr-blob-d {
          width: 500px; height: 420px;
          top: 10%; left: 5%;
          background: radial-gradient(ellipse at 55% 45%, rgba(255,140,0,0.08) 0%, rgba(255,120,0,0.03) 50%, transparent 72%);
          filter: blur(100px);
          animation: driftD 38s ease-in-out infinite;
        }
      `}</style>

      {/* Blob background */}
      <div className="qr-blob qr-blob-a" />
      <div className="qr-blob qr-blob-b" />
      <div className="qr-blob qr-blob-c" />
      <div className="qr-blob qr-blob-d" />

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
