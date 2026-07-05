import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Duration in seconds from ffprobe (0 if unreadable). */
export async function probeMediaDurationSeconds(filePath: string): Promise<number> {
  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'format=duration',
        '-of',
        'default=noprint_wrappers=1:nokey=1',
        filePath,
      ],
      { timeout: 30_000 },
    );
    const value = parseFloat(stdout.trim());
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

/** Evenly distribute slide time so total video length matches narration. */
export function computeSlideDurationSeconds(
  audioDurationSeconds: number,
  slideCount: number,
  fallbackPerSlide = 8,
): number {
  if (slideCount <= 0) return fallbackPerSlide;
  if (audioDurationSeconds <= 0) return fallbackPerSlide;
  const perSlide = audioDurationSeconds / slideCount;
  const maxPerSlide = slideCount === 1 ? Math.max(600, audioDurationSeconds) : 120;
  return Math.max(3, Math.min(maxPerSlide, perSlide));
}
