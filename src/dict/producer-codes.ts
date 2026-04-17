const KNOWN_PRODUCERS: Record<string, string> = {
  '91110000802100433B': '字节跳动有限公司',
  '91330106MA2C': '阿里巴巴（中国）有限公司',
  '91440300708461136T': '腾讯科技（深圳）有限公司',
  '91110108551385082J': '百度在线网络技术（北京）有限公司',
  '91310115MA1K': '上海人工智能实验室',
}

export function lookupProducer(creditCode: string): string | undefined {
  for (const [prefix, name] of Object.entries(KNOWN_PRODUCERS)) {
    if (creditCode.startsWith(prefix)) return name
  }
  return undefined
}
