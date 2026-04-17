# AIGC Checker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 纯静态客户端网页，上传图片/视频/音频/PDF/DOCX，浏览器端解析 AIGC 隐水印（GB 45438-2025）和文件元数据，移动端友好，部署 Cloudflare Pages。

**Architecture:** Vite 5 + TypeScript + Tailwind CSS，原生 Web Components（无 React/Vue）。解析层按媒体类型分模块（image/audio/video/pdf/docx），统一输出 `FileAnalysis` 类型。大型 WASM 库（mediainfo.js、pdf.js）懒加载。UI 层单向数据流：文件 → 解析 → 渲染。

**Tech Stack:** Vite 5, TypeScript strict, Tailwind CSS 3, exifr, music-metadata-browser, mediainfo.js (WASM), pdf.js (pdfjs-dist), fflate, Vitest (单元测试), Lucide icons, Cloudflare Pages

---

## File Map

```
aigc-checker/
├── scripts/
│   └── generate-samples.ts        # 生成样例文件（构建前跑一次）
├── public/
│   ├── favicon.svg
│   └── samples/                   # generate-samples 输出目录
│       ├── sample-image.jpg       # 带 AIGC XMP 的 JPEG
│       ├── sample-audio.mp3       # 带 AIGC ID3 的 MP3
│       └── sample-document.pdf    # 带 AIGC 信息字典的 PDF
├── src/
│   ├── types.ts                   # 所有共享类型
│   ├── main.ts                    # 入口，协调上传→解析→渲染
│   ├── styles.css                 # Tailwind + CSS 自定义 token
│   ├── dict/
│   │   ├── aigc-cn.ts             # GB 45438 字段中文映射
│   │   ├── producer-codes.ts      # 已知生产方编码白名单
│   │   ├── exif-cn.ts             # EXIF 字段中文名（~200条）
│   │   └── exif-defaults.ts       # 默认值判定规则
│   ├── lib/
│   │   ├── format.ts              # GPS/字节/时间格式化
│   │   └── export.ts              # JSON 导出
│   ├── parsers/
│   │   ├── aigc.ts                # 统一 AIGC 字段提取
│   │   ├── image.ts               # exifr + APP marker 扫描
│   │   ├── audio.ts               # music-metadata-browser
│   │   ├── video.ts               # mediainfo.js (lazy)
│   │   ├── pdf.ts                 # pdfjs-dist (lazy)
│   │   └── docx.ts                # fflate + DOMParser
│   └── components/
│       ├── dropzone.ts            # 拖拽/点击/拍照上传
│       ├── preview.ts             # 缩略图/视频封面/音频占位
│       ├── aigc-card.ts           # AIGC 检测结果卡（三态）
│       ├── metadata-group.ts      # 折叠面板（accordion）
│       ├── metadata-row.ts        # 字段行（桌面3列/移动竖向）
│       └── scan-line.ts           # loading 扫描线动效
├── tests/
│   ├── aigc.test.ts
│   ├── format.test.ts
│   └── exif-defaults.test.ts
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
├── package.json
├── _headers
└── _redirects
```

---

## Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `vitest.config.ts`, `index.html`, `src/styles.css`

- [ ] **初始化项目**

```bash
cd /Users/methol/data/code-methol/aigc-checker
npm init -y
npm install -D vite@5 typescript @types/node tailwindcss@3 autoprefixer postcss vitest jsdom @vitest/coverage-v8
npm install exifr music-metadata-browser fflate lucide
npm install -D tsx
```

- [ ] **写 `package.json` scripts**

```json
{
  "name": "aigc-checker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "npm run gen-samples && tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "gen-samples": "node --loader tsx scripts/generate-samples.ts"
  }
}
```

- [ ] **写 `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-exifr': ['exifr'],
          'vendor-musicmeta': ['music-metadata-browser'],
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['pdfjs-dist', 'mediainfo.js'],
  },
  worker: {
    format: 'es',
  },
})
```

- [ ] **写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src", "tests", "scripts"]
}
```

- [ ] **写 `tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.ts'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0E1A',
        card: '#141B2D',
        surface: '#1E293B',
        'text-primary': '#F8FAFC',
        'text-secondary': '#94A3B8',
        'text-muted': '#64748B',
        'accent-cyan': '#22D3EE',
        'accent-green': '#22C55E',
        'accent-amber': '#F59E0B',
        'accent-red': '#EF4444',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
} satisfies Config
```

- [ ] **写 `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
  },
})
```

- [ ] **写 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
  <title>AIGC Checker — AI 内容水印检测</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="/src/styles.css" />
</head>
<body class="bg-bg text-text-primary font-sans min-h-dvh">
  <div id="app"></div>
  <script type="module" src="/src/main.ts"></script>
</body>
</html>
```

- [ ] **写 `src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * { box-sizing: border-box; }
  :root {
    --safe-bottom: env(safe-area-inset-bottom, 0px);
    --safe-top: env(safe-area-inset-top, 0px);
  }
  body { -webkit-font-smoothing: antialiased; }
}

@layer utilities {
  .aigc-glow {
    box-shadow: 0 0 0 1px rgba(34,211,238,.4), 0 0 24px rgba(34,211,238,.08);
  }
  .nondefault-bar {
    border-left: 2px solid #F59E0B;
  }
  .pb-safe { padding-bottom: max(env(safe-area-inset-bottom), 8px); }
  .pt-safe { padding-top: max(env(safe-area-inset-top), 0px); }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}
```

- [ ] **写 `public/favicon.svg`**

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" rx="8" fill="#0A0E1A"/>
  <circle cx="16" cy="16" r="8" stroke="#22D3EE" stroke-width="1.5"/>
  <path d="M12 16l2.5 2.5L20 13" stroke="#22D3EE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- [ ] **写 `_headers`**

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
```

- [ ] **写 `_redirects`**

```
/* /index.html 200
```

- [ ] **验证 dev server 启动**

```bash
npm run dev
```

Expected：浏览器打开 http://localhost:5173 显示空白深色页面，无报错。

- [ ] **Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + TS + Tailwind project"
```

---

## Task 2: 共享类型

**Files:**
- Create: `src/types.ts`

- [ ] **写 `src/types.ts`**

```typescript
export interface AigcFields {
  Label?: string
  ContentProducer?: string
  ProduceID?: string
  ReservedCode1?: string
  ContentPropagator?: string
  PropagateID?: string
  ReservedCode2?: string
}

export type AigcStatus = 'found' | 'partial' | 'not-found'

export interface AigcResult {
  status: AigcStatus
  fields: AigcFields
  /** 水印来源描述，如 "XMP XmpKvBase64" */
  source: string
}

export type MetaValue = string | number | boolean | null | undefined

export interface MetaField {
  key: string
  value: MetaValue | MetaValue[]
  cnName: string
  cnDesc?: string
  isNonDefault: boolean
  defaultValue?: MetaValue
  defaultDesc?: string
}

export interface MetaGroup {
  id: string
  title: string
  icon?: string
  fields: MetaField[]
  nonDefaultCount: number
}

export type MediaType = 'image' | 'video' | 'audio' | 'pdf' | 'docx' | 'unknown'

export interface FileAnalysis {
  file: File
  mediaType: MediaType
  aigc: AigcResult
  groups: MetaGroup[]
  previewUrl?: string
  error?: string
}
```

- [ ] **Commit**

```bash
git add src/types.ts && git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: 字典模块（AIGC + EXIF）

**Files:**
- Create: `src/dict/aigc-cn.ts`, `src/dict/producer-codes.ts`, `src/dict/exif-cn.ts`, `src/dict/exif-defaults.ts`
- Create: `tests/exif-defaults.test.ts`

- [ ] **写 `src/dict/aigc-cn.ts`**

```typescript
export const AIGC_FIELD_CN: Record<string, string> = {
  Label: '生成合成标签',
  ContentProducer: '生成服务提供方',
  ProduceID: '生成内容编号',
  ReservedCode1: '生成方完整性校验',
  ContentPropagator: '传播服务提供方',
  PropagateID: '传播内容编号',
  ReservedCode2: '传播方完整性校验',
}

export const LABEL_VALUES: Record<string, string> = {
  '1': 'AI 生成',
  '2': '可能 AI 生成',
  '3': '疑似 AI 生成',
}

/** 拆解 22+ 位生产方编码为可读结构 */
export function parseProducerCode(code: string): {
  format: string
  entityType: string
  creditCode: string
  serviceCode: string
} {
  return {
    format: code.slice(0, 2),
    entityType: code[2] === '1' ? '组织' : code[2] === '2' ? '个人' : code[2] ?? '未知',
    creditCode: code.slice(4, 22),
    serviceCode: code.slice(22) || '—',
  }
}
```

- [ ] **写 `src/dict/producer-codes.ts`**

