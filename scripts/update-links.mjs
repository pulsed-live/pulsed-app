#!/usr/bin/env node
// Reads links from GenreLink tab and updates acts in Supabase
// Run: node scripts/update-links.mjs

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

// Load env
const fs = await import('fs')
const env = fs.readFileSync(join(ROOT, '.env.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL="([^"]+)"/)?.[1]
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY="([^"]+)"/)?.[1]

if (!url || !key) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

// Read GenreLink sheet
const wb = XLSX.readFile(join(ROOT, 'PF26 Bands + Hosts Matching.xlsx'))
const ws = wb.Sheets['GenreLink']
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 })

const links = []
for (let i = 2; i < rows.length; i++) {
  const [name, , link] = rows[i]
  if (name && link) links.push({ name: name.trim(), link: link.trim() })
}

console.log(`Found ${links.length} bands with links`)

let updated = 0, skipped = 0, failed = 0

for (const { name, link } of links) {
  const res = await fetch(`${url}/rest/v1/acts?name=eq.${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ link }),
  })

  if (res.ok) {
    const data = await res.json()
    if (data.length > 0) {
      console.log(`✓ ${name}`)
      updated++
    } else {
      console.log(`- ${name} (not in DB, skipped)`)
      skipped++
    }
  } else {
    console.log(`✗ ${name} — HTTP ${res.status}`)
    failed++
  }
}

console.log(`\nDone. ${updated} updated, ${skipped} not in DB, ${failed} failed.`)
