// Simple ICO builder - packs multiple PNG images into a single .ico file.
// Windows ICO format: https://en.wikipedia.org/wiki/ICO_(file_format)
const fs = require('fs')
const path = require('path')

const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = sizes.map((s) => {
  const file = path.join(__dirname, '..', 'resources', `icon-${s}.png`)
  return { size: s, data: fs.readFileSync(file) }
})

// ICO header
const headerSize = 6 + 16 * pngs.length
const header = Buffer.alloc(headerSize)

header.writeUInt16LE(0, 0) // Reserved
header.writeUInt16LE(1, 2) // Type: 1 = ICO
header.writeUInt16LE(pngs.length, 4) // Count

let offset = headerSize
for (let i = 0; i < pngs.length; i++) {
  const { size, data } = pngs[i]
  const dirOffset = 6 + 16 * i
  // ICO spec says width/height of 0 means 256
  header.writeUInt8(size === 256 ? 0 : size, dirOffset + 0) // Width
  header.writeUInt8(size === 256 ? 0 : size, dirOffset + 1) // Height
  header.writeUInt8(0, dirOffset + 2) // Color palette (0 for no palette)
  header.writeUInt8(0, dirOffset + 3) // Reserved
  header.writeUInt16LE(1, dirOffset + 4) // Color planes
  header.writeUInt16LE(32, dirOffset + 6) // Bits per pixel
  header.writeUInt32LE(data.length, dirOffset + 8) // Size of image data
  header.writeUInt32LE(offset, dirOffset + 12) // Offset of image data
  offset += data.length
}

const body = Buffer.concat(pngs.map((p) => p.data))
const ico = Buffer.concat([header, body])
const outPath = path.join(__dirname, '..', 'resources', 'icon.ico')
fs.writeFileSync(outPath, ico)
console.log(`icon.ico written: ${ico.length} bytes (${pngs.length} sizes)`)
