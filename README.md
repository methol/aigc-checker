# AIGC Checker

纯静态 AIGC 隐水印 + 元数据查看器，支持 GB 45438-2025 标准水印检测，部署于 Cloudflare Pages。

## 功能

- **AIGC 水印检测**：解析 GB 45438-2025 标准定义的隐水印字段（Label、ContentProducer、ProduceID 等）
- **多格式支持**：图片（JPEG/PNG/WebP）、音频（MP3/FLAC/OGG）、视频（MP4/MOV）、PDF、DOCX
- **元数据浏览**：展示 EXIF / XMP / IPTC / ICC / ID3 / moov / PDF Info 等全量元数据，中文标签，非默认值高亮
- **内容生产者解析**：将 22 位统一信用代码拆解为主体类型、信用代码、业务码，并查找已知机构名称
- **一键样例**：内置 JPEG / MP3 / PDF 样例文件，可直接体验
- **纯客户端**：文件不上传服务器，完全本地解析

## 技术栈

- Vite 5 + TypeScript（strict）
- Tailwind CSS 3（暗色 OLED 风格）
- exifr（图片元数据）
- music-metadata-browser（音频 ID3）
- mediainfo.js WASM（视频 moov）
- pdfjs-dist CDN worker（PDF 解析）
- fflate（DOCX 解压）
- Cloudflare Pages（静态托管）

## 本地开发

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build   # 生成样例文件 → TypeScript 类型检查 → Vite 打包
```

## 测试

```bash
npm test        # vitest，40 个单元测试
```

## 部署（Cloudflare Pages）

在 Cloudflare Dashboard → Pages → 连接 GitHub 仓库，配置：

| 项目 | 值 |
|------|-----|
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node.js 版本 | `20` |

## 水印规范

本工具基于 [GB 45438-2025《网络信息内容生成服务提供者履行信息内容管理主体责任规范》](https://www.tc260.org.cn/) 附录 B 定义的 AIGC 隐水印格式，以及火山方舟 `XmpKvBase64` 扩展字段实现。

| 字段 | 含义 |
|------|------|
| Label | 1=AI生成 / 2=可能AI生成 / 3=疑似AI生成 |
| ContentProducer | 22 位内容生产者代码（统一信用代码格式） |
| ProduceID | 内容唯一生产标识 |
| ContentPropagator | 内容传播者代码 |
| PropagateID | 传播标识 |
| ReservedCode1/2 | 保留字段 |

各格式嵌入位置：

| 格式 | 位置 |
|------|------|
| JPEG/PNG/WebP | XMP（AIGC 命名空间或 XmpKvBase64） |
| MP4/MOV | moov → XMP |
| MP3/FLAC | ID3v2 TXXX 帧 |
| PDF | Info 字典 `/AIGC` 键 |
| DOCX | 自定义文档属性 |
