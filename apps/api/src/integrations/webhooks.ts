import { getSecret } from '../secrets/resolver.js';

type WebhookEvent = 'job.completed' | 'job.failed' | 'episode.published';

export async function dispatchWebhook(
  event: WebhookEvent,
  payload: Record<string, unknown>,
): Promise<void> {
  const url = await getSecret('WEBHOOK_URL');
  if (!url) return;

  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
    });
  } catch {
    // Webhook failures should not block the main flow
  }
}
