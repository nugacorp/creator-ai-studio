import process from 'node:process';

export interface ElevenLabsResult {
  audioUrl: string;
  isDemo: boolean;
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
): Promise<ElevenLabsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voice = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    return {
      audioUrl: '',
      isDemo: true,
    };
  }

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text.substring(0, 5000),
        model_id: 'eleven_multilingual_v2',
      }),
    },
  );

  if (!response.ok) {
    return { audioUrl: '', isDemo: true };
  }

  const buffer = await response.arrayBuffer();
  const b64 = Buffer.from(buffer).toString('base64');
  return { audioUrl: `data:audio/mpeg;base64,${b64}`, isDemo: false };
}
