import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import process from 'node:process';

const execFileAsync = promisify(execFile);

export interface PiperResult {
  audioUrl: string;
  isDemo: boolean;
  savedPath?: string;
}

function piperBin(): string {
  return process.env.PIPER_BIN ?? 'piper';
}

function piperModel(): string | undefined {
  return process.env.PIPER_MODEL;
}

export function isPiperAvailable(): boolean {
  const model = piperModel();
  if (!model || !existsSync(model)) return false;
  try {
    return true;
  } catch {
    return false;
  }
}

/** Synthesize speech with Piper (CPU, no GPU). Requires PIPER_BIN + PIPER_MODEL on the server. */
export async function synthesizeWithPiper(
  text: string,
  options?: { saveDir?: string; voiceHint?: string },
): Promise<PiperResult> {
  const model = piperModel();
  if (!model || !existsSync(model)) {
    return { audioUrl: '', isDemo: true };
  }

  const trimmed = text.substring(0, 8000);
  if (!trimmed.trim()) {
    return { audioUrl: '', isDemo: true };
  }

  const outDir = options?.saveDir ?? path.join(process.cwd(), 'tmp-piper');
  await mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, 'narration.wav');

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(piperBin(), ['--model', model, '--output_file', outFile], {
        stdio: ['pipe', 'ignore', 'pipe'],
      });
      child.stdin.write(trimmed);
      child.stdin.end();
      child.on('close', code => (code === 0 ? resolve() : reject(new Error(`piper exit ${code}`))));
      child.on('error', reject);
    });
  } catch {
    return { audioUrl: '', isDemo: true };
  }

  if (!existsSync(outFile)) {
    return { audioUrl: '', isDemo: true };
  }

  if (options?.saveDir) {
    const mp3Path = path.join(options.saveDir, 'narration.mp3');
    try {
      await execFileAsync(
        'ffmpeg',
        ['-y', '-i', outFile, '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3Path],
        { timeout: 60_000 },
      );
      return {
        audioUrl: '/api/episodes/audio/narration.mp3',
        isDemo: false,
        savedPath: mp3Path,
      };
    } catch {
      const dest = path.join(options.saveDir, 'narration.wav');
      const { copyFile } = await import('node:fs/promises');
      await copyFile(outFile, dest);
      return {
        audioUrl: '/api/episodes/audio/narration.wav',
        isDemo: false,
        savedPath: dest,
      };
    }
  }

  const { readFile } = await import('node:fs/promises');
  const b64 = (await readFile(outFile)).toString('base64');
  return { audioUrl: `data:audio/wav;base64,${b64}`, isDemo: false };
}
