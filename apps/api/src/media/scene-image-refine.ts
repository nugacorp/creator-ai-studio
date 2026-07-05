import { withProvider } from '../ai/router.js';
import {
  buildSceneImagePrompt,
  SCENE_IMAGE_REFINE_SYSTEM,
  type SceneImageInput,
} from './scene-image-prompt.js';

/** Resolve the best image prompt: stored > LLM-refined > heuristic draft. */
export async function resolveSceneImagePrompt(
  scene: SceneImageInput,
  index: number,
  episodeTitle?: string,
  options?: { force?: boolean; skipLlmRefine?: boolean },
): Promise<string> {
  if (scene.imagePrompt?.trim() && !options?.force) {
    return scene.imagePrompt.trim();
  }

  const draft = buildSceneImagePrompt(scene, index, episodeTitle);

  if (options?.skipLlmRefine) {
    return draft;
  }

  try {
    const refined = await withProvider('chat', p =>
      p.chat([
        { role: 'system', content: SCENE_IMAGE_REFINE_SYSTEM },
        {
          role: 'user',
          content: [
            `Episode: ${episodeTitle ?? 'Biblical reflection'}`,
            `Scene number: ${index + 1}`,
            `Visual note (Spanish): ${scene.visualNote ?? '(none)'}`,
            `Storyboard text (Spanish): ${scene.text.slice(0, 300)}`,
            `Narration theme only (do NOT quote): ${(scene.voiceoverPrompt ?? '').slice(0, 200)}`,
            `Draft prompt to improve: ${draft}`,
          ].join('\n'),
        },
      ]),
    );

    const cleaned = refined
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .replace(/^(prompt|image prompt):\s*/i, '');

    if (cleaned.length >= 40 && !/hola a todos|bienvenidos/i.test(cleaned)) {
      return cleaned;
    }
  } catch {
    // Fall back to heuristic prompt when chat provider unavailable.
  }

  return draft;
}
