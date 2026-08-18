import 'server-only'

import { GoogleGenAI } from '@google/genai'

const MAX_MEDIA_BYTES = 10 * 1024 * 1024
const MEDIA_TIMEOUT_MS = 20_000
const MEDIA_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash'

type MediaKind = 'audio' | 'image' | 'document'

type MediaInput = {
  kind: MediaKind
  mediaId: string
  mimeType?: string
  fileName?: string
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
  const value = mimeType?.toLowerCase().split(';')[0].trim()
  if (kind === 'audio' && ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/webm'].includes(value ?? '')) return value
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

async function downloadMetaMedia(mediaId: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN
  const version = process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'
  if (!token || !/^[A-Za-z0-9:_-]{8,}$/.test(mediaId)) return null
  const headers = { Authorization: `Bearer ${token}` }
  const startedAt = Date.now()
  const metadataResponse = await fetchWithTimeout(`https://graph.facebook.com/${version}/${encodeURIComponent(mediaId)}`, { headers })
  if (!metadataResponse.ok) return null
  const metadata = await metadataResponse.json() as { url?: string; mime_type?: string; file_size?: number }
  if (!metadata.url || (metadata.file_size && metadata.file_size > MAX_MEDIA_BYTES)) return null
  const mediaResponse = await fetchWithTimeout(metadata.url, { headers })
  if (!mediaResponse.ok) return null
  const contentLength = Number(mediaResponse.headers.get('content-length') || 0)
  if (contentLength > MAX_MEDIA_BYTES) return null
  const bytes = new Uint8Array(await mediaResponse.arrayBuffer())
  if (bytes.byteLength > MAX_MEDIA_BYTES) return null
  console.info(`[WA MEDIA] download_ms=${Date.now() - startedAt}`)
  return { bytes, mimeType: metadata.mime_type || mediaResponse.headers.get('content-type') || 'application/octet-stream' }
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
  const mimeType = safeMimeType(input.kind, input.mimeType)
  if (!mimeType) return null
  const media = await downloadMetaMedia(input.mediaId)
  if (!media) return null
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  const startedAt = Date.now()
  const ai = new GoogleGenAI({ apiKey })
  const prompt = input.kind === 'audio'
    ? 'Transcreva somente o áudio em português brasileiro. Retorne JSON válido: {"text":"...","confidence":0.0,"ambiguous":false}. Não invente palavras.'
    : 'Extraia somente dados financeiros visíveis deste recibo/documento. Retorne JSON válido com merchant, amount (total final, nunca subtotal/troco/CPF), date YYYY-MM-DD, currency, suggestedCategory, confidence de 0 a 1 e ambiguous boolean. Se faltar ou houver conflito, marque ambiguous=true e não invente.'
  try {
    const response = await ai.models.generateContent({
      model: MEDIA_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType, data: Buffer.from(media.bytes).toString('base64') } }] }] as any,
      config: { temperature: 0, maxOutputTokens: 1000, responseMimeType: 'application/json' },
    })
    const raw = typeof response.text === 'string' ? response.text : ''
    console.info(`[WA MEDIA] transcription_or_vision_ms=${Date.now() - startedAt}`)
    return normalizeExtraction(input.kind, parseJsonObject(raw))
  } catch (error) {
    console.warn('[WA MEDIA] provider_failed', { type: error instanceof Error ? error.name : 'unknown' })
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
