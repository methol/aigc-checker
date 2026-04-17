# AIGC Checker — 设计文档

**日期**: 2026-04-17（v2 更新：扩展媒体类型 + 移动端适配）
**状态**: 待实现  
**目标**: 纯静态客户端网页，部署 Cloudflare Pages，检测图片/视频/音频/PDF 等文件中的 AIGC 隐水印，并展示元数据；全平台（桌面+移动）可用

---

## 1. 产品定位与约束

**核心功能**：
1. 上传多媒体文件 → 检测并展示 AIGC 隐水印（GB 45438-2025）
2. 展示完整元数据（EXIF/XMP/IPTC/ICC/ID3/moov/PDF Info），关键字段附中文说明，非默认值高亮
3. 移动端手机上传拍照、查看结果同等流畅

**硬性约束**：
- 全部处理在浏览器客户端完成，文件不离开本地（首页常驻提示）
- 产出物为纯静态文件（HTML/CSS/JS），无服务端依赖
- 部署到 Cloudflare Pages（静态托管，无 Workers runtime）
- 移动端优先：375px 视口完整可用，触控友好

**不在范围内**：
- 用户账户/认证
- 服务端 AIGC 检测 API
- 文件永久存储
- 多文件批量比对（v2）
- URL 直接加载远程文件（破坏零上传承诺）
- 虚拟场景类文件（无主流厂商实现）
- 频域信号级水印解码（需服务端，仅提示"需服务端验证"）

---

## 2. 支持的媒体类型（v1）

基于 GB 45438-2025 和阿里云/火山方舟实际实现的调研：

| 媒体类型 | 支持格式 | AIGC 水印位置 | 解析库 | 浏览器可行性 |
|---|---|---|---|---|
| **图片** | JPEG / PNG / WebP / HEIC / AVIF | XMP 命名空间 `http://www.tc260.org.cn/ns/AIGC/1.0/` + `XmpKvBase64` | `exifr` | ✅ 完全 |
| **视频** | MP4 / MOV / WebM | moov box XMP 元数据 | `mediainfo.js`（WASM，懒加载） | ✅ 可行（+~2MB）|
| **音频** | MP3 / FLAC / OGG / M4A | **ID3 标签**（非频域，纯元数据） | `music-metadata-browser`（轻量）| ✅ 完全 |
| **PDF** | PDF | 文档信息字典 `/AIGC` 自定义键 | `pdf.js`（懒加载） | ✅ 可行 |
| **DOCX** | DOCX / XLSX / PPTX | Office Open XML 自定义属性 `customXml` | 手写 ZIP 解压 + XML 解析 | ✅ 较可行 |

**AIGC 字段结构统一**：所有媒体类型使用同一套 7 个字段（Label、ContentProducer、ProduceID、ReservedCode1、ContentPropagator、PropagateID、ReservedCode2），区别仅在存储位置：
- 图片：XMP 命名空间直写 or `XmpKvBase64` base64 JSON（火山方舟格式）
- 视频/音频：`AIGC=` 前缀（与图片前缀不同）
- PDF：`/AIGC` 自定义信息字典键

---

## 3. 技术栈

| 层 | 选型 | 版本/备注 |
|---|---|---|
| 构建工具 | Vite | 5.x，产出纯静态 |
| 语言 | TypeScript | 严格模式 |
| UI | Tailwind CSS 3.x | 不用 React/Vue，原生 Custom Elements |
| 图片元数据 | `exifr` | EXIF/XMP/IPTC/ICC/JFIF/MakerNote；浏览器端 |
| JPEG 底层 | 自写 APP marker 扫描 | 抓 APP11 JUMBF / XmpKvBase64 原文 |
| 音频元数据 | `music-metadata-browser` | 读 ID3v2/ID3v1/Vorbis Comment；轻量（~60KB）|
| 视频元数据 | `mediainfo.js`（WASM） | Web Worker 中运行，懒加载 |
| PDF 元数据 | `pdf.js`（`pdfjs-dist`） | 仅读文档信息字典，懒加载 |
| DOCX 元数据 | 手写 ZIP → XML 解析 | `fflate`（解压）+ DOMParser |
| C2PA（可选） | `@contentauth/c2pa` | Content Credentials，按需引入 |
| 图标 | Lucide SVG（按需） | 严禁 emoji 当图标 |
| 部署 | Cloudflare Pages | `pnpm build` → `dist/` |

**包体策略**：
- 首屏核心：Tailwind + 上传逻辑 + exifr + music-metadata-browser → 目标 < 150KB gzip
- 视频/PDF 解析库懒加载（用户上传对应类型时才动态 import）

---

## 4. 视觉设计系统

### 调色板（Dark OLED Only）

