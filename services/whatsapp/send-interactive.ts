import 'server-only'

import type { WhatsAppButton, WhatsAppSendResult } from './send-message'

export async function sendWhatsAppInteractiveMessage(to: string, body: string, buttons: WhatsAppButton[]): Promise<WhatsAppSendResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!accessToken || !phoneNumberId) return { ok: false, reason: 'not_configured' }

  try {
    const response = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_API_VERSION || 'v22.0'}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: { buttons: buttons.slice(0, 3).map((button) => ({ type: 'reply', reply: button })) },
        },
      }),
      cache: 'no-store',
    })
    const result = await response.json().catch(() => null) as { messages?: Array<{ id?: string }> } | null
    if (!response.ok) return { ok: false, reason: 'api_error' }
    return { ok: true, messageId: result?.messages?.[0]?.id }
  } catch {
    return { ok: false, reason: 'api_error' }
  }
}
