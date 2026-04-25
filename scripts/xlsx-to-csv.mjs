#!/usr/bin/env node
// Converts PF26 Bands + Hosts Matching.xlsx → scripts/bands.csv
// Run: node scripts/xlsx-to-csv.mjs

import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { writeFileSync } from 'fs'

const require = createRequire(import.meta.url)
const XLSX = require('xlsx')

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const SLOT_TIMES = {
  '10-11 AM': { start: '10:00', end: '11:00' },
  '11-12 AM': { start: '11:00', end: '12:00' },
  '12-1 PM':  { start: '12:00', end: '13:00' },
  '1-2 PM':   { start: '13:00', end: '14:00' },
  '2-3 PM':   { start: '14:00', end: '15:00' },
  '3-4 PM':   { start: '15:00', end: '16:00' },
  '4-5 PM':   { start: '16:00', end: '17:00' },
  '5-6 PM':   { start: '17:00', end: '18:00' },
  '7-9 PM':   { start: '19:00', end: '21:00' },
}

const wb = XLSX.readFile(join(ROOT, 'PF26 Bands + Hosts Matching.xlsx'))

// Build genre lookup from GenreLink sheet
const genreSheet = wb.Sheets['GenreLink']
const genreRows = XLSX.utils.sheet_to_json(genreSheet, { header: 1 })
const genreMap = new Map()
for (let i = 2; i < genreRows.length; i++) {
  const [name, genre] = genreRows[i]
  if (name && genre) genreMap.set(name.trim(), genre.trim())
}

// Parse Schedule sheet
const schedSheet = wb.Sheets['Schedule']
const schedRows = XLSX.utils.sheet_to_json(schedSheet, { header: 1 })

const headers = schedRows[0]
const slotCols = headers.slice(3) // ['10-11 AM', '11-12 AM', ...]

const csvRows = ['bandName,genre,address,startTime,endTime']
const skipped = []

for (let i = 1; i < schedRows.length; i++) {
  const row = schedRows[i]
  const bandName = row[0]
  if (!bandName) continue // section header or empty

  const rawAddress = row[1] || ''
  const address = rawAddress.includes('Atlanta') ? rawAddress : `${rawAddress}, Atlanta, GA`
  const genre = genreMap.get(bandName.trim()) || 'Live Music'

  // Find which slot has a checkmark
  const slotIndex = row.slice(3).findIndex(Boolean)
  if (slotIndex === -1) {
    skipped.push(bandName)
    continue
  }

  const slotLabel = slotCols[slotIndex]
  const times = SLOT_TIMES[slotLabel]
  if (!times) {
    skipped.push(`${bandName} (unknown slot: ${slotLabel})`)
    continue
  }

  const escape = v => `"${String(v).replace(/"/g, '""')}"`
  csvRows.push([escape(bandName), escape(genre), escape(address), times.start, times.end].join(','))
}

const outPath = join(__dirname, 'bands.csv')
writeFileSync(outPath, csvRows.join('\n') + '\n')

console.log(`✓ Wrote ${csvRows.length - 1} bands to scripts/bands.csv`)
if (skipped.length) {
  console.log(`⚠ Skipped ${skipped.length} (no time slot):`)
  skipped.forEach(s => console.log(`  - ${s}`))
}