| 角色 | 色值 | 用途 |
|---|---|---|
| 背景 | `#0A0E1A` | 页面底色 |
| 卡片 | `#141B2D` | 分组面板背景 |
| 次级面 | `#1E293B` | 行交替 / 输入框 |
| 边框 | `rgba(148,163,184,.15)` | 卡片 1px 描边 |
| 主文字 | `#F8FAFC` | 正文 |
| 次文字 | `#94A3B8` | 字段名、说明 |
| 弱文字 | `#64748B` | 默认值提示 |
| 强调-青 | `#22D3EE` | AIGC 检出辉光、标题点缀 |
| 强调-绿 | `#22C55E` | CTA 按钮 |
| 警告-琥珀 | `#F59E0B` | 非默认值徽章 `[!]` |
| 错误-红 | `#EF4444` | 解析失败 / 完整性校验异常 |

### 字体

- 正文/UI：**Inter** 300/400/500/600/700（Google Fonts）
- 数值/哈希：**JetBrains Mono** 400/500（tabular-nums，等宽对齐）

### 间距律

`4 / 8 / 12 / 16 / 24 / 32 / 48 px`（4pt 基准）

### 动效规范

| 场景 | 时长 | 缓动 |
|---|---|---|
| 微交互（hover/tap） | 150ms | ease-out |
| 折叠面板展开/收起 | 220ms | ease-out |
| 文件进场 / 扫描线 loading | 800ms | linear loop |
| 页面元素进场 | 180ms | ease-out |
| `prefers-reduced-motion` | 退化为无动画 |

### AIGC 卡片三态

- **已检出**：青色辉光 `box-shadow: 0 0 0 1px rgba(34,211,238,.4), 0 0 24px rgba(34,211,238,.08)` + `AIGC 检出` 青色徽章
- **未检出**：灰色描边 + `未发现 AIGC 标识` + 说明查找了哪些位置
- **部分字段**：琥珀色描边 + `标识不完整` + 列出缺失字段

---

## 5. 页面结构 & 响应式布局

### 5.1 断点体系（Mobile First）

| 断点 | 宽度 | 布局变化 |
|---|---|---|
| `xs`（默认） | 375px | 单列全宽，所有面板堆叠 |
| `sm` | 640px | 单列，预览+AIGC 卡横排（各占 50%）|
| `md` | 768px | 同 sm，间距略增 |
| `lg` | 1024px | 单列（内容 max-w-3xl 居中）|
| `xl` | 1440px | 单列（max-w-4xl），左右留白更舒展 |

### 5.2 Header（固定顶部）

```
移动端（375px）:
┌──────────────────────────────────────┐
│ ◆ AIGC Checker   [🔒 本地] [⋯]      │  ← 44px 高度
└──────────────────────────────────────┘

桌面端（1024px+）:
┌──────────────────────────────────────┐
│ ◆ AIGC Checker   [本地解析·0字节上传]  [GitHub ↗] │
└──────────────────────────────────────┘
```

移动端 Header 右侧折叠为图标菜单（⋯），点击展开浮层显示 GitHub 链接等。

### 5.3 Dropzone（未上传状态）

```
移动端:
┌─────────────────────────────────────┐
│                                     │
│        ↑  点击上传 / 拍照           │
│     （拖拽在桌面端才激活）           │
│                                     │
│  JPG · PNG · HEIC · MP4 · MP3 · PDF │
│                                     │
└─────────────────────────────────────┘
```

- 移动端：点击触发 `<input type="file" capture>`，支持拍照直传
- 桌面端：叠加拖拽支持
- Dropzone 高度：移动端 `40vh`，桌面端 `50vh`，`min-h-dvh` 安全

### 5.4 结果视图

**移动端（< 640px）：上下堆叠**

```
┌─────────────────────────────────────┐
│  [缩略图 120×120]  文件名           │
│                    2.3 MB · JPEG    │
├─────────────────────────────────────┤
│  AIGC 隐水印检测  [已检出]          │
│  Label           1 · AI 生成        │
│  生成服务提供方   字节跳动           │
│  生成内容编号     123456            │
│  ...（可展开更多字段）               │
└─────────────────────────────────────┘
```

**桌面端（≥ 640px）：左右并排**

```
┌─────────────┐  ┌──────────────────────────────────┐
│  预览 240px  │  │  AIGC 隐水印检测  [已检出]        │
│             │  │  Label            1 · AI 生成     │
│  文件名     │  │  生成服务提供方    字节跳动 (...)  │
│  2.3 MB     │  │  ...                              │
│  image/jpeg │  └──────────────────────────────────┘
└─────────────┘
```

### 5.5 元数据折叠面板

展示顺序（按媒体类型动态调整）：

