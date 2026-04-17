import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../public/samples')
mkdirSync(OUT, { recursive: true })

const AIGC_FIELDS = {
  Label: '1',
  ContentProducer: '011200000091000000000000',
  ProduceID: 'sample-produce-id-001',
  ReservedCode1: '',
  ContentPropagator: '',
  PropagateID: '',
  ReservedCode2: '',
}

const XMP_KV_BASE64 = Buffer.from(
  JSON.stringify({ AIGC: AIGC_FIELDS })
).toString('base64')

// ─── JPEG with XMP ───────────────────────────────────────────────────────────
function buildJpeg(): Buffer {
  const xmp = `<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:AIGC="http://www.tc260.org.cn/ns/AIGC/1.0/"
  xmlns:xmpKV="http://ns.adobe.com/xap/1.0/kv/">
  <rdf:RDF>
    <rdf:Description rdf:about=""
      AIGC:Label="${AIGC_FIELDS.Label}"
      AIGC:ContentProducer="${AIGC_FIELDS.ContentProducer}"
      AIGC:ProduceID="${AIGC_FIELDS.ProduceID}"
      xmpKV:XmpKvBase64="${XMP_KV_BASE64}"/>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`

  const xmpBuf = Buffer.from(xmp, 'utf8')
  // APP1 marker for XMP: FF E1, length (2 bytes big-endian = xmpBuf.length + 2 + ns.length + 1)
  const ns = Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'ascii')
  const app1PayloadLen = ns.length + xmpBuf.length
  const app1Marker = Buffer.from([0xff, 0xe1, (app1PayloadLen + 2) >> 8 & 0xff, (app1PayloadLen + 2) & 0xff])

  // Minimal 1x1 white JPEG body (SOI + APP0 + SOF0 + SOS + EOI)
  // Use a known-good minimal JPEG sequence
  const soi = Buffer.from([0xff, 0xd8])
  const eoi = Buffer.from([0xff, 0xd9])

  // Minimal JFIF APP0
  const app0 = Buffer.from([
    0xff, 0xe0, 0x00, 0x10, // APP0 marker + length=16
    0x4a, 0x46, 0x49, 0x46, 0x00, // "JFIF\0"
    0x01, 0x01, // version 1.1
    0x00,       // pixel aspect ratio: no units
    0x00, 0x01, // Xdensity=1
    0x00, 0x01, // Ydensity=1
    0x00, 0x00, // no thumbnail
  ])

  // Minimal DQT (quantization table)
  const dqtData = new Uint8Array(65)
  dqtData[0] = 0x00 // table 0, 8-bit
  for (let i = 1; i < 65; i++) dqtData[i] = 16
  const dqt = Buffer.concat([Buffer.from([0xff, 0xdb, 0x00, 67]), Buffer.from(dqtData)])

  // SOF0 1x1 gray
  const sof0 = Buffer.from([
    0xff, 0xc0, 0x00, 0x0b, // marker + length
    0x08,       // 8-bit precision
    0x00, 0x01, // height=1
    0x00, 0x01, // width=1
    0x01,       // 1 component (gray)
    0x01, 0x11, 0x00, // component 1: Y, 1x1, quant table 0
  ])

  // Minimal DHT
  const dhtData = Buffer.from([
    0xff, 0xc4, 0x00, 0x1f,
    0x00, // DC table 0
    0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
  ])

  // SOS + image data for 1x1 gray pixel
  const sos = Buffer.from([
    0xff, 0xda, 0x00, 0x08, // marker + length
    0x01,       // 1 component
    0x01, 0x00, // component 1, DC=0 AC=0
    0x00, 0x3f, 0x00, // spectral start/end/approx
    // Entropy coded data for a white pixel: 0xf8 (after stuffing)
    0xf8,
  ])

  return Buffer.concat([soi, app0, app1Marker, ns, xmpBuf, dqt, sof0, dhtData, sos, eoi])
}

writeFileSync(join(OUT, 'sample.jpg'), buildJpeg())
console.log('✓ sample.jpg written')