```typescript
/** 已知生产方社会信用代码前缀 → 厂商名称 */
export const KNOWN_PRODUCERS: Record<string, string> = {
  '91110000802100433B': '字节跳动有限公司',
  '91330106MA2C': '阿里巴巴（中国）有限公司',
  '91440300708461136T': '腾讯科技（深圳）有限公司',
  '91110108551385082J': '百度在线网络技术（北京）有限公司',
}

export function lookupProducer(creditCode: string): string | undefined {
  for (const [prefix, name] of Object.entries(KNOWN_PRODUCERS)) {
    if (creditCode.startsWith(prefix)) return name
  }
  return undefined
}
```

- [ ] **写 `src/dict/exif-cn.ts`（节选，完整 200+ 条）**

```typescript
export const EXIF_CN: Record<string, { name: string; unit?: string }> = {
  Make: { name: '相机制造商' },
  Model: { name: '相机型号' },
  Orientation: { name: '图像方向' },
  XResolution: { name: '水平分辨率', unit: 'DPI' },
  YResolution: { name: '垂直分辨率', unit: 'DPI' },
  ResolutionUnit: { name: '分辨率单位' },
  Software: { name: '处理软件' },
  DateTime: { name: '修改时间' },
  YCbCrPositioning: { name: 'YCbCr 色彩定位' },
  ExposureTime: { name: '快门速度', unit: 's' },
  FNumber: { name: '光圈值' },
  ExposureProgram: { name: '曝光程序' },
  ISOSpeedRatings: { name: 'ISO 感光度' },
  DateTimeOriginal: { name: '拍摄时间' },
  DateTimeDigitized: { name: '数字化时间' },
  ShutterSpeedValue: { name: '快门速度 (APEX)' },
  ApertureValue: { name: '光圈值 (APEX)' },
  ExposureBiasValue: { name: '曝光补偿', unit: 'EV' },
  MaxApertureValue: { name: '最大光圈' },
  MeteringMode: { name: '测光模式' },
  Flash: { name: '闪光灯' },
  FocalLength: { name: '焦距', unit: 'mm' },
  ColorSpace: { name: '色彩空间' },
  PixelXDimension: { name: '图像宽度', unit: 'px' },
  PixelYDimension: { name: '图像高度', unit: 'px' },
  FocalLengthIn35mmFilm: { name: '等效焦距', unit: 'mm' },
  WhiteBalance: { name: '白平衡' },
  ExposureMode: { name: '曝光模式' },
  SceneCaptureType: { name: '场景类型' },
  GPSLatitude: { name: 'GPS 纬度' },
  GPSLongitude: { name: 'GPS 经度' },
  GPSAltitude: { name: 'GPS 海拔', unit: 'm' },
  GPSDateStamp: { name: 'GPS 日期' },
  ImageDescription: { name: '图像描述' },
  Artist: { name: '作者' },
  Copyright: { name: '版权' },
  UserComment: { name: '用户备注' },
  LensModel: { name: '镜头型号' },
  LensMake: { name: '镜头制造商' },
  BitsPerSample: { name: '每样本位数' },
  Compression: { name: '压缩方式' },
  PhotometricInterpretation: { name: '光度测量' },
  SamplesPerPixel: { name: '每像素样本数' },
}
```

- [ ] **写 `src/dict/exif-defaults.ts`**

```typescript
import type { MetaValue } from '../types.js'

export interface DefaultRule {
  defaultValue: MetaValue
  defaultDesc: string
  isAlwaysHighlight?: boolean
}

export const EXIF_DEFAULTS: Record<string, DefaultRule> = {
  Orientation: { defaultValue: 1, defaultDesc: '1（正常方向）' },
  ResolutionUnit: { defaultValue: 2, defaultDesc: '2（英寸）' },
  YCbCrPositioning: { defaultValue: 1, defaultDesc: '1（居中）' },
  ColorSpace: { defaultValue: 1, defaultDesc: '1（sRGB）' },
  WhiteBalance: { defaultValue: 0, defaultDesc: '0（自动）' },
  ExposureMode: { defaultValue: 0, defaultDesc: '0（自动曝光）' },
  ExposureProgram: { defaultValue: 0, defaultDesc: '0（未定义）' },
  MeteringMode: { defaultValue: 0, defaultDesc: '0（未知）' },
  SceneCaptureType: { defaultValue: 0, defaultDesc: '0（标准）' },
  Software: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  ImageDescription: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  Artist: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  Copyright: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  UserComment: { defaultValue: '', defaultDesc: '空', isAlwaysHighlight: true },
  GPSLatitude: { defaultValue: undefined, defaultDesc: '无', isAlwaysHighlight: true },
  GPSLongitude: { defaultValue: undefined, defaultDesc: '无', isAlwaysHighlight: true },
}

export function isNonDefault(key: string, value: MetaValue | MetaValue[]): boolean {
  const rule = EXIF_DEFAULTS[key]
  if (!rule) return false
  if (rule.isAlwaysHighlight) {
    if (Array.isArray(value)) return value.length > 0
    return value !== undefined && value !== null && value !== ''
  }
  if (Array.isArray(value)) return true
  return value !== rule.defaultValue
}
```

- [ ] **写失败测试 `tests/exif-defaults.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { isNonDefault } from '../src/dict/exif-defaults.js'

describe('isNonDefault', () => {
  it('Orientation 1 is default', () => expect(isNonDefault('Orientation', 1)).toBe(false))
  it('Orientation 6 is non-default', () => expect(isNonDefault('Orientation', 6)).toBe(true))
  it('Software always highlights when present', () => {
    expect(isNonDefault('Software', 'Adobe Photoshop')).toBe(true)
  })
  it('Software empty is default', () => expect(isNonDefault('Software', '')).toBe(false))
  it('GPS highlights when present', () => {
    expect(isNonDefault('GPSLatitude', 39.9042)).toBe(true)
  })
  it('unknown key returns false', () => expect(isNonDefault('UnknownField', 99)).toBe(false))
})
```

- [ ] **运行测试，确认失败**

```bash
npm test -- tests/exif-defaults.test.ts
```

Expected: FAIL "isNonDefault is not a function" 或类似。

- [ ] **运行测试，确认通过**（代码已写好，这一步应该通过）

```bash
npm test -- tests/exif-defaults.test.ts
```

Expected: 6 passed.

- [ ] **Commit**

```bash
git add src/dict tests/exif-defaults.test.ts && git commit -m "feat: add AIGC + EXIF dictionaries with tests"
```

---

## Task 4: 工具函数

**Files:**
- Create: `src/lib/format.ts`, `src/lib/export.ts`
- Create: `tests/format.test.ts`

- [ ] **写失败测试 `tests/format.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { formatBytes, formatGps, formatExposureTime } from '../src/lib/format.js'

describe('formatBytes', () => {
  it('formats bytes', () => expect(formatBytes(1024)).toBe('1.00 KB'))
  it('formats MB', () => expect(formatBytes(1_500_000)).toBe('1.43 MB'))
  it('zero', () => expect(formatBytes(0)).toBe('0 B'))
})

describe('formatGps', () => {
  it('positive lat is N', () => expect(formatGps(39.9042, 'lat')).toBe('39°54\'15.12"N'))
  it('negative lon is W', () => expect(formatGps(-116.4074, 'lon')).toBe('116°24\'26.64"W'))
})

describe('formatExposureTime', () => {
  it('1/100s', () => expect(formatExposureTime(0.01)).toBe('1/100s'))
  it('1s', () => expect(formatExposureTime(1)).toBe('1s'))
  it('2s', () => expect(formatExposureTime(2)).toBe('2s'))
})
```

- [ ] **写 `src/lib/format.ts`**

```typescript
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${units[i] ?? 'B'}`
}

export function formatGps(decimal: number, axis: 'lat' | 'lon'): string {
  const abs = Math.abs(decimal)
  const deg = Math.floor(abs)
  const minFull = (abs - deg) * 60
  const min = Math.floor(minFull)
  const sec = ((minFull - min) * 60).toFixed(2)
  const dir = axis === 'lat' ? (decimal >= 0 ? 'N' : 'S') : (decimal >= 0 ? 'E' : 'W')
  return `${deg}°${min}'${sec}"${dir}`
}

export function formatExposureTime(secs: number): string {
  if (secs >= 1) return `${secs}s`
  const denom = Math.round(1 / secs)
  return `1/${denom}s`
}
```

- [ ] **写 `src/lib/export.ts`**

```typescript
import type { FileAnalysis } from '../types.js'

