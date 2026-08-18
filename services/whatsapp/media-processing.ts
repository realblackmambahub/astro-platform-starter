import 'server-only'

import { GoogleGenAI } from '@google/genai'

const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const MEDIA_TIMEOUT_MS = 20_000
const MEDIA_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

type MediaKind = 'audio' | 'image' | 'document'

export function normalizeWhatsAppAudioMime(mimeType?: string) {
  const [base, ...parameters] = (mimeType ?? '').toLowerCase().split(';').map((part) => part.trim()).filter(Boolean)
  const codec = parameters.find((parameter) => parameter.startsWith('codecs='))?.slice('codecs='.length)
  if (!base.startsWith('audio/')) return { mimeType: null, codec: null }
  return { mimeType: ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'].includes(base) ? base : null, codec: codec ?? null }
}

type MediaInput = {
  kind: MediaKind
  mediaId: string
  mimeType?: string
  fileName?: string
  voice?: boolean
}

export type MediaExtraction = {
  kind: MediaKind
  text?: string
  merchant?: string
  amount?: number
  date?: string
  currency?: string
  suggestedCategory?: string
  confidence: number
  ambiguous: boolean
}

function safeMimeType(kind: MediaKind, mimeType?: string) {
  const value = kind === 'audio' ? normalizeWhatsAppAudioMime(mimeType).mimeType : mimeType?.toLowerCase().split(';')[0].trim()
  if (kind === 'audio' && value) return value
  if (kind === 'image' && ['image/jpeg', 'image/png', 'image/webp'].includes(value ?? '')) return value
  if (kind === 'document' && ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(value ?? '')) return value
  return null
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MEDIA_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
  } finally {
    clearTimeout(timeout)
  }
}

async function downloadMetaMedia(mediaId: string, kind: MediaKind) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'
  if (!token || !/^[A-Za-z0-9:_-]{8,}$/.test(mediaId)) {
    console.info(`[WA ${kind.toUpperCase()}] failure_stage=media_lookup`)
    return null
  }
  const headers = { Authorization: `Bearer ${token}` }
  const startedAt = Date.now()
  try {
    const metadataResponse = await fetchWithTimeout(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, { headers })
    if (!metadataResponse.ok) {
      console.info(`[WA ${kind.toUpperCase()}] media_url_resolved=false`)
      console.info(`[WA ${kind.toUpperCase()}] failure_stage=media_lookup`)
      return null
    }
    const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number }
    const normalized = kind === 'audio' ? normalizeWhatsAppAudioMime(metadata.mime_type) : { mimeType: metadata.mime_type?.toLowerCase().split(';')[0].trim() ?? null, codec: null }
    console.info(`[WA ${kind.toUpperCase()}] media_url_resolved=${String(Boolean(metadata.url))}`)
    console.info(`[WA ${kind.toUpperCase()}] mime_type=${normalized.mimeType ?? 'unsupported'}`)
    if (!metadata.url || (metadata.file_size && metadata.file_size > MAX_MEDIA_BYTES)) {
      console.info(`[WA ${kind.toUpperCase()}] failure_stage=unsupported_mime`)
      return null
    }
    const mediaResponse = await fetchWithTimeout(metadata.url, { headers })
    if (!mediaResponse.ok) {
      console.info(`[WA ${kind.toUpperCase()}] download_success=false`)
      console.info(`[WA ${kind.toUpperCase()}] failure_stage=media_download`)
      return null
    }
    const contentLength = Number(mediaResponse.headers.get('content-length') || 0)
    if (contentLength > MAX_MEDIA_BYTES) return null
    const bytes = new Uint8Array(await mediaResponse.arrayBuffer())
    console.info(`[WA ${kind.toUpperCase()}] bytes=${bytes.byteLength}`)
    console.info(`[WA ${kind.toUpperCase()}] download_success=${String(bytes.byteLength > 0)}`)
    console.info(`[WA ${kind.toUpperCase()}] download_ms=${Date.now() - startedAt}`)
    if (!bytes.byteLength || bytes.byteLength > MAX_MEDIA_BYTES) return null
    return { bytes, mimeType: normalized.mimeType || mediaResponse.headers.get('content-type') || 'application/octet-stream' }
  } catch {
    console.info(`[WA ${kind.toUpperCase()}] failure_stage=media_download`)
    return null
  }
}

function parseJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) return null
  try { return JSON.parse(match[0]) as Record<string, unknown> } catch { return null }
}