// ─── MP3 with ID3v2.3 TXXX:AIGC ─────────────────────────────────────────────
function encodeId3String(str: string): Buffer {
  // Encoding byte 0x00 = ISO-8859-1
  return Buffer.concat([Buffer.from([0x00]), Buffer.from(str, 'latin1')])
}

function buildTxxx(desc: string, text: string): Buffer {
  const encoded = encodeId3String(desc + '\x00' + text)
  const size = encoded.length
  const header = Buffer.from([
    0x54, 0x58, 0x58, 0x58, // "TXXX"
    (size >> 24) & 0x7f, (size >> 16) & 0x7f, (size >> 8) & 0x7f, size & 0x7f, // sync-safe size (ID3v2.3 uses big-endian, not sync-safe for frame size)
    0x00, 0x00, // flags
  ])
  // Note: ID3v2.3 frame size is NOT sync-safe (unlike ID3v2.4)
  header.writeUInt32BE(size, 4)
  return Buffer.concat([header, encoded])
}

function buildId3(frames: Buffer[]): Buffer {
  const framesData = Buffer.concat(frames)
  const tagSize = framesData.length
  // Sync-safe size
  const ss = [
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ]
  const header = Buffer.from([
    0x49, 0x44, 0x33, // "ID3"
    0x03, 0x00,       // version 2.3, revision 0
    0x00,             // flags
    ss[0]!, ss[1]!, ss[2]!, ss[3]!,
  ])
  return Buffer.concat([header, framesData])
}

const aigcJson = JSON.stringify({ AIGC: AIGC_FIELDS })
const id3 = buildId3([
  buildTxxx('AIGC', aigcJson),
  buildTxxx('XmpKvBase64', XMP_KV_BASE64),
])

// Minimal silent MP3 frame (128kbps, 44100Hz, stereo)
const mp3Frame = Buffer.from([
  0xff, 0xfb, 0x90, 0x00, // sync + MPEG1 Layer3 128kbps 44100Hz stereo
  ...new Array(413).fill(0x00),  // silent frame data (418 - 4 header = 414, use 413 + 1 pad below... just fill)
])

const mp3 = Buffer.concat([id3, mp3Frame])
writeFileSync(join(OUT, 'sample.mp3'), mp3)
console.log('✓ sample.mp3 written')

// ─── PDF with /AIGC in Info dict ─────────────────────────────────────────────
function buildPdf(): Buffer {
  const aigcValue = JSON.stringify({ AIGC: AIGC_FIELDS })
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

  const lines: string[] = []
  const offsets: number[] = []

  const push = (s: string) => { lines.push(s); return lines.length - 1 }

  push('%PDF-1.4')
  push('%\u00e2\u00e3\u00cf\u00d3')

  offsets[1] = lines.join('\n').length + 1
  push('1 0 obj')
  push('<< /Type /Catalog /Pages 2 0 R >>')
  push('endobj')

  offsets[2] = lines.join('\n').length + 1
  push('2 0 obj')
  push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')
  push('endobj')

  offsets[3] = lines.join('\n').length + 1
  push('3 0 obj')
  push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>')
  push('endobj')

  offsets[4] = lines.join('\n').length + 1
  push('4 0 obj')
  push(`<< /Title (AIGC Sample) /Author (AI System) /AIGC (${aigcValue}) >>`)
  push('endobj')

  const xrefOffset = lines.join('\n').length + 1
  push('xref')
  push(`0 5`)
  push('0000000000 65535 f ')
  for (let i = 1; i <= 4; i++) {
    push(String(offsets[i]).padStart(10, '0') + ' 00000 n ')
  }
  push('trailer')
  push('<< /Size 5 /Root 1 0 R /Info 4 0 R >>')
  push('startxref')
  push(String(xrefOffset))
  push('%%EOF')

  return Buffer.from(lines.join('\n'), 'utf8')
}

writeFileSync(join(OUT, 'sample.pdf'), buildPdf())
console.log('✓ sample.pdf written')

console.log('All sample files generated in public/samples/')