export function exportJson(analysis: FileAnalysis): void {
  const data = {
    file: analysis.file.name,
    size: analysis.file.size,
    type: analysis.file.type,
    mediaType: analysis.mediaType,
    aigc: analysis.aigc,
    metadata: Object.fromEntries(
      analysis.groups.map(g => [g.id, Object.fromEntries(
        g.fields.map(f => [f.key, { value: f.value, cnName: f.cnName, isNonDefault: f.isNonDefault }])
      )])
    ),
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `aigc-checker-${analysis.file.name}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **运行测试**

```bash
npm test -- tests/format.test.ts
```

Expected: 7 passed.

- [ ] **Commit**

```bash
git add src/lib tests/format.test.ts && git commit -m "feat: add format and export utilities"
```

---

## Task 5: AIGC 水印提取器

**Files:**
- Create: `src/parsers/aigc.ts`
- Create: `tests/aigc.test.ts`

- [ ] **写失败测试 `tests/aigc.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { parseXmpKvBase64, parseAigcJson, parseProducerDisplay } from '../src/parsers/aigc.js'

const SAMPLE_JSON = JSON.stringify({
  AIGC: {
    Label: '1',
    ContentProducer: '001191330106MA2CXXXXY43',
    ProduceID: '123456',
    ReservedCode1: 'd41d8cd98f00b204e9800998ecf8427e',
  }
})

describe('parseXmpKvBase64', () => {
  it('decodes base64 JSON', () => {
    const b64 = btoa(SAMPLE_JSON)
    const result = parseXmpKvBase64(b64)
    expect(result?.Label).toBe('1')
    expect(result?.ContentProducer).toBe('001191330106MA2CXXXXY43')
  })
  it('returns null for invalid base64', () => {
    expect(parseXmpKvBase64('not-base64!!!')).toBeNull()
  })
  it('returns null when AIGC key missing', () => {
    expect(parseXmpKvBase64(btoa('{"other":"data"}'))).toBeNull()
  })
})

describe('parseAigcJson', () => {
  it('parses direct AIGC JSON string', () => {
    const result = parseAigcJson(SAMPLE_JSON)
    expect(result?.Label).toBe('1')
  })
  it('parses AIGC= prefix format', () => {
    const result = parseAigcJson('AIGC=' + SAMPLE_JSON)
    expect(result?.Label).toBe('1')
  })
})

describe('parseProducerDisplay', () => {
  it('extracts entity type and credit code', () => {
    const d = parseProducerDisplay('001191330106MA2CXXXXY43')
    expect(d.entityType).toBe('组织')
    expect(d.creditCode).toBe('91330106MA2CXXXX')
  })
})
```

- [ ] **运行，确认失败**

```bash
npm test -- tests/aigc.test.ts
```

- [ ] **写 `src/parsers/aigc.ts`**

```typescript
import type { AigcFields, AigcResult } from '../types.js'
import { lookupProducer } from '../dict/producer-codes.js'
import { parseProducerCode } from '../dict/aigc-cn.js'

export function parseXmpKvBase64(b64: string): AigcFields | null {
  try {
    const json = atob(b64)
    const obj = JSON.parse(json) as Record<string, unknown>
    const aigc = obj['AIGC'] as AigcFields | undefined
    if (!aigc || typeof aigc !== 'object') return null
    return aigc
  } catch {
    return null
  }
}

export function parseAigcJson(raw: string): AigcFields | null {
  try {
    const cleaned = raw.startsWith('AIGC=') ? raw.slice(5) : raw
    const obj = JSON.parse(cleaned) as Record<string, unknown>
    const aigc = (obj['AIGC'] ?? obj) as AigcFields
    if (!aigc.Label && !aigc.ContentProducer) return null
    return aigc
  } catch {
    return null
  }
}

export function parseProducerDisplay(code: string): {
  entityType: string
  creditCode: string
  serviceCode: string
  knownName?: string
} {
  const parsed = parseProducerCode(code)
  return {
    entityType: parsed.entityType,
    creditCode: parsed.creditCode,
    serviceCode: parsed.serviceCode,
    knownName: lookupProducer(parsed.creditCode),
  }
}

/** 从 XMP 字符串（XML 文本）中搜索 AIGC 字段 */
export function extractFromXmpString(xmpStr: string): AigcFields | null {
  // 1. 查找 XmpKvBase64 属性
  const b64Match = xmpStr.match(/XmpKvBase64="([^"]+)"/)
  if (b64Match?.[1]) {
    const fields = parseXmpKvBase64(b64Match[1])
    if (fields) return fields
  }

  // 2. 查找 AIGC 命名空间节点（直写方式）
  const labelMatch = xmpStr.match(/AIGC:Label[>="]+([123])/)
  if (labelMatch?.[1]) {
    const fields: AigcFields = { Label: labelMatch[1] }
    const producerMatch = xmpStr.match(/AIGC:ContentProducer[>="]+([^<"]+)/)
    if (producerMatch?.[1]) fields.ContentProducer = producerMatch[1].trim()
    return fields
  }

  return null
}

/** 判断 AigcResult 状态 */
export function buildAigcResult(fields: AigcFields | null, source: string): AigcResult {
  if (!fields) return { status: 'not-found', fields: {}, source: '未发现水印' }
  const required: (keyof AigcFields)[] = ['Label', 'ContentProducer']
  const hasAll = required.every(k => fields[k])
  return {
    status: hasAll ? 'found' : 'partial',
    fields,
    source,
  }
}
```

- [ ] **运行测试，确认通过**

```bash
npm test -- tests/aigc.test.ts
```

Expected: all passed.

- [ ] **Commit**

```bash
git add src/parsers/aigc.ts tests/aigc.test.ts && git commit -m "feat: AIGC watermark extractor with tests"
```

---

## Task 6: 图片解析器

**Files:**
- Create: `src/parsers/image.ts`

- [ ] **安装 exifr（已在 Task 1 安装，确认）**

```bash
node -e "import('exifr').then(m => console.log('ok', Object.keys(m)))"
```

- [ ] **写 `src/parsers/image.ts`**

```typescript
import type { FileAnalysis, MetaGroup, MetaField } from '../types.js'
import { extractFromXmpString, buildAigcResult } from './aigc.js'
import { EXIF_CN } from '../dict/exif-cn.js'
import { EXIF_DEFAULTS, isNonDefault } from '../dict/exif-defaults.js'
import { formatGps, formatExposureTime } from '../lib/format.js'

async function parseExifr(file: File) {
  const { default: Exifr } = await import('exifr')
  return Exifr.parse(file, {
    tiff: true, exif: true, gps: true,
    iptc: true, icc: true, jfif: true,
    xmp: true, mergeOutput: false,
  })
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (key === 'GPSLatitude' && typeof value === 'number') return formatGps(value, 'lat')
  if (key === 'GPSLongitude' && typeof value === 'number') return formatGps(value, 'lon')
  if (key === 'ExposureTime' && typeof value === 'number') return formatExposureTime(value)
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function toMetaField(key: string, raw: unknown): MetaField {
  const meta = EXIF_CN[key]
  const displayVal = formatValue(key, raw)
  const rule = EXIF_DEFAULTS[key]
  const nonDefault = isNonDefault(key, raw as never)
  return {
    key,
    value: displayVal,
    cnName: meta?.name ?? key,
    cnDesc: meta?.unit,
    isNonDefault: nonDefault,
    defaultValue: rule?.defaultValue,
    defaultDesc: rule?.defaultDesc,
  }
}

function groupFromRecord(id: string, title: string, icon: string, record: Record<string, unknown>): MetaGroup {
  const fields = Object.entries(record)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => toMetaField(k, v))
  return { id, title, icon, fields, nonDefaultCount: fields.filter(f => f.isNonDefault).length }
}

export async function parseImage(file: File): Promise<FileAnalysis> {
  const parsed = await parseExifr(file)
  const previewUrl = URL.createObjectURL(file)

  // AIGC 水印
  const xmpStr = parsed?.xmp ? JSON.stringify(parsed.xmp) : ''
  const aigcFields = extractFromXmpString(xmpStr)
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'XMP 元数据' : '')

  const groups: MetaGroup[] = []

  if (parsed?.ifd0) groups.push(groupFromRecord('camera', '相机信息', 'camera', parsed.ifd0))
  if (parsed?.exif) groups.push(groupFromRecord('exif', '拍摄参数', 'aperture', parsed.exif))

  const gpsFields: Record<string, unknown> = {}
  if (parsed?.gps?.GPSLatitude) gpsFields['GPSLatitude'] = parsed.gps.GPSLatitude
  if (parsed?.gps?.GPSLongitude) gpsFields['GPSLongitude'] = parsed.gps.GPSLongitude
  if (parsed?.gps?.GPSAltitude) gpsFields['GPSAltitude'] = parsed.gps.GPSAltitude
  if (parsed?.gps?.GPSDateStamp) gpsFields['GPSDateStamp'] = parsed.gps.GPSDateStamp
  if (Object.keys(gpsFields).length) groups.push(groupFromRecord('gps', 'GPS 定位', 'map-pin', gpsFields))

  if (parsed?.xmp && typeof parsed.xmp === 'object')
    groups.push(groupFromRecord('xmp', 'XMP 元数据', 'tag', parsed.xmp as Record<string, unknown>))
  if (parsed?.iptc && typeof parsed.iptc === 'object')
    groups.push(groupFromRecord('iptc', 'IPTC 信息', 'file-text', parsed.iptc as Record<string, unknown>))
  if (parsed?.icc && typeof parsed.icc === 'object')
    groups.push(groupFromRecord('icc', 'ICC 色彩配置', 'palette', parsed.icc as Record<string, unknown>))

  return { file, mediaType: 'image', aigc, groups, previewUrl }
}
```

- [ ] **Commit**

```bash
git add src/parsers/image.ts && git commit -m "feat: image metadata parser (exifr)"
```

---

## Task 7: 音频解析器

**Files:**
- Create: `src/parsers/audio.ts`

- [ ] **写 `src/parsers/audio.ts`**

```typescript
import type { FileAnalysis, MetaGroup, MetaField } from '../types.js'
import { parseAigcJson, buildAigcResult } from './aigc.js'

export async function parseAudio(file: File): Promise<FileAnalysis> {
  const { parseBlob } = await import('music-metadata-browser')
  const meta = await parseBlob(file, { skipCovers: false })
  const { common, format, native } = meta

  // AIGC: 查找 ID3v2 TXXX:AIGC 或 TXXX:XmpKvBase64
  let aigcRaw: string | null = null
  const id3Native = native['ID3v2.3'] ?? native['ID3v2.4'] ?? []
  for (const tag of id3Native) {
    if (tag.id === 'TXXX' && typeof tag.value === 'object') {
      const txxx = tag.value as { description: string; text: string }
      if (txxx.description === 'AIGC' || txxx.description === 'XmpKvBase64') {
        aigcRaw = txxx.text
        break
      }
    }
  }
  const aigcFields = aigcRaw ? parseAigcJson(aigcRaw) : null
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'ID3 TXXX:AIGC' : '')

  const basicFields: MetaField[] = [
    { key: 'title', value: common.title ?? '—', cnName: '标题', isNonDefault: !!common.title },
    { key: 'artist', value: common.artist ?? '—', cnName: '艺术家', isNonDefault: !!common.artist },
    { key: 'album', value: common.album ?? '—', cnName: '专辑', isNonDefault: !!common.album },
    { key: 'year', value: common.year ?? '—', cnName: '年份', isNonDefault: !!common.year },
    { key: 'genre', value: common.genre?.join(', ') ?? '—', cnName: '流派', isNonDefault: !!(common.genre?.length) },
    { key: 'comment', value: common.comment?.[0]?.text ?? '—', cnName: '备注', isNonDefault: !!(common.comment?.length) },
    { key: 'encoder', value: common.encodedby ?? '—', cnName: '编码软件', isNonDefault: !!common.encodedby },
  ]

  const formatFields: MetaField[] = [
    { key: 'container', value: format.container ?? '—', cnName: '容器格式', isNonDefault: false },
    { key: 'codec', value: format.codec ?? '—', cnName: '编解码器', isNonDefault: false },
    { key: 'bitrate', value: format.bitrate ? `${Math.round(format.bitrate / 1000)} kbps` : '—', cnName: '比特率', isNonDefault: false },
    { key: 'sampleRate', value: format.sampleRate ? `${format.sampleRate} Hz` : '—', cnName: '采样率', isNonDefault: false },
    { key: 'duration', value: format.duration ? `${format.duration.toFixed(2)} s` : '—', cnName: '时长', isNonDefault: false },
    { key: 'numberOfChannels', value: format.numberOfChannels ?? '—', cnName: '声道数', isNonDefault: false },
  ]

  const groups: MetaGroup[] = [
    { id: 'basic', title: '基本信息', fields: basicFields, nonDefaultCount: basicFields.filter(f => f.isNonDefault).length },
    { id: 'format', title: '格式参数', fields: formatFields, nonDefaultCount: 0 },
  ]

  return { file, mediaType: 'audio', aigc, groups }
}
```

- [ ] **Commit**

```bash
git add src/parsers/audio.ts && git commit -m "feat: audio metadata parser (music-metadata-browser)"
```

---

## Task 8: 视频 / PDF / DOCX 解析器

**Files:**
- Create: `src/parsers/video.ts`, `src/parsers/pdf.ts`, `src/parsers/docx.ts`

- [ ] **安装 mediainfo 和 pdfjs**

```bash
npm install mediainfo.js pdfjs-dist
```

- [ ] **写 `src/parsers/video.ts`**

```typescript
import type { FileAnalysis, MetaGroup, MetaField } from '../types.js'
import { extractFromXmpString, buildAigcResult } from './aigc.js'