**图片**：AIGC 水印 → 相机信息 → 拍摄参数 → GPS → XMP → IPTC → ICC → C2PA → JPEG Markers  
**视频**：AIGC 水印 → 视频流信息 → 音频流信息 → 容器元数据 → GPS（如有）  
**音频**：AIGC 水印 → 基本信息 → ID3 标签 → 封面图 EXIF（如有）  
**PDF**：AIGC 水印 → 文档信息字典 → XMP 元数据  
**DOCX**：AIGC 水印 → 核心属性 → 自定义属性

**每行格式**：`字段名 | 值（JetBrains Mono） | 中文释义`

移动端行布局调整：
- 字段名和中文释义上下排列（竖向三行）：`字段名`/`值`/`释义`
- 避免三列在小屏横向挤压

非默认值：左侧 2px 琥珀竖条 + `[!]` 图标；长按（移动端）/ hover（桌面端）显示"默认值：X"

### 5.6 底部操作栏

移动端固定底部 safe area 之上（`padding-bottom: env(safe-area-inset-bottom)`）：

```
移动端: [重新选择]  [导出 JSON]
桌面端: [重新选择]  [导出 JSON]  [复制全部字段]
```

---

## 6. AIGC 隐水印解析

### 6.1 查找路径（按媒体类型）

**图片（JPEG/PNG/WebP/HEIC）**：
1. XMP 中命名空间 `http://www.tc260.org.cn/ns/AIGC/1.0/` 下的 AIGC 节点（国标直写）
2. XMP 中的 `XmpKvBase64` 键 → base64 解码 → JSON（火山方舟格式）
3. APP11 JUMBF C2PA manifest（Content Credentials）

**视频（MP4/MOV）**：
1. moov/meta XMP 中同上两条路径
2. `AIGC=` 前缀的 ffmpeg 自定义 metadata 键

**音频（MP3）**：
1. ID3v2 `TXXX:AIGC` 帧 → JSON 解析
2. ID3v2 `TXXX:XmpKvBase64` 帧 → base64 → JSON

**PDF**：
1. 文档信息字典中的 `/AIGC` 自定义键 → JSON
2. 嵌入 XMP 流中的 AIGC 命名空间节点

**DOCX**：
1. `docProps/custom.xml` 中的 AIGC 自定义属性

### 6.2 字段映射表

| 原始键 | 中文名 | 类型 | 枚举/说明 |
|---|---|---|---|
| `Label` | 生成合成标签 | int | 1=AI生成 2=可能AI生成 3=疑似AI生成 |
| `ContentProducer` | 生成服务提供方 | 22位编码 | 拆分：格式+类型+信用代码+服务码 |
| `ProduceID` | 生成内容编号 | string | 生成方内部 ID |
| `ReservedCode1` | 生成方完整性校验 | hash | MD5/SHA 摘要 |
| `ContentPropagator` | 传播服务提供方 | 22位编码 | 同上 |
| `PropagateID` | 传播内容编号 | string | 传播方内部 ID |
| `ReservedCode2` | 传播方完整性校验 | hash | MD5/SHA 摘要 |

### 6.3 ContentProducer 22 位拆解展示

```
00  1  1  91330106MA2C****  Y43
└┬┘ ┬  ┬  └──────┬──────┘  └┬┘
格式 类型 绑定  统一社会信用代码  服务码
     1=组织
     2=个人
```

已知厂商代码字典（`producer-codes.ts`），匹配时显示厂商名（字节跳动/阿里/腾讯等）。

---

## 7. EXIF 元数据展示规则

### 非默认值判定字典（节选）

| 字段 | 默认值 | 非默认含义 |
|---|---|---|
| Orientation | 1（正常） | 图像被旋转或翻转 |
| ResolutionUnit | 2（英寸） | 使用厘米或无单位 |
| ColorSpace | 1（sRGB） | 非标准色彩空间 |
| WhiteBalance | 0（自动） | 手动白平衡已设置 |
| ExposureMode | 0（自动） | 手动曝光模式 |
| Flash | bit0=0（未闪光） | 闪光灯已触发 |
| Software | 空 | **任何值均高亮**（泄露处理工具/AI 工具） |
| GPS 坐标 | 不存在 | **存在即高亮**（隐私敏感，提示） |
| ImageDescription | 空 | 存在即高亮（可能含 AI prompt） |
| MakerNote | — | 存在即展开厂商私有段 |

完整字典见 `src/dict/exif-defaults.ts` 和 `src/dict/exif-cn.ts`。

---

## 8. 移动端专项设计规则

### 8.1 触控与交互

- 所有可点击元素 touch target ≥ 44×44px（折叠面板标题行、复制按钮等均需保证）
- 相邻 touch 目标间距 ≥ 8px
- 折叠面板标题行高度 ≥ 48px，整行可点击
- 底部操作按钮：高度 48px，足够的水平 padding

### 8.2 输入与上传

