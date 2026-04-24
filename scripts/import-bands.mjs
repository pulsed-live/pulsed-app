#!/usr/bin/env node
/**
 * import-bands.mjs
 *
 * Usage:
 *   node scripts/import-bands.mjs bands.csv [--prod] [--dry-run] [--date YYYY-MM-DD]
 *
 * Flags:
 *   --prod       POST to https://map.pulsedapp.live  (default: http://localhost:3000)
 *   --dry-run    Print what would be sent without POSTing
 *   --date       Event date in YYYY-MM-DD format (default: today's date in local time)
 *
 * Auth:
 *   Set ADMIN_TOKEN env var, or the script falls back to "porchfest-admin-2026"
 *
 * CSV columns (with header row):
 *   bandName, genre, address, startTime, endTime
 *   startTime / endTime are HH:MM (24-hour)
 */

import fs from 'fs'
import http from 'http'
import https from 'https'
import { URL } from 'url'

// ---------------------------------------------------------------------------
// Parse CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2)

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`Usage: node scripts/import-bands.mjs <bands.csv> [--prod] [--dry-run] [--date YYYY-MM-DD]`)
  process.exit(0)
}

const csvPath = args[0]
const isProd = args.includes('--prod')
const isDryRun = args.includes('--dry-run')

// Optional event date override
const dateIndex = args.indexOf('--date')
let eventDate
if (dateIndex !== -1 && args[dateIndex + 1]) {
  eventDate = args[dateIndex + 1]
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    console.error('--date must be in YYYY-MM-DD format')
    process.exit(1)
  }
} else {
  // Default to today in local time
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  eventDate = `${y}-${m}-${d}`
}

const BASE_URL = process.env.BASE_URL
  || (isProd ? 'https://pulsed-app-alpha.vercel.app' : 'http://localhost:3000')

const ENDPOINT = `${BASE_URL}/api/admin/add-set`
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'porchfest-admin-2026'

// ---------------------------------------------------------------------------
// CSV parser — handles quoted fields with commas inside
// ---------------------------------------------------------------------------
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  const parseLine = (line) => {
    const fields = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped double-quote inside a quoted field
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    fields.push(current.trim())
    return fields
  }

  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length < 2) return []

  const headers = parseLine(nonEmpty[0]).map((h) => h.trim())
  const rows = []

  for (let i = 1; i < nonEmpty.length; i++) {
    const values = parseLine(nonEmpty[i])
    if (values.every((v) => v === '')) continue
    const row = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] !== undefined ? values[idx] : ''
    })
    rows.push(row)
  }

  return rows
}

// ---------------------------------------------------------------------------
// HTTP/HTTPS POST helper (no fetch, pure built-ins)
// ---------------------------------------------------------------------------
function postJSON(urlStr, body, headers) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body)
    const parsed = new URL(urlStr)
    const isSecure = parsed.protocol === 'https:'
    const lib = isSecure ? https : http

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isSecure ? 443 : 80),
      path: parsed.pathname + (parsed.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    }

    const req = lib.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })

    req.on('error', reject)
    req.write(payload)
    req.end()
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`)
    process.exit(1)
  }

  const raw = fs.readFileSync(csvPath, 'utf8')
  const rows = parseCSV(raw)

  if (rows.length === 0) {
    console.error('No data rows found in CSV.')
    process.exit(1)
  }

  // Validate required columns exist
  const required = ['bandName', 'genre', 'address', 'startTime', 'endTime']
  const firstRow = rows[0]
  const missing = required.filter((col) => !(col in firstRow))
  if (missing.length > 0) {
    console.error(`CSV is missing required columns: ${missing.join(', ')}`)
    console.error(`Expected: ${required.join(', ')}`)
    process.exit(1)
  }

  console.log(`\nTarget: ${ENDPOINT}`)
  console.log(`Event date: ${eventDate}`)
  if (isDryRun) console.log('Mode: DRY RUN — no requests will be sent')
  console.log(`Rows to process: ${rows.length}\n`)

  let added = 0
  let failed = 0

  for (const row of rows) {
    const { bandName, genre, address, startTime, endTime } = row

    if (!bandName || !genre || !address || !startTime || !endTime) {
      console.log(`✗ Skipped (missing fields): ${bandName || '(no name)'}`)
      failed++
      continue
    }

    // Build full datetime strings with EDT offset (event is May 16 in Virginia Highland, Atlanta)
    const startFull = `${eventDate}T${startTime}:00-04:00`
    const endFull = `${eventDate}T${endTime}:00-04:00`

    const payload = { bandName, genre, address, startTime: startFull, endTime: endFull }

    if (isDryRun) {
      console.log(`  [dry-run] Would POST to ${ENDPOINT}`)
      console.log(`  Payload: ${JSON.stringify(payload)}`)
      console.log(`✓ (dry-run) ${bandName}`)
      added++
      continue
    }

    // Nominatim rate limit: 1 req/sec
    await new Promise(r => setTimeout(r, 1200))

    try {
      const result = await postJSON(ENDPOINT, payload, { 'x-admin-token': ADMIN_TOKEN })

      if (result.status === 200 || result.status === 201) {
        console.log(`✓ Added: ${bandName}`)
        added++
      } else {
        const errMsg =
          typeof result.body === 'object' && result.body.error
            ? result.body.error
            : JSON.stringify(result.body)
        console.log(`✗ Failed: ${bandName} — HTTP ${result.status}: ${errMsg}`)
        failed++
      }
    } catch (err) {
      console.log(`✗ Failed: ${bandName} — ${err.message}`)
      failed++
    }
  }

  console.log(`\nDone. ${added} added, ${failed} failed.`)
}

main()