export async function parseVideo(file: File): Promise<FileAnalysis> {
  const MediaInfo = (await import('mediainfo.js')).default
  const mi = await MediaInfo({ format: 'object', locateFile: () => '/node_modules/mediainfo.js/dist/MediaInfoModule.wasm' })

  const result = await mi.analyzeData(
    () => file.size,
    (size, offset) => new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = e => resolve(new Uint8Array(e.target!.result as ArrayBuffer))
      reader.readAsArrayBuffer(file.slice(offset, offset + size))
    })
  )
  mi.close()

  const tracks = result.media?.track ?? []
  const general = tracks.find((t: { '@type': string }) => t['@type'] === 'General') as Record<string, string> | undefined
  const videoTracks = tracks.filter((t: { '@type': string }) => t['@type'] === 'Video') as Record<string, string>[]
  const audioTracks = tracks.filter((t: { '@type': string }) => t['@type'] === 'Audio') as Record<string, string>[]

  // AIGC from XMP comment / tags
  const xmpComment = general?.['XMP_com.apple.quicktime.XMP'] ?? general?.['Comment'] ?? ''
  const aigcFields = extractFromXmpString(xmpComment)
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'moov XMP 元数据' : '')

  const toFields = (rec: Record<string, string>): MetaField[] =>
    Object.entries(rec)
      .filter(([k]) => !k.startsWith('@'))
      .map(([k, v]) => ({ key: k, value: String(v), cnName: k, isNonDefault: false }))

  const groups: MetaGroup[] = []
  if (general) groups.push({ id: 'general', title: '容器信息', fields: toFields(general), nonDefaultCount: 0 })
  videoTracks.forEach((t, i) =>
    groups.push({ id: `video${i}`, title: `视频流 ${i + 1}`, fields: toFields(t), nonDefaultCount: 0 }))
  audioTracks.forEach((t, i) =>
    groups.push({ id: `audio${i}`, title: `音频流 ${i + 1}`, fields: toFields(t), nonDefaultCount: 0 }))

  // video preview frame
  const previewUrl = await captureVideoFrame(file)

  return { file, mediaType: 'video', aigc, groups, previewUrl }
}

async function captureVideoFrame(file: File): Promise<string> {
  return new Promise(resolve => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.currentTime = 0.5
    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas')
      canvas.width = 240; canvas.height = 135
      canvas.getContext('2d')!.drawImage(video, 0, 0, 240, 135)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }, { once: true })
    video.load()
  })
}
```

- [ ] **写 `src/parsers/pdf.ts`**

```typescript
import type { FileAnalysis, MetaGroup, MetaField } from '../types.js'
import { parseAigcJson, extractFromXmpString, buildAigcResult } from './aigc.js'

export async function parsePdf(file: File): Promise<FileAnalysis> {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href

  const arrayBuffer = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const info = await doc.getMetadata()

  const infoDict = (info.info ?? {}) as Record<string, unknown>
  const xmpStr = info.metadata?.getRaw() ?? ''

  // AIGC: 先查文档信息字典里的 /AIGC 键，再查 XMP
  const aigcRaw = (infoDict['AIGC'] as string | undefined) ?? null
  const aigcFields = aigcRaw
    ? parseAigcJson(aigcRaw)
    : extractFromXmpString(xmpStr)
  const aigc = buildAigcResult(aigcFields, aigcFields ? (aigcRaw ? 'PDF 信息字典' : 'XMP 流') : '')

  const cnMap: Record<string, string> = {
    Title: '标题', Author: '作者', Subject: '主题', Keywords: '关键词',
    Creator: '创建软件', Producer: '生成软件', CreationDate: '创建时间',
    ModDate: '修改时间', Trapped: '陷印',
  }

  const fields: MetaField[] = Object.entries(infoDict).map(([k, v]) => ({
    key: k,
    value: String(v),
    cnName: cnMap[k] ?? k,
    isNonDefault: ['Creator', 'Producer', 'Author', 'Keywords', 'Subject'].includes(k) && !!v,
  }))

  const groups: MetaGroup[] = [
    { id: 'info', title: '文档信息', fields, nonDefaultCount: fields.filter(f => f.isNonDefault).length },
  ]

  if (xmpStr) {
    groups.push({
      id: 'xmp', title: 'XMP 元数据',
      fields: [{ key: 'raw', value: xmpStr.slice(0, 500) + (xmpStr.length > 500 ? '…' : ''), cnName: '原始 XMP', isNonDefault: false }],
      nonDefaultCount: 0,
    })
  }

  return { file, mediaType: 'pdf', aigc, groups }
}
```

- [ ] **写 `src/parsers/docx.ts`**

```typescript
import type { FileAnalysis, MetaGroup, MetaField } from '../types.js'
import { parseAigcJson, buildAigcResult } from './aigc.js'