- `<input type="file" accept="...">` 同时指定 MIME 和扩展名，iOS/Android 均可识别
- 在移动端额外暴露 `capture` 选项（可选拍照）——通过一个"拍照上传"的次要按钮触发 `accept="image/*" capture="environment"`
- 文件大小提示：> 50MB 弹出警告"大文件解析可能较慢，建议在 WiFi 下操作"

### 8.3 布局安全区

- 底部操作栏：`padding-bottom: env(safe-area-inset-bottom)` + 额外 8px
- Header 固定：内容区 `padding-top` = Header 高度 + 安全区（如有刘海）
- 元数据行不得出现横向滚动；长 hash 值截断 + "复制"按钮，不允许撑宽

### 8.4 字体与可读性

- 最小正文字号 16px（iOS 浏览器 < 16px 会自动缩放导致页面抖动）
- 字段值（JetBrains Mono）最小 13px，超长值截断尾部
- 行间距 ≥ 1.5，移动端段落不贴边（左右 padding ≥ 16px）

### 8.5 性能

- 媒体预览图：图片使用 `createObjectURL` + `<img loading="lazy">`，最大显示 240×240（`object-fit: contain`），不全量解码原图
- 视频预览：仅截取封面帧（`<video>` seek to 0 + `canvas.drawImage`），不全量播放
- 大型 WASM 库（mediainfo.js、pdf.js）延迟到用户上传对应类型时才动态 import，避免阻塞首屏

---

## 9. 项目文件结构

```
aigc-checker/
├── index.html
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── _headers                         # CF Pages COOP/COEP
├── _redirects                       # SPA fallback
├── public/
│   └── favicon.svg
└── src/
    ├── main.ts
    ├── styles.css
    ├── components/
    │   ├── dropzone.ts              # 拖拽+点击+拍照上传
    │   ├── preview.ts               # 图片/视频封面/音频波形占位/PDF首页
    │   ├── aigc-card.ts             # AIGC 检测结果卡（三态）
    │   ├── metadata-group.ts        # 折叠分组面板
    │   ├── metadata-row.ts          # 单行（桌面3列/移动端竖向）
    │   └── scan-line.ts             # 扫描 loading 动效
    ├── parsers/
    │   ├── image.ts                 # exifr + APP marker 扫描
    │   ├── video.ts                 # mediainfo.js worker 包装
    │   ├── audio.ts                 # music-metadata-browser
    │   ├── pdf.ts                   # pdf.js 文档信息字典
    │   ├── docx.ts                  # fflate + DOMParser
    │   ├── aigc.ts                  # 统一 AIGC 字段提取（各格式路径）
    │   └── markers.ts               # JPEG APP0-15 专家模式
    ├── dict/
    │   ├── exif-cn.ts               # EXIF 字段中文名
    │   ├── exif-defaults.ts         # 默认值 + 非默认释义
    │   ├── aigc-cn.ts               # GB 45438 字段映射
    │   └── producer-codes.ts        # 已知生产方编码白名单
    └── lib/
        ├── format.ts                # 字节/GPS/时间格式化
        └── export.ts                # JSON 导出
```

---

## 10. Cloudflare Pages 部署

**Build command**: `pnpm build`  
**Output directory**: `dist`

**`_headers`**（WASM SharedArrayBuffer 需要 COOP/COEP）：
```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
```

**`_redirects`**：
```
/* /index.html 200
```

---

## 11. 可访问性检查清单

- [ ] 所有 touch target ≥ 44×44px，间距 ≥ 8px
- [ ] 颜色之外加图标传达信息（非默认 `[!]` 图标 + 琥珀竖条）
- [ ] 折叠面板键盘可达（Tab/Space/Enter），`aria-expanded` 正确
- [ ] 主文字对比度 ≥ 4.5:1（#F8FAFC on #141B2D ≈ 14:1 ✓）
- [ ] `prefers-reduced-motion` 退化为无动画
- [ ] 图片预览 alt text 使用文件名
- [ ] 哈希/长值：truncate + 复制按钮，不丢信息
- [ ] 移动端 375px 无横向滚动
- [ ] 底部安全区 `env(safe-area-inset-bottom)` 正确
- [ ] 最小字号 ≥ 16px（正文），≥ 13px（等宽数据）
- [ ] iOS/Android 文件选择及拍照功能正常
- [ ] WASM 懒加载期间显示 loading 状态，不阻塞 UI

---

## 12. 未来版本（不在 v1 范围）

- 双文件对比模式（EXIF diff）
- 已知生产方代码联网更新
- URL 参数加载（破坏零上传承诺，暂不做）
- 频域信号级数字水印解码（需服务端 API）
- TXT/HTML 隐式标识（国标实践指南仍在征求意见）
- 批量文件处理
