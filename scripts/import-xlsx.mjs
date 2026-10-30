// Convert the Harshil–Rishikesh trip spreadsheet into a seed trip module.
// Usage: node scripts/import-xlsx.mjs "C:\path\to\sheet.xlsx"
// Reads the xlsx zip directly (no dependencies) and writes src/data/harshilTrip.ts.
import { inflateRawSync } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = process.argv[2]
if (!source) {
  console.error('Usage: node scripts/import-xlsx.mjs <sheet.xlsx>')
  process.exit(1)
}

const SEED_ID = '5b1f7a3e-9c2d-4e58-9a61-0f4c8d2b7e13'
// Bump when a changed import must reach installs that already have the seed trip.
const SEED_VERSION = 2
const MEMBERS = ['Akshay', 'Chinta', 'Debashish', 'Bibhu', 'Ashish', 'Ayush']
// Rows with no fill colour belong to Debashish.
const DEFAULT_PAYER = 'Debashish'

function unzip(file) {
  const buf = readFileSync(file)
  let end = buf.length - 22
  while (end >= 0 && buf.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw new Error('Not a zip file')
  const count = buf.readUInt16LE(end + 10)
  let offset = buf.readUInt32LE(end + 16)
  const files = new Map()
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) throw new Error('Bad central directory')
    const method = buf.readUInt16LE(offset + 10)
    const compressedSize = buf.readUInt32LE(offset + 20)
    const nameLength = buf.readUInt16LE(offset + 28)
    const extraLength = buf.readUInt16LE(offset + 30)
    const commentLength = buf.readUInt16LE(offset + 32)
    const localOffset = buf.readUInt32LE(offset + 42)
    const name = buf.toString('utf8', offset + 46, offset + 46 + nameLength)
    const localNameLength = buf.readUInt16LE(localOffset + 26)
    const localExtraLength = buf.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = buf.subarray(dataStart, dataStart + compressedSize)
    files.set(name, method === 0 ? raw : inflateRawSync(raw))
    offset += 46 + nameLength + extraLength + commentLength
  }
  return files
}

const unescape = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

const zip = unzip(source)
const read = (name) => zip.get(name)?.toString('utf8') ?? ''

const stylesXml = read('xl/styles.xml')
const fillsXml = /<fills[^>]*>([\s\S]*?)<\/fills>/.exec(stylesXml)?.[1] ?? ''
const fills = [...fillsXml.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map((m) => {
  const pattern = /<patternFill([^>]*)>([\s\S]*?)<\/patternFill>/.exec(m[1])
  return pattern ? (/rgb="([^"]+)"/.exec(pattern[2])?.[1] ?? null) : null
})
const xfsXml = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? ''
const fillIds = [...xfsXml.matchAll(/<xf\b([^>]*)\/?>/g)].map(
  (m) => Number(/fillId="(\d+)"/.exec(m[1])?.[1] ?? 0)
)
const fillOf = (styleIndex) =>
  styleIndex >= 0 ? (fills[fillIds[styleIndex]] ?? null) : null

// Colour legend from the sheet's footer: B..G columns, mapped by header names.
const PAYER_BY_COLOR = {
  FFD9EAD3: 'Akshay',
  FFF9CB9C: 'Chinta',
  FFF3F3F3: 'Debashish',
  FFC9DAF8: 'Bibhu',
  FFEAD1DC: 'Ashish',
  FFFFF2CC: 'Ayush',
}
const COLUMN_OF = { B: 'Akshay', C: 'Chinta', D: 'Debashish', E: 'Bibhu', F: 'Ashish', G: 'Ayush' }

const sharedXml = read('xl/sharedStrings.xml')
const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
  [...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
)

const sheetXml = read('xl/worksheets/sheet1.xml')
const cells = {}
for (const m of sheetXml.matchAll(/<c r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
  const [, ref, attrs, body = ''] = m
  const col = ref.replace(/\d+/, '')
  const row = Number(ref.replace(/\D+/g, ''))
  const style = Number(/ s="(\d+)"/.exec(attrs)?.[1] ?? -1)
  const type = /t="([^"]+)"/.exec(attrs)?.[1]
  let value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? ''
  if (type === 's') value = shared[Number(value)] ?? ''
  else if (type === 'inlineStr')
    value = [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join('')
  else value = unescape(value)
  ;(cells[row] ??= {})[col] = { value: value.trim(), style }
}

const FIRST_ROW = 3
const LAST_ROW = 74
const round2 = (n) => Math.round(n * 100) / 100

const expenses = []
const skipped = []
for (let row = FIRST_ROW; row <= LAST_ROW; row++) {
  const line = cells[row] ?? {}
  const title = line.A?.value || ''
  const shares = {}
  let total = 0
  for (const [col, name] of Object.entries(COLUMN_OF)) {
    const amount = Number(line[col]?.value)
    if (Number.isFinite(amount) && amount !== 0) {
      shares[name] = round2(amount)
      total = round2(total + amount)
    }
  }
  if (total === 0) {
    skipped.push({ row, title })
    continue
  }
  const payer =
    PAYER_BY_COLOR[fillOf(line.B?.style ?? -1) ?? ''] ??
    PAYER_BY_COLOR[fillOf(line.C?.style ?? -1) ?? ''] ??
    DEFAULT_PAYER
  const dateMatch = /(\d{1,2})\s*(oct|nov|dec)/i.exec(title)
  const date = dateMatch
    ? `2026-${String(['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(dateMatch[2].toLowerCase()) + 1).padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
    : undefined

  expenses.push({
    id: `sheet-${row}`,
    title: title || `Expense ${row}`,
    amount: total,
    paidBy: payer,
    participants: Object.keys(shares),
    splitMode: 'custom',
    customShares: shares,
    ...(date ? { date } : {}),
  })
}

const trip = {
  id: SEED_ID,
  name: 'Harshil–Rishikesh Trip',
  currency: 'INR',
  members: MEMBERS,
  createdAt: '2026-10-17T00:00:00.000Z',
  expenses,
}

const totals = Object.fromEntries(MEMBERS.map((m) => [m, 0]))
let grand = 0
for (const e of expenses) {
  grand = round2(grand + e.amount)
  for (const [name, share] of Object.entries(e.customShares)) {
    totals[name] = round2(totals[name] + share)
  }
}

const body = `// Generated by scripts/import-xlsx.mjs from "${basename(source)}".
// Do not edit by hand: rerun the script instead.
import type { Trip } from '../lib/storage'

/** Bump when the imported trip should be re-applied to an existing install. */
export const HARSHIL_TRIP_VERSION = ${SEED_VERSION}

/** Per-member share totals from the sheet: ${MEMBERS.map((m) => `${m} ${totals[m]}`).join(', ')}. */
export const HARSHIL_TRIP_TOTAL = ${grand}

export const HARSHIL_TRIP: Trip = ${JSON.stringify(trip, null, 2)}
`
mkdirSync(resolve(ROOT, 'src/data'), { recursive: true })
writeFileSync(resolve(ROOT, 'src/data/harshilTrip.ts'), body)
console.log(`wrote src/data/harshilTrip.ts: ${expenses.length} expenses, total ₹${grand}`)
console.log(`shares per member: ${JSON.stringify(totals)}`)
if (skipped.length) console.log(`skipped empty rows: ${JSON.stringify(skipped)}`)