export async function parseDocx(file: File): Promise<FileAnalysis> {
  const { unzipSync, strFromU8 } = await import('fflate')
  const buffer = await file.arrayBuffer()
  const zip = unzipSync(new Uint8Array(buffer))

  function readXml(path: string): Document | null {
    const data = zip[path]
    if (!data) return null
    return new DOMParser().parseFromString(strFromU8(data), 'application/xml')
  }

  const core = readXml('docProps/core.xml')
  const custom = readXml('docProps/custom.xml')

  const get = (doc: Document | null, tag: string): string =>
    doc?.getElementsByTagNameNS('*', tag)[0]?.textContent?.trim() ?? ''

  const cnMap: Record<string, string> = {
    title: '标题', subject: '主题', creator: '作者', keywords: '关键词',
    description: '描述', lastModifiedBy: '最后修改者', created: '创建时间', modified: '修改时间',
  }

  const coreFields: MetaField[] = Object.entries(cnMap).map(([k, cn]) => ({
    key: k, value: get(core, k) || '—', cnName: cn, isNonDefault: !!get(core, k),
  }))

  // 自定义属性（AIGC 就藏在这里）
  let aigcRaw: string | null = null
  const customFields: MetaField[] = []
  custom?.querySelectorAll('property').forEach(prop => {
    const name = prop.getAttribute('name') ?? ''
    const value = prop.querySelector('vt\\:lpwstr, lpwstr')?.textContent?.trim() ?? ''
    if (name === 'AIGC') aigcRaw = value
    customFields.push({ key: name, value, cnName: name, isNonDefault: name === 'AIGC' })
  })

  const aigcFields = aigcRaw ? parseAigcJson(aigcRaw) : null
  const aigc = buildAigcResult(aigcFields, aigcFields ? 'Office 自定义属性' : '')

  const groups: MetaGroup[] = [
    { id: 'core', title: '文档属性', fields: coreFields, nonDefaultCount: coreFields.filter(f => f.isNonDefault).length },
  ]
  if (customFields.length) {
    groups.push({ id: 'custom', title: '自定义属性', fields: customFields, nonDefaultCount: customFields.filter(f => f.isNonDefault).length })
  }

  return { file, mediaType: 'docx', aigc, groups }
}
```

- [ ] **Commit**

```bash
git add src/parsers/ && git commit -m "feat: video/pdf/docx parsers (lazy WASM)"
```

---

## Task 9: 样例文件生成脚本

**Files:**
- Create: `scripts/generate-samples.ts`
- Create: `public/samples/` (目录，内含 3 个生成文件)

- [ ] **安装脚本依赖**

```bash
npm install -D tsx
```

- [ ] **写 `scripts/generate-samples.ts`**

```typescript
/**
 * 生成带 AIGC 水印的最小样例文件，供"查看样例"按钮使用。
 * 运行：node --loader tsx scripts/generate-samples.ts
 */
import { writeFileSync, mkdirSync } from 'fs'

const AIGC_FIELDS = {
  Label: '1',
  ContentProducer: '001191110000802100433BY43',
  ProduceID: 'SAMPLE-2026-001',
  ReservedCode1: 'd41d8cd98f00b204e9800998ecf8427e',
  ContentPropagator: '001191110000802100433BY43',
  PropagateID: 'SAMPLE-PROP-001',
  ReservedCode2: 'd41d8cd98f00b204e9800998ecf8427e',
}

const AIGC_JSON = JSON.stringify({ AIGC: AIGC_FIELDS })
const AIGC_B64 = Buffer.from(AIGC_JSON).toString('base64')

mkdirSync('public/samples', { recursive: true })

// ── 1. JPEG with AIGC XMP ──────────────────────────────────────
function buildJpegWithXmp(): Buffer {
  const xmpPayload = [
    'http://ns.adobe.com/xap/1.0/\0',
    `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>`,
    `<x:xmpmeta xmlns:x="adobe:ns:meta/">`,
    `<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">`,
    `<rdf:Description rdf:about=""`,
    ` xmlns:AIGC="http://www.tc260.org.cn/ns/AIGC/1.0/"`,
    ` XmpKvBase64="${AIGC_B64}"`,
    ` AIGC:Label="${AIGC_FIELDS.Label}"`,
    ` AIGC:ContentProducer="${AIGC_FIELDS.ContentProducer}"`,
    ` AIGC:ProduceID="${AIGC_FIELDS.ProduceID}"`,
    `/>`,
    `</rdf:RDF></x:xmpmeta>`,
    `<?xpacket end="w"?>`,
  ].join('')

  const xmpBytes = Buffer.from(xmpPayload, 'utf8')
  const app1Len = xmpBytes.length + 2
  const app1Header = Buffer.from([0xFF, 0xE1, (app1Len >> 8) & 0xFF, app1Len & 0xFF])

  // 最小有效 JPEG (1×1 像素，白色)
  const minJpeg = Buffer.from([
    0xFF,0xD8, // SOI
    // APP0 JFIF
    0xFF,0xE0, 0x00,0x10, 0x4A,0x46,0x49,0x46,0x00, 0x01,0x01,0x00,0x00,0x01,0x00,0x01,0x00,0x00,
    // DQT
    0xFF,0xDB, 0x00,0x43, 0x00,
    ...Array(64).fill(16),
    // SOF0
    0xFF,0xC0, 0x00,0x0B, 0x08,0x00,0x01,0x00,0x01,0x01,0x01,0x11,0x00,
    // DHT (simplified)
    0xFF,0xC4, 0x00,0x1F, 0x00,
    0x00,0x01,0x05,0x01,0x01,0x01,0x01,0x01,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
    0x00,0x01,0x02,0x03,0x04,0x05,0x06,0x07,0x08,0x09,0x0A,0x0B,
    // SOS
    0xFF,0xDA, 0x00,0x08, 0x01,0x01,0x00,0x00,0x3F,0x00, 0xF8,
    // EOI
    0xFF,0xD9,
  ])

  // 插入 APP1 XMP 在 SOI 之后、APP0 之前
  return Buffer.concat([
    minJpeg.slice(0, 2),    // SOI
    app1Header,              // APP1 header
    xmpBytes,                // XMP payload
    minJpeg.slice(2),        // rest of JPEG
  ])
}

// ── 2. MP3 with AIGC ID3 TXXX tag ─────────────────────────────
function buildMp3WithId3(): Buffer {
  function encodeSize(n: number): Buffer {
    return Buffer.from([
      (n >> 21) & 0x7F,
      (n >> 14) & 0x7F,
      (n >> 7) & 0x7F,
      n & 0x7F,
    ])
  }

  function txxxFrame(description: string, text: string): Buffer {
    const payload = Buffer.concat([
      Buffer.from([0x03]), // UTF-8
      Buffer.from(description + '\0', 'utf8'),
      Buffer.from(text, 'utf8'),
    ])
    const header = Buffer.from([
      0x54, 0x58, 0x58, 0x58, // "TXXX"
      0x00, 0x00, 0x00, payload.length,
      0x00, 0x00,
    ])
    return Buffer.concat([header, payload])
  }

  const aigcFrame = txxxFrame('AIGC', 'AIGC=' + AIGC_JSON)
  const id3Body = aigcFrame
  const id3Header = Buffer.concat([
    Buffer.from('ID3'),
    Buffer.from([0x03, 0x00, 0x00]), // ID3v2.3, no flags
    encodeSize(id3Body.length),
  ])

  // 最小 MP3 帧（静音）
  const silentMp3Frame = Buffer.from([
    0xFF, 0xFB, 0x90, 0x00, // sync + 128kbps + 44100Hz + stereo
    ...Array(413).fill(0),  // 静音数据
  ])

  return Buffer.concat([id3Header, id3Body, silentMp3Frame])
}

