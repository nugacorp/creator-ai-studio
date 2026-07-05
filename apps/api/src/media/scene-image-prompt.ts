/** Build an English image prompt (Imagen/DALL-E) from a Spanish storyboard scene. */
export function buildSceneImagePrompt(
  scene: { text: string; voiceoverPrompt?: string },
  index: number,
  episodeTitle?: string,
): string {
  const [visualPart, ...rest] = scene.text.split(' — ');
  const visual = (visualPart ?? scene.text).trim();
  const narration = (scene.voiceoverPrompt || rest.join(' — ')).trim();

  return [
    `Cinematic biblical YouTube b-roll still, scene ${index + 1}`,
    episodeTitle ? `for video "${episodeTitle.slice(0, 80)}"` : '',
    `Visual: ${visual.slice(0, 200)}.`,
    narration ? `Mood: ${narration.slice(0, 150)}.` : '',
    'Photorealistic, reverent atmosphere, dramatic natural light, no text, no logos, widescreen 16:9.',
    `Distinct composition variant ${index + 1}.`,
  ]
    .filter(Boolean)
    .join(' ');
}
