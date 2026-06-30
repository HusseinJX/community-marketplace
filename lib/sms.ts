// SMS sending — proxied to the Community Connector Agent's Twilio function
// (same pattern as the Uber delivery notifications). No-ops if unconfigured.
export async function sendSms(to: string, message: string): Promise<boolean> {
  const connectorUrl = process.env.CONNECTOR_URL
  const token = process.env.CONNECTOR_ADMIN_TOKEN || process.env.ADMIN_TOKEN
  if (!connectorUrl || !token || !to) return false
  try {
    const res = await fetch(`${connectorUrl}/.netlify/functions/sms-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, message }),
    })
    return res.ok
  } catch (e) {
    console.error('sendSms failed:', e)
    return false
  }
}

// Best-effort fan-out; returns the count actually accepted by the connector.
export async function sendSmsBatch(recipients: string[], message: string): Promise<number> {
  const results = await Promise.all(recipients.filter(Boolean).map((to) => sendSms(to, message)))
  return results.filter(Boolean).length
}
