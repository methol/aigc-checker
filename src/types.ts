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