// ── 3. PDF with AIGC Info Dict ─────────────────────────────────
function buildPdfWithAigc(): Buffer {
  const aigcValue = AIGC_JSON.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')

  const body = [
    '%PDF-1.4',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj',
    `4 0 obj<</Title(AIGC Checker 样例文档)/Creator(aigc-checker)/AIGC(${aigcValue})>>endobj`,
  ].join('\n')

  const xrefPos = body.length + 1
  const xref = [
    'xref',
    '0 5',
    '0000000000 65535 f ',
    `${String(body.indexOf('1 0 obj')).padStart(10, '0')} 00000 n `,
    `${String(body.indexOf('2 0 obj')).padStart(10, '0')} 00000 n `,
    `${String(body.indexOf('3 0 obj')).padStart(10, '0')} 00000 n `,
    `${String(body.indexOf('4 0 obj')).padStart(10, '0')} 00000 n `,
    'trailer<</Size 5/Root 1 0 R/Info 4 0 R>>',
    'startxref',
    String(xrefPos),
    '%%EOF',
  ].join('\n')

  return Buffer.from(body + '\n' + xref, 'utf8')
}

writeFileSync('public/samples/sample-image.jpg', buildJpegWithXmp())
writeFileSync('public/samples/sample-audio.mp3', buildMp3WithId3())
writeFileSync('public/samples/sample-document.pdf', buildPdfWithAigc())

console.log('✓ 样例文件生成完毕 → public/samples/')
```

- [ ] **运行生成脚本**

```bash
node --loader tsx scripts/generate-samples.ts
ls -la public/samples/
```

Expected: 看到 3 个文件，sample-image.jpg / sample-audio.mp3 / sample-document.pdf。

- [ ] **Commit**

```bash
git add scripts/ public/samples/ && git commit -m "feat: add sample file generator with AIGC watermarks"
```

---

## Task 10: UI 基础组件（scan-line、preview、aigc-card）

**Files:**
- Create: `src/components/scan-line.ts`, `src/components/preview.ts`, `src/components/aigc-card.ts`

- [ ] **写 `src/components/scan-line.ts`**

```typescript
/** 扫描线 loading 动效 */
export function createScanLine(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'relative overflow-hidden rounded-lg bg-card h-1'
  el.innerHTML = `
    <div class="scan-bar absolute top-0 left-0 h-full w-1/3 bg-gradient-to-r from-transparent via-accent-cyan to-transparent opacity-80"></div>
    <style>
      @keyframes scan { from{left:-33%} to{left:100%} }
      .scan-bar { animation: scan 1.2s linear infinite; }
      @media (prefers-reduced-motion:reduce) { .scan-bar { animation:none; left:33%; } }
    </style>
  `
  return el
}
```

- [ ] **写 `src/components/preview.ts`**

```typescript
import type { FileAnalysis } from '../types.js'

export function renderPreview(analysis: FileAnalysis): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'flex items-center gap-4 sm:flex-col sm:items-start'

  const thumb = document.createElement('div')
  thumb.className = 'w-24 h-24 sm:w-40 sm:h-40 rounded-lg overflow-hidden bg-surface flex items-center justify-center flex-shrink-0'

  if (analysis.previewUrl && (analysis.mediaType === 'image' || analysis.mediaType === 'video')) {
    const img = document.createElement('img')
    img.src = analysis.previewUrl
    img.alt = analysis.file.name
    img.className = 'w-full h-full object-contain'
    thumb.appendChild(img)
  } else {
    const icon = mediaIcon(analysis.mediaType)
    thumb.innerHTML = `<span class="text-text-muted text-4xl">${icon}</span>`
  }

  const info = document.createElement('div')
  info.className = 'flex flex-col gap-1 min-w-0'
  info.innerHTML = `
    <p class="text-text-primary font-medium truncate max-w-[200px] sm:max-w-full" title="${analysis.file.name}">${analysis.file.name}</p>
    <p class="text-text-muted text-sm font-mono">${formatSize(analysis.file.size)}</p>
    <p class="text-text-muted text-sm">${analysis.file.type || '未知类型'}</p>
  `

  wrap.appendChild(thumb)
  wrap.appendChild(info)
  return wrap
}

function mediaIcon(type: string): string {
  const icons: Record<string, string> = {
    image: '🖼', video: '🎬', audio: '🎵', pdf: '📄', docx: '📝',
  }
  return icons[type] ?? '📁'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}
```

- [ ] **写 `src/components/aigc-card.ts`**

```typescript
import type { AigcResult, AigcFields } from '../types.js'
import { AIGC_FIELD_CN, LABEL_VALUES, parseProducerCode } from '../dict/aigc-cn.js'
import { lookupProducer } from '../dict/producer-codes.js'

export function renderAigcCard(aigc: AigcResult): HTMLElement {
  const card = document.createElement('div')
  card.className = [
    'rounded-xl border p-4 transition-all duration-180',
    aigc.status === 'found' ? 'border-accent-cyan/40 aigc-glow' :
    aigc.status === 'partial' ? 'border-accent-amber/40' :
    'border-white/10',
  ].join(' ')

  const badge = statusBadge(aigc.status)
  const fieldsHtml = aigc.status !== 'not-found'
    ? renderFields(aigc.fields)
    : `<p class="text-text-muted text-sm mt-2">未在 XMP、ID3、PDF 信息字典等位置发现 AIGC 标识字段。</p>`

  card.innerHTML = `
    <div class="flex items-center gap-2 mb-3">
      <span class="text-text-secondary text-sm font-medium">AIGC 隐水印检测</span>
      ${badge}
    </div>
    ${aigc.status !== 'not-found' && aigc.source
      ? `<p class="text-xs text-text-muted mb-2">来源：${aigc.source}</p>` : ''}
    ${fieldsHtml}
  `
  return card
}

function statusBadge(status: AigcResult['status']): string {
  if (status === 'found') return `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">已检出</span>`
  if (status === 'partial') return `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-accent-amber/10 text-accent-amber border border-accent-amber/30">标识不完整</span>`
  return `<span class="text-xs font-medium px-2 py-0.5 rounded-full bg-white/5 text-text-muted border border-white/10">未检出</span>`
}

function renderFields(fields: AigcFields): string {
  const rows = Object.entries(fields).map(([key, val]) => {
    if (!val) return ''
    const cn = AIGC_FIELD_CN[key] ?? key
    let display = String(val)

    if (key === 'Label') display = `${val} · ${LABEL_VALUES[val] ?? val}`
    if ((key === 'ContentProducer' || key === 'ContentPropagator') && typeof val === 'string') {
      const parsed = parseProducerCode(val)
      const known = lookupProducer(parsed.creditCode)
      display = known ? `${known}` : `${parsed.creditCode}`
      display += ` <span class="text-text-muted text-xs font-mono">${val.slice(0, 20)}…</span>`
    }
    if ((key === 'ReservedCode1' || key === 'ReservedCode2') && typeof val === 'string') {
      display = `<span class="font-mono text-xs">${val.slice(0, 16)}…</span>`
    }

    return `
      <div class="flex justify-between items-start gap-2 py-1.5 border-b border-white/5 last:border-0">
        <span class="text-text-muted text-sm flex-shrink-0 w-28">${cn}</span>
        <span class="text-text-primary text-sm text-right">${display}</span>
      </div>
    `
  }).join('')

  return `<div class="space-y-0">${rows}</div>`
}
```

- [ ] **Commit**

```bash
git add src/components/scan-line.ts src/components/preview.ts src/components/aigc-card.ts
git commit -m "feat: scan-line, preview, aigc-card UI components"
```

---

## Task 11: 元数据面板组件

**Files:**
- Create: `src/components/metadata-row.ts`, `src/components/metadata-group.ts`

- [ ] **写 `src/components/metadata-row.ts`**

```typescript
import type { MetaField } from '../types.js'

export function renderMetadataRow(field: MetaField): HTMLElement {
  const row = document.createElement('div')
  row.className = [
    'flex gap-2 py-2 border-b border-white/5 last:border-0',
    field.isNonDefault ? 'nondefault-bar pl-2' : 'pl-2',
    // Mobile: column; Desktop: row
    'flex-col sm:flex-row sm:items-start',
  ].join(' ')

  const displayVal = Array.isArray(field.value) ? field.value.join(', ') : String(field.value ?? '—')
  const truncated = displayVal.length > 64 ? displayVal.slice(0, 64) + '…' : displayVal
  const needsCopy = displayVal.length > 20

  row.innerHTML = `
    <div class="flex items-center gap-1.5 flex-shrink-0 sm:w-40">
      <span class="text-text-muted text-xs">${field.key}</span>
      ${field.isNonDefault ? `<span class="text-accent-amber text-xs" title="非默认值，默认：${field.defaultDesc ?? '—'}">⚠</span>` : ''}
    </div>
    <div class="flex-1 flex items-start justify-between gap-2">
      <div class="min-w-0">
        <span class="text-text-primary text-sm font-mono break-all" title="${displayVal}">${truncated}</span>
        ${field.cnDesc ? `<span class="text-text-muted text-xs ml-1">${field.cnDesc}</span>` : ''}
        ${field.cnName && field.cnName !== field.key
          ? `<div class="text-text-secondary text-xs mt-0.5">${field.cnName}</div>` : ''}
        ${field.isNonDefault && field.defaultDesc
          ? `<div class="text-text-muted text-xs mt-0.5">默认值：${field.defaultDesc}</div>` : ''}
      </div>
      ${needsCopy ? `<button class="copy-btn flex-shrink-0 text-xs text-text-muted hover:text-accent-cyan transition-colors duration-150 px-1.5 py-0.5 rounded" data-val="${encodeURIComponent(displayVal)}">复制</button>` : ''}
    </div>
  `

  row.querySelector('.copy-btn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement
    const val = decodeURIComponent(btn.dataset['val'] ?? '')
    navigator.clipboard.writeText(val).then(() => {
      btn.textContent = '✓'
      setTimeout(() => (btn.textContent = '复制'), 1500)
    })
  })

  return row
}
```

- [ ] **写 `src/components/metadata-group.ts`**

```typescript
import type { MetaGroup } from '../types.js'
import { renderMetadataRow } from './metadata-row.js'

