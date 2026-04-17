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

export function parseProducerCode(code: string): {
  format: string
  entityType: string
  creditCode: string
  serviceCode: string
} {
  return {
    format: code.slice(0, 2),
    entityType: code[2] === '1' ? '组织' : code[2] === '2' ? '个人' : (code[2] ?? '未知'),
    creditCode: code.slice(4, 22),
    serviceCode: code.slice(22) || '—',
  }
}
