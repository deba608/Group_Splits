// Rasterize the GroupSplits favicon (rounded indigo tile + ₹ glyph) to PNG.
// No image dependencies: signed-distance shapes + supersampling + zlib PNG encode.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'public')

const INK = [10, 10, 10] // page background
const FROM = [0x63, 0x66, 0xf1] // accent-500
const TO = [0x43, 0x38, 0xca] // accent-700
const GLYPH = [255, 255, 255]

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const mix = (a, b, t) => a + (b - a) * t

function roundRect(x, y, rx0, ry0, rx1, ry1, radius) {
  const cx = (rx0 + rx1) / 2
  const cy = (ry0 + ry1) / 2
  const hx = (rx1 - rx0) / 2 - radius
  const hy = (ry1 - ry0) / 2 - radius
  const dx = Math.abs(x - cx) - hx
  const dy = Math.abs(y - cy) - hy
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  return outside + Math.min(Math.max(dx, dy), 0) - radius
}

function capsule(x, y, ax, ay, bx, by, width) {
  const r = width / 2
  const pax = x - ax
  const pay = y - ay
  const bax = bx - ax
  const bay = by - ay
  const h = clamp((pax * bax + pay * bay) / (bax * bax + bay * bay), 0, 1)
  return Math.hypot(pax - bax * h, pay - bay * h) - r
}

const R = 14 // outer tile radius (in 64-unit space)
const TILE = { x0: 5, y0: 5, x1: 59, y1: 59, r: 12 }

// ₹ strokes in 64-unit space: two bars, stem, diagonal leg.
const STROKES = [
  [21, 16, 45, 16],
  [21, 27, 45, 27],
  [27, 16, 27, 36],
  [28, 36, 43, 49],
]
const STROKE_W = 5.5

function shade(x, y) {
  // returns [r,g,b] for point in 64-unit space
  let color = INK
  const outer = roundRect(x, y, 0, 0, 64, 64, R)
  const tile = roundRect(x, y, TILE.x0, TILE.y0, TILE.x1, TILE.y1, TILE.r)
  if (tile <= 0) {
    const t = clamp((x + y - 10) / 108, 0, 1)
    color = [
      mix(FROM[0], TO[0], t),
      mix(FROM[1], TO[1], t),
      mix(FROM[2], TO[2], t),
    ]
  }
  for (const [ax, ay, bx, by] of STROKES) {
    if (capsule(x, y, ax, ay, bx, by, STROKE_W) <= 0) color = GLYPH
  }
  void outer
  return color
}

function render(size, samples = 4) {
  const px = Buffer.alloc(size * size * 4)
  const step = 1 / samples
  for (let py = 0; py < size; py++) {
    for (let pxi = 0; pxi < size; pxi++) {
      let r = 0
      let g = 0
      let b = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const x = ((pxi + (sx + 0.5) * step) / size) * 64
          const y = ((py + (sy + 0.5) * step) / size) * 64
          const c = shade(x, y)
          r += c[0]
          g += c[1]
          b += c[2]
        }
      }
      const n = samples * samples
      const i = (py * size + pxi) * 4
      px[i] = Math.round(r / n)
      px[i + 1] = Math.round(g / n)
      px[i + 2] = Math.round(b / n)
      px[i + 3] = 255
    }
  }
  return px
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })
const targets = [
  ['favicon-16.png', 16],
  ['favicon-32.png', 32],
  ['favicon-192.png', 192],
  ['favicon-512.png', 512],
  ['apple-touch-icon.png', 180],
]
for (const [name, size] of targets) {
  writeFileSync(resolve(OUT, name), png(size, render(size)))
  console.log(`wrote public/${name} (${size}x${size})`)
}