export function renderMetadataGroup(group: MetaGroup, defaultOpen = false): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'rounded-xl border border-white/10 overflow-hidden'

  const header = document.createElement('button')
  header.className = 'w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-surface transition-colors duration-150 min-h-[48px]'
  header.setAttribute('aria-expanded', String(defaultOpen))

  const badgeCn = group.nonDefaultCount > 0
    ? `<span class="text-xs px-1.5 py-0.5 rounded bg-accent-amber/10 text-accent-amber border border-accent-amber/20">${group.nonDefaultCount} 非默认</span>`
    : ''

  header.innerHTML = `
    <div class="flex items-center gap-2">
      <span class="text-text-primary text-sm font-medium">${group.title}</span>
      <span class="text-text-muted text-xs">${group.fields.length} 项</span>
      ${badgeCn}
    </div>
    <span class="chevron text-text-muted text-xs transition-transform duration-220 ${defaultOpen ? 'rotate-180' : ''}">▼</span>
  `

  const body = document.createElement('div')
  body.className = `overflow-hidden transition-all duration-220 ${defaultOpen ? '' : 'hidden'}`

  const inner = document.createElement('div')
  inner.className = 'px-4 pb-2'
  group.fields.forEach(f => inner.appendChild(renderMetadataRow(f)))
  body.appendChild(inner)

  header.addEventListener('click', () => {
    const isOpen = header.getAttribute('aria-expanded') === 'true'
    header.setAttribute('aria-expanded', String(!isOpen))
    header.querySelector('.chevron')?.classList.toggle('rotate-180', !isOpen)
    body.classList.toggle('hidden', isOpen)
  })

  header.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); header.click() }
  })

  wrap.appendChild(header)
  wrap.appendChild(body)
  return wrap
}
```

- [ ] **Commit**

```bash
git add src/components/metadata-row.ts src/components/metadata-group.ts
git commit -m "feat: metadata row and group accordion components"
```

---

## Task 12: Dropzone 组件

**Files:**
- Create: `src/components/dropzone.ts`

- [ ] **写 `src/components/dropzone.ts`**

```typescript
const ACCEPT_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/avif,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/flac,audio/ogg,audio/mp4,application/pdf,.docx,.jpg,.png,.mp4,.mov,.mp3,.pdf,.docx'

export type OnFileSelected = (file: File) => void

export function renderDropzone(onFile: OnFileSelected): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh]'

  const zone = document.createElement('div')
  zone.className = [
    'w-full max-w-lg mx-auto rounded-2xl border-2 border-dashed border-white/20',
    'flex flex-col items-center justify-center gap-4 p-8 sm:p-12',
    'cursor-pointer transition-all duration-150',
    'hover:border-accent-cyan/60 hover:bg-accent-cyan/5',
  ].join(' ')
  zone.setAttribute('role', 'button')
  zone.setAttribute('tabindex', '0')
  zone.setAttribute('aria-label', '上传文件区域，点击或拖拽文件到此处')

  const input = document.createElement('input')
  input.type = 'file'
  input.accept = ACCEPT_TYPES
  input.className = 'hidden'
  input.setAttribute('aria-hidden', 'true')

  const cameraInput = document.createElement('input')
  cameraInput.type = 'file'
  cameraInput.accept = 'image/*'
  cameraInput.setAttribute('capture', 'environment')
  cameraInput.className = 'hidden'
  cameraInput.setAttribute('aria-hidden', 'true')

  zone.innerHTML = `
    <div class="w-16 h-16 rounded-full bg-surface flex items-center justify-center">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    </div>
    <div class="text-center">
      <p class="text-text-primary font-medium mb-1">拖拽文件到此处</p>
      <p class="text-text-muted text-sm">或点击选择文件</p>
    </div>
    <div class="flex flex-wrap justify-center gap-1.5">
      ${['JPG','PNG','HEIC','WebP','MP4','MOV','MP3','PDF','DOCX'].map(t =>
        `<span class="text-xs px-2 py-0.5 rounded bg-surface text-text-muted border border-white/10">${t}</span>`
      ).join('')}
    </div>
  `

  // 拍照按钮（仅移动端语义上显示，桌面也可用）
  const cameraBtn = document.createElement('button')
  cameraBtn.className = 'mt-2 text-xs text-accent-cyan underline underline-offset-2'
  cameraBtn.textContent = '或使用相机拍照'
  cameraBtn.type = 'button'
  cameraBtn.addEventListener('click', (e) => { e.stopPropagation(); cameraInput.click() })

  zone.appendChild(input)
  zone.appendChild(cameraInput)
  zone.appendChild(cameraBtn)

  const handleFile = (file: File) => onFile(file)

  zone.addEventListener('click', () => input.click())
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') input.click() })
  input.addEventListener('change', () => { if (input.files?.[0]) handleFile(input.files[0]) })
  cameraInput.addEventListener('change', () => { if (cameraInput.files?.[0]) handleFile(cameraInput.files[0]) })

  zone.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.add('border-accent-cyan', 'bg-accent-cyan/5')
    zone.classList.remove('border-white/20')
  })
  zone.addEventListener('dragleave', () => {
    zone.classList.remove('border-accent-cyan', 'bg-accent-cyan/5')
    zone.classList.add('border-white/20')
  })
  zone.addEventListener('drop', (e) => {
    e.preventDefault()
    zone.classList.remove('border-accent-cyan', 'bg-accent-cyan/5')
    zone.classList.add('border-white/20')
    const file = e.dataTransfer?.files[0]
    if (file) handleFile(file)
  })

  wrap.appendChild(zone)
  return wrap
}
```

- [ ] **Commit**

```bash
git add src/components/dropzone.ts && git commit -m "feat: dropzone component with drag-drop and camera capture"
```

---

## Task 13: 主入口 + 样例按钮

**Files:**
- Modify: `src/main.ts`

- [ ] **写 `src/main.ts`**

```typescript
import './styles.css'
import type { FileAnalysis, MediaType } from './types.js'
import { renderDropzone } from './components/dropzone.js'
import { renderPreview } from './components/preview.js'
import { renderAigcCard } from './components/aigc-card.js'
import { renderMetadataGroup } from './components/metadata-group.js'
import { createScanLine } from './components/scan-line.js'
import { exportJson } from './lib/export.js'

const SAMPLES: { label: string; file: string; type: string }[] = [
  { label: '样例图片 (JPEG · AIGC 水印)', file: '/samples/sample-image.jpg', type: 'image/jpeg' },
  { label: '样例音频 (MP3 · AIGC ID3)', file: '/samples/sample-audio.mp3', type: 'audio/mpeg' },
  { label: '样例文档 (PDF · AIGC 信息字典)', file: '/samples/sample-document.pdf', type: 'application/pdf' },
]

async function analyzeFile(file: File): Promise<FileAnalysis> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const mime = file.type.toLowerCase()

  if (mime.startsWith('image/') || ['jpg','jpeg','png','webp','heic','avif'].includes(ext)) {
    const { parseImage } = await import('./parsers/image.js')
    return parseImage(file)
  }
  if (mime.startsWith('audio/') || ['mp3','flac','ogg','m4a','aac'].includes(ext)) {
    const { parseAudio } = await import('./parsers/audio.js')
    return parseAudio(file)
  }
  if (mime.startsWith('video/') || ['mp4','mov','webm','mkv'].includes(ext)) {
    const { parseVideo } = await import('./parsers/video.js')
    return parseVideo(file)
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    const { parsePdf } = await import('./parsers/pdf.js')
    return parsePdf(file)
  }
  if (ext === 'docx' || ext === 'xlsx' || ext === 'pptx') {
    const { parseDocx } = await import('./parsers/docx.js')
    return parseDocx(file)
  }
  return { file, mediaType: 'unknown' as MediaType, aigc: { status: 'not-found', fields: {}, source: '' }, groups: [], error: '不支持的文件类型' }
}

