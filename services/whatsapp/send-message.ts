import 'server-only'

const GRAPH_API_VERSION = 'v22.0'

export type WhatsAppSendResult =
  | { ok: true; messageId?: string }
  | { ok: false; reason: 'not_configured' | 'api_error' }

export type WhatsAppButton = { id: string; title: string }

export async function sendWhatsAppTextMessage(to: string, text: string): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!accessToken || !phoneNumberId) return { ok: false, reason: 'not_configured' }

  try {
    const response = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: text },
      }),
      cache: 'no-store',
    })

    const result = await response.json().catch(() => null) as {
      messages?: Array<{ id?: string }>
      error?: { code?: number; type?: string; message?: string; fbtrace_id?: string }
    } | null

    if (!response.ok) {
      console.error('[v0] WhatsApp Graph API response', {
        status: response.status,
        errorCode: result?.error?.code,
        errorType: result?.error?.type,
        errorMessage: result?.error?.message,
        fbtraceId: result?.error?.fbtrace_id,
      })
      return { ok: false, reason: 'api_error' }
    }

    const messageId = result?.messages?.[0]?.id
    console.info('[v0] WhatsApp Graph API success', { status: response.status, messageId })
    return { ok: true, messageId }
  } catch (error) {
    console.error('[v0] WhatsApp Graph API request failed', {
      errorType: error instanceof Error ? error.name : 'unknown',
      errorMessage: error instanceof Error ? error.message : 'unknown',
    })
    return { ok: false, reason: 'api_error' }
  }
}
