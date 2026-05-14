'use client'

import { useEffect, useRef, useCallback } from 'react'

// ─── Constants ──────────────────────────────────────────────────────────────
const W = 800
const H = 300
const GROUND = H - 60
const GRAVITY = 0.6
const JUMP_FORCE = -13
const BASE_SPEED = 5
const ORANGE = '#ff8c00'
const DIM = '#333'
const BG = '#0a0a0f'
const GROUND_COLOR = '#1a1a1a'

// ─── Types ───────────────────────────────────────────────────────────────────
type Obstacle = { x: number; w: number; h: number; type: 'speaker' | 'cable' | 'amp' }
type Particle = { x: number; y: number; vx: number; vy: number; life: number; color: string }

// ─── Draw helpers ────────────────────────────────────────────────────────────
function drawDJ(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, dead: boolean) {
  const t = frame * 0.3
  const legSwing = dead ? 0 : Math.sin(t) * 6
  const color = dead ? '#ff3333' : ORANGE

  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 3
  ctx.lineCap = 'round'

  // legs
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 22)
  ctx.lineTo(x + 10 + legSwing, y + 38)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 22)
  ctx.lineTo(x + 10 - legSwing, y + 38)
  ctx.stroke()

  // body
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 8)
  ctx.lineTo(x + 10, y + 22)
  ctx.stroke()

  // arms (bobbing)
  const armBob = dead ? 10 : Math.sin(t * 0.8) * 3
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 12)
  ctx.lineTo(x - 2, y + 18 + armBob)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x + 10, y + 12)
  ctx.lineTo(x + 22, y + 16 - armBob)
  ctx.stroke()

  // head
  ctx.beginPath()
  ctx.arc(x + 10, y + 4, 6, 0, Math.PI * 2)
  ctx.fill()

  // headphones
  ctx.strokeStyle = dead ? '#ff3333' : '#fff'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(x + 10, y + 4, 8, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
  ctx.fillStyle = dead ? '#ff3333' : '#fff'
  ctx.beginPath()
  ctx.arc(x + 2, y + 5, 2.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(x + 18, y + 5, 2.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

function drawSpeaker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.strokeStyle = ORANGE
  ctx.fillStyle = '#0f0f1a'
  ctx.lineWidth = 2
  // box
  ctx.strokeRect(x, y, w, h)
  ctx.fillRect(x, y, w, h)
  // speaker cone circles
  ctx.strokeStyle = ORANGE
  const cx = x + w / 2, cy = y + h / 2
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.3, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.15, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = ORANGE
  ctx.beginPath(); ctx.arc(cx, cy, w * 0.05, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function drawCable(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save()
  ctx.strokeStyle = ORANGE
  ctx.lineWidth = 3
  ctx.lineCap = 'round'
  // squiggly cable on ground
  ctx.beginPath()
  ctx.moveTo(x, y + 20)
  for (let i = 0; i <= 20; i++) {
    ctx.lineTo(x + i * 2, y + 20 + Math.sin(i * 0.8) * 6)
  }
  ctx.stroke()
  // plug
  ctx.fillStyle = '#555'
  ctx.fillRect(x - 4, y + 14, 8, 12)
  ctx.fillStyle = ORANGE
  ctx.fillRect(x - 1, y + 26, 2, 8)
  ctx.restore()
}

function drawAmp(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = '#111'
  ctx.strokeStyle = ORANGE
  ctx.lineWidth = 2
  ctx.fillRect(x, y, w, h)
  ctx.strokeRect(x, y, w, h)
  // knobs
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ORANGE
    ctx.beginPath()
    ctx.arc(x + 8 + i * 10, y + 10, 3, 0, Math.PI * 2)
    ctx.fill()
  }
  // VU strip
  ctx.fillStyle = '#0f0f1a'
  ctx.fillRect(x + 4, y + 18, w - 8, 8)
  ctx.fillStyle = ORANGE
  ctx.fillRect(x + 4, y + 18, (w - 8) * 0.6, 8)
  ctx.restore()
}

function drawObstacle(ctx: CanvasRenderingContext2D, obs: Obstacle) {
  if (obs.type === 'speaker') drawSpeaker(ctx, obs.x, GROUND - obs.h, obs.w, obs.h)
  else if (obs.type === 'cable') drawCable(ctx, obs.x, GROUND - obs.h)
  else drawAmp(ctx, obs.x, GROUND - obs.h, obs.w, obs.h)
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function DJRunPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef({
    running: false,
    dead: false,
    started: false,
    djY: GROUND - 40,
    djVY: 0,
    onGround: true,
    obstacles: [] as Obstacle[],
    particles: [] as Particle[],
    score: 0,
    hi: 0,
    frame: 0,
    speed: BASE_SPEED,
    nextObstacle: 80,
    raf: 0,
  })

  const jump = useCallback(() => {
    const s = stateRef.current
    if (s.dead) {
      // restart
      s.dead = false
      s.djY = GROUND - 40
      s.djVY = 0
      s.onGround = true
      s.obstacles = []
      s.particles = []
      s.score = 0
      s.frame = 0
      s.speed = BASE_SPEED
      s.nextObstacle = 80
      s.started = true
      s.running = true
      return
    }
    if (!s.started) {
      s.started = true
      s.running = true
      return
    }
    if (s.onGround) {
      s.djVY = JUMP_FORCE
      s.onGround = false
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    function spawnObstacle() {
      const types: Obstacle['type'][] = ['speaker', 'cable', 'amp']
      const type = types[Math.floor(Math.random() * types.length)]
      const config = {
        speaker: { w: 36, h: 52 },
        cable: { w: 44, h: 34 },
        amp: { w: 38, h: 44 },
      }
      stateRef.current.obstacles.push({ x: W + 20, type, ...config[type] })
    }

    function spawnParticles(x: number, y: number) {
      for (let i = 0; i < 14; i++) {
        stateRef.current.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 6,
          vy: (Math.random() - 0.5) * 6 - 2,
          life: 1,
          color: Math.random() > 0.5 ? ORANGE : '#fff',
        })
      }
    }

    function loop() {
      const s = stateRef.current
      ctx.fillStyle = BG
      ctx.fillRect(0, 0, W, H)

      // ground
      ctx.fillStyle = GROUND_COLOR
      ctx.fillRect(0, GROUND, W, 2)
      // dashes
      ctx.fillStyle = '#222'
      for (let i = 0; i < W; i += 40) {
        ctx.fillRect((i - (s.frame * s.speed * 0.5) % 40 + 40) % W, GROUND + 6, 20, 2)
      }

      if (!s.started) {
        // idle screen
        drawDJ(ctx, 80, s.djY, s.frame, false)
        ctx.fillStyle = '#fff'
        ctx.font = `700 14px 'JetBrains Mono', monospace`
        ctx.textAlign = 'center'
        ctx.fillText('PRESS SPACE OR TAP TO JAM', W / 2, H / 2 - 10)
        ctx.fillStyle = ORANGE
        ctx.font = `700 28px 'JetBrains Mono', monospace`
        ctx.fillText('DJ RUN', W / 2, H / 2 + 22)
        s.frame++
        stateRef.current.raf = requestAnimationFrame(loop)
        return
      }

      if (s.running) {
        s.frame++
        s.score += 1
        s.speed = BASE_SPEED + Math.floor(s.score / 400) * 0.5

        // physics
        s.djVY += GRAVITY
        s.djY += s.djVY
        if (s.djY >= GROUND - 40) {
          s.djY = GROUND - 40
          s.djVY = 0
          s.onGround = true
        }

        // spawn
        s.nextObstacle--
        if (s.nextObstacle <= 0) {
          spawnObstacle()
          s.nextObstacle = Math.floor(60 + Math.random() * 80 - Math.floor(s.score / 400) * 5)
        }

        // move obstacles + collision
        for (const obs of s.obstacles) {
          obs.x -= s.speed
          // AABB hit — slightly forgiving
          const djLeft = 68, djRight = 92, djTop = s.djY, djBottom = s.djY + 40
          const oLeft = obs.x + 4, oRight = obs.x + obs.w - 4
          const oTop = GROUND - obs.h + 4
          if (djRight > oLeft && djLeft < oRight && djBottom > oTop) {
            s.running = false
            s.dead = true
            if (s.score > s.hi) s.hi = s.score
            spawnParticles(80, s.djY + 20)
          }
        }
        s.obstacles = s.obstacles.filter(o => o.x > -80)

        // particles
        for (const p of s.particles) {
          p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.04
        }
        s.particles = s.particles.filter(p => p.life > 0)
      }

      // draw obstacles
      for (const obs of s.obstacles) drawObstacle(ctx, obs)

      // draw particles
      for (const p of s.particles) {
        ctx.save()
        ctx.globalAlpha = p.life
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, 4, 4)
        ctx.restore()
      }

      // draw DJ
      drawDJ(ctx, 80, s.djY, s.frame, s.dead)

      // score
      ctx.font = `700 14px 'JetBrains Mono', monospace`
      ctx.textAlign = 'right'
      ctx.fillStyle = DIM
      ctx.fillText(`HI ${String(Math.floor(s.hi / 10)).padStart(5, '0')}`, W - 16, 30)
      ctx.fillStyle = ORANGE
      ctx.fillText(String(Math.floor(s.score / 10)).padStart(5, '0'), W - 16, 50)

      // game over
      if (s.dead) {
        ctx.fillStyle = 'rgba(10,10,15,0.6)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = `700 20px 'JetBrains Mono', monospace`
        ctx.textAlign = 'center'
        ctx.fillText('SET ENDED', W / 2, H / 2 - 16)
        ctx.fillStyle = ORANGE
        ctx.font = `600 13px 'JetBrains Mono', monospace`
        ctx.fillText('PRESS SPACE OR TAP TO PLAY AGAIN', W / 2, H / 2 + 14)
      }

      stateRef.current.raf = requestAnimationFrame(loop)
    }

    stateRef.current.raf = requestAnimationFrame(loop)

    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump() }
    }
    window.addEventListener('keydown', onKey)
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); jump() }, { passive: false })
    canvas.addEventListener('click', jump)

    return () => {
      cancelAnimationFrame(stateRef.current.raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [jump])

  return (
    <div style={{
      minHeight: '100vh',
      background: BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'JetBrains Mono', monospace",
      userSelect: 'none',
    }}>
      {/* wordmark */}
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.3em',
        textTransform: 'uppercase', marginBottom: 20,
        background: 'linear-gradient(90deg, #ff8c00, #ff6b20)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
      }}>
        PULSED
      </div>

      {/* canvas */}
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        style={{
          border: '1px solid #1a1a2e',
          borderRadius: 8,
          cursor: 'pointer',
          maxWidth: '100%',
          touchAction: 'none',
        }}
      />

      <p style={{ marginTop: 16, fontSize: 11, color: '#333', letterSpacing: '0.06em' }}>
        SPACE / TAP TO JUMP · DODGE THE GEAR
      </p>
    </div>
  )
}