function renderResult(analysis: FileAnalysis, app: HTMLElement) {
  app.innerHTML = ''

  // Header
  app.appendChild(buildHeader())

  const main = document.createElement('main')
  main.className = 'max-w-3xl mx-auto px-4 py-6 pb-safe'

  // 顶部：预览 + AIGC 卡
  const topRow = document.createElement('div')
  topRow.className = 'flex flex-col sm:flex-row gap-4 mb-6'

  const previewWrap = document.createElement('div')
  previewWrap.className = 'sm:w-48 flex-shrink-0'
  previewWrap.appendChild(renderPreview(analysis))

  const aigcWrap = document.createElement('div')
  aigcWrap.className = 'flex-1'
  aigcWrap.appendChild(renderAigcCard(analysis.aigc))

  topRow.appendChild(previewWrap)
  topRow.appendChild(aigcWrap)
  main.appendChild(topRow)

  // 元数据面板
  analysis.groups.forEach((g, i) => main.appendChild(renderMetadataGroup(g, i === 0)))

  // 底部操作栏
  const bar = document.createElement('div')
  bar.className = 'fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur border-t border-white/10 px-4 pt-3 pb-safe z-50'
  bar.innerHTML = `
    <div class="max-w-3xl mx-auto flex gap-3">
      <button id="btn-reset" class="flex-1 sm:flex-none px-4 h-11 rounded-lg bg-surface text-text-secondary text-sm font-medium hover:bg-white/10 transition-colors">重新选择</button>
      <button id="btn-export" class="flex-1 sm:flex-none px-4 h-11 rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/30 text-sm font-medium hover:bg-accent-green/20 transition-colors">导出 JSON</button>
    </div>
  `
  bar.querySelector('#btn-reset')?.addEventListener('click', () => renderHome(app))
  bar.querySelector('#btn-export')?.addEventListener('click', () => exportJson(analysis))

  app.appendChild(main)
  app.appendChild(bar)
}

function renderHome(app: HTMLElement) {
  app.innerHTML = ''
  app.appendChild(buildHeader())

  const main = document.createElement('main')
  main.className = 'max-w-3xl mx-auto px-4 pt-4'

  const dropzone = renderDropzone(async (file) => {
    app.innerHTML = ''
    app.appendChild(buildHeader())
    const loadingEl = document.createElement('div')
    loadingEl.className = 'max-w-3xl mx-auto px-4 py-8 flex flex-col gap-4'
    loadingEl.innerHTML = `<p class="text-text-secondary text-sm text-center">正在解析 <span class="font-mono text-accent-cyan">${file.name}</span>…</p>`
    loadingEl.appendChild(createScanLine())
    app.appendChild(loadingEl)

    try {
      const analysis = await analyzeFile(file)
      renderResult(analysis, app)
    } catch (err) {
      loadingEl.innerHTML = `<p class="text-accent-red text-sm text-center">解析失败：${String(err)}</p>`
    }
  })
  main.appendChild(dropzone)

  // 样例按钮区
  const sampleSection = document.createElement('div')
  sampleSection.className = 'mt-8 mb-4'
  sampleSection.innerHTML = `
    <p class="text-text-muted text-xs text-center mb-3">或体验内置样例</p>
    <div class="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
      ${SAMPLES.map((s, i) => `
        <button data-idx="${i}" class="sample-btn flex-1 px-3 py-2.5 rounded-lg bg-surface border border-white/10 text-text-secondary text-xs hover:border-accent-cyan/40 hover:text-accent-cyan transition-all duration-150 text-left sm:text-center">
          ${s.label}
        </button>
      `).join('')}
    </div>
  `

  sampleSection.querySelectorAll<HTMLButtonElement>('.sample-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = Number(btn.dataset['idx'])
      const sample = SAMPLES[idx]
      if (!sample) return
      const resp = await fetch(sample.file)
      const blob = await resp.blob()
      const file = new File([blob], sample.file.split('/').pop() ?? 'sample', { type: sample.type })
      dropzone.dispatchEvent(Object.assign(new Event('_sample'), { _file: file }))
      // 直接调用 analyzeFile
      app.innerHTML = ''
      app.appendChild(buildHeader())
      const loadEl = document.createElement('div')
      loadEl.className = 'max-w-3xl mx-auto px-4 py-8'
      loadEl.appendChild(createScanLine())
      app.appendChild(loadEl)
      try {
        const analysis = await analyzeFile(file)
        renderResult(analysis, app)
      } catch (err) {
        loadEl.innerHTML = `<p class="text-accent-red text-sm">样例加载失败：${String(err)}</p>`
      }
    })
  })

  main.appendChild(sampleSection)
  app.appendChild(main)
}

function buildHeader(): HTMLElement {
  const header = document.createElement('header')
  header.className = 'sticky top-0 z-40 bg-bg/90 backdrop-blur border-b border-white/10 pt-safe'
  header.innerHTML = `
    <div class="max-w-3xl mx-auto px-4 h-12 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <span class="text-accent-cyan font-bold text-lg tracking-tight">AIGC</span>
        <span class="text-text-secondary font-light">Checker</span>
      </div>
      <div class="flex items-center gap-3">
        <span class="hidden sm:inline-flex items-center gap-1.5 text-xs text-accent-green border border-accent-green/30 rounded-full px-2.5 py-1 bg-accent-green/5">
          <span class="w-1.5 h-1.5 rounded-full bg-accent-green inline-block"></span>
          本地解析 · 0 字节上传
        </span>
        <a href="https://github.com/methol/aigc-checker" target="_blank" rel="noopener"
           class="text-text-muted text-xs hover:text-text-primary transition-colors" aria-label="GitHub">GitHub ↗</a>
      </div>
    </div>
  `
  return header
}

// 启动
const app = document.getElementById('app')!
renderHome(app)
```

- [ ] **运行 dev server 验证**

```bash
npm run dev
```

打开 http://localhost:5173，检查：
- [ ] 深色背景，Header 正常显示
- [ ] Dropzone 可点击，拖拽边框变青色
- [ ] 三个样例按钮可见，点击后显示扫描线
- [ ] 样例图片解析后，AIGC 卡显示"已检出"（青色辉光）
- [ ] 折叠面板可展开/收起，键盘可操作

- [ ] **Commit**

```bash
git add src/main.ts && git commit -m "feat: main orchestrator with sample buttons and full result view"
```

---

## Task 14: 构建 & 部署到 Cloudflare Pages

**Files:**
- No new files（使用 Task 1 已创建的 `_headers`, `_redirects`）

- [ ] **先生成样例文件**

```bash
node --loader tsx scripts/generate-samples.ts
```

- [ ] **执行构建**

```bash
npm run build
```

Expected: `dist/` 目录生成，控制台无 TypeScript 错误，bundle 大小提示正常（主包 <150KB）。

- [ ] **本地预览确认**

```bash
npm run preview
```

打开 http://localhost:4173，重复 Task 13 的手动检查项，额外检查：
- [ ] 移动端 375px 视口下无横向滚动
- [ ] 底部操作栏不遮挡内容（safe area 正确）
- [ ] 样例按钮正常加载文件

- [ ] **推送到 GitHub**

```bash
git push -u origin main
```

- [ ] **在 Cloudflare Pages 配置（首次手动，后续自动）**

1. 登录 https://dash.cloudflare.com → Pages → Create project → Connect to Git
2. 选仓库 `methol/aigc-checker`
3. Framework preset: None
4. Build command: `npm run build`
5. Build output: `dist`
6. 保存并触发部署

- [ ] **验证线上版本**

部署完成后（约 1-2 分钟），访问 `https://aigc-checker.pages.dev`，确认：
- [ ] 样例图片 AIGC 检出
- [ ] 移动端（Chrome DevTools 模拟 375px）可正常操作

- [ ] **最终 commit（含生成文件）**

```bash
git add public/samples/ && git commit -m "chore: add generated sample files" && git push
```

---

## 自检：Spec 覆盖确认

| Spec 章节 | 对应 Task |
|---|---|
| 图片解析（EXIF/XMP/IPTC/ICC）| Task 6 |
| 音频解析（ID3）| Task 7 |
| 视频解析（moov）| Task 8 |
| PDF 解析 | Task 8 |
| DOCX 解析 | Task 8 |
| AIGC 水印统一提取 | Task 5 |
| EXIF 字典 + 非默认高亮 | Task 3 |
| 移动端：竖向行布局 | Task 11（metadata-row）|
| 移动端：safe area | Task 13（header/bar）|
| 移动端：拍照上传 | Task 12（dropzone）|
| 样例文件 + 一键查看 | Task 9 + Task 13 |
| 导出 JSON | Task 4 + Task 13 |
| Cloudflare Pages 部署 | Task 1 + Task 14 |
| Dark OLED 设计系统 | Task 1（Tailwind tokens）|
| AIGC 三态卡片 | Task 10 |
| 折叠面板 | Task 11 |