function normalizeExtraction(kind: MediaKind, value: Record<string, unknown> | null): MediaExtraction {
  const amount = typeof value?.amount === 'number' && Number.isFinite(value.amount) && value.amount > 0 ? Number(value.amount.toFixed(2)) : undefined
  const confidence = typeof value?.confidence === 'number' && Number.isFinite(value.confidence) ? Math.max(0, Math.min(1, value.confidence)) : 0
  const date = typeof value?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date) ? value.date : undefined
  return {
    kind,
    text: typeof value?.text === 'string' ? value.text.trim().slice(0, 2500) : undefined,
    merchant: typeof value?.merchant === 'string' ? value.merchant.trim().slice(0, 120) : undefined,
    amount,
    date,
    currency: typeof value?.currency === 'string' ? value.currency.trim().slice(0, 8) : undefined,
    suggestedCategory: typeof value?.suggestedCategory === 'string' ? value.suggestedCategory.trim().slice(0, 80) : undefined,
    confidence,
    ambiguous: Boolean(value?.ambiguous) || !amount,
  }
}

export async function processWhatsAppMedia(input: MediaInput): Promise<MediaExtraction | null> {
  const inputMimeType = safeMimeType(input.kind, input.mimeType)
  if (!inputMimeType && input.kind !== 'audio') {
    console.info(`[WA ${input.kind.toUpperCase()}] failure_stage=unsupported_mime`)
    return null
  }
  if (input.kind === 'audio') {
    console.info(`[WA AUDIO] mime_type=${inputMimeType ?? 'meta_lookup_pending'}`)
    console.info(`[WA AUDIO] voice=${String(input.voice ?? false)}`)
  }
  console.info(`[WA ${input.kind.toUpperCase()}] received=true`)
  const media = await downloadMetaMedia(input.mediaId, input.kind)
  if (!media) return null
  const mimeType = safeMimeType(input.kind, media.mimeType)
  if (!mimeType) {
    console.info(`[WA ${input.kind.toUpperCase()}] failure_stage=unsupported_mime`)
    return null
  }
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const startedAt = Date.now()
  const ai = new GoogleGenAI({ apiKey })
  const prompt = input.kind === 'audio'
    ? 'Transcreva fielmente a fala deste áudio em português do Brasil. Retorne somente o texto falado. Não explique, não resuma e não invente palavras ou valores.'
    : 'Extraia somente dados financeiros visíveis deste recibo/documento. Retorne JSON válido com merchant, amount (total final, nunca subtotal/troco/CPF), date YYYY-MM-DD, currency, suggestedCategory, confidence de 0 a 1 e ambiguous boolean. Se faltar ou houver conflito, marque ambiguous=true e não invente.'
  try {
    const response = await ai.models.generateContent({
      model: MEDIA_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: Buffer.from(media.bytes).toString('base64') } }] }] as any,
      config: { temperature: 0, maxOutputTokens: input.kind === 'audio' ? 500 : 1000, ...(input.kind === 'audio' ? {} : { responseMimeType: 'application/json' }) },
    })
    const raw = typeof response.text === 'string' ? response.text.trim() : ''
    console.info(`[WA ${input.kind.toUpperCase()}] transcription_ms=${Date.now() - startedAt}`)
    if (!raw) {
      console.info(`[WA ${input.kind.toUpperCase()}] failure_stage=transcription`)
      return null
    }
    if (input.kind === 'audio') return normalizeExtraction('audio', { text: raw, confidence: 1, ambiguous: false })
    return normalizeExtraction(input.kind, parseJsonObject(raw))
  } catch (error) {
    console.warn(`[WA ${input.kind.toUpperCase()}] failure_stage=transcription`, { type: error instanceof Error ? error.name : 'unknown' })
    return null
  }
}

export function mediaExtractionToText(extraction: MediaExtraction) {
  if (extraction.kind === 'audio') return extraction.text ?? ''
  if (!extraction.merchant || extraction.amount === undefined || extraction.ambiguous || extraction.confidence < 0.78) return ''
  return `gastei ${extraction.amount.toString().replace('.', ',')} reais em ${extraction.merchant}${extraction.date ? ` no dia ${extraction.date}` : ''}`
}

export function isSupportedMedia(kind: string, mimeType?: string) {
  return Boolean(safeMimeType(kind as MediaKind, mimeType))
}
export type { MediaInput }
