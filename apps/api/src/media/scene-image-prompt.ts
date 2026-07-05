export interface SceneImageInput {
  text: string;
  voiceoverPrompt?: string;
  visualNote?: string;
  imagePrompt?: string;
}

/** System prompt for LLM refinement — world-class cinematographer for biblical b-roll. */
export const SCENE_IMAGE_REFINE_SYSTEM = `You are an award-winning cinematographer and art director specializing in photorealistic biblical documentary b-roll for YouTube.

Your ONLY job: convert a Spanish storyboard scene into ONE English image-generation prompt (50–90 words).

RULES (strict):
- Output ONLY the prompt text. No JSON, no quotes, no preamble.
- Describe ONE frozen cinematic still frame: subject, environment, lighting, camera angle, mood.
- NEVER include spoken narration, dialogue, welcome messages, or quotes from the script.
- NEVER include music, audio, fade, transition, narrator, or production instructions.
- NEVER include text overlays, logos, watermarks, or readable words in the image.
- Use concrete visual nouns (forest, ocean, starfield, hands in prayer) — not meta phrases like "images of nature".
- Photorealistic, reverent, dramatic natural light, widescreen 16:9 composition.
- Each scene must look visually DISTINCT (different location, angle, or time of day).
- If the visual direction is vague, infer a specific biblical/nature shot that matches the narration theme — without copying the narration text.`;

const META_NOISE =
  /\b(música|musica|de fondo|fade|dissolve|transición|transicion|corte|sonido|audio|efectos?\s+sonoros?|narrador|overlay|subtítulos?|b-?roll|planos?|tomás?|imágenes?\s+(de|del|de la|sobre)|videos?\s+(de|del|de la|sobre))\b/gi;

const GREETING_NOISE =
  /\b(hola a todos|bienvenidos|nuestro canal|hoy nos adentraremos|en este video|suscríbete|like y suscr)/gi;

/** Spanish theme keywords → concrete English cinematography. */
const THEME_SHOTS: Array<{ match: RegExp; shot: string }> = [
  {
    match: /naturaleza|bosque|árboles?|pradera|campo verde/i,
    shot:
      'lush ancient forest at golden hour, sun rays piercing through tall trees, morning mist over green valley, cinematic wide establishing shot',
  },
  {
    match: /noche estrellada|estrellas|cielo nocturno|cosmos/i,
    shot:
      'vast star-filled night sky over silent desert landscape, Milky Way visible, deep blue tones, awe-inspiring cosmic scale, low horizon composition',
  },
  {
    match: /océano|mar|olas|playa|aguas/i,
    shot:
      'expansive ocean at dawn, gentle waves catching orange light, distant horizon, aerial wide shot of pristine waters',
  },
  {
    match: /montaña|montañas|cerro|valle/i,
    shot:
      'majestic mountain range at sunrise, clouds rolling through peaks, dramatic scale, golden light on rock faces',
  },
  {
    match: /creación|creacion|génesis|genesis|inicio|comienzo/i,
    shot:
      'primordial earth and sky separating, light breaking over formless waters, epic biblical creation imagery, cinematic god rays',
  },
  {
    match: /orar|oración|oracion|manos|rezar/i,
    shot:
      'close-up of hands folded in prayer, soft warm side lighting, shallow depth of field, reverent intimate atmosphere',
  },
  {
    match: /comunidad|personas|gente|familia|ayud/i,
    shot:
      'diverse group of people helping each other in warm sunlight, authentic documentary style, hopeful community moment',
  },
  {
    match: /niños|niños|risas|juego/i,
    shot:
      'children playing joyfully in sunlit meadow, soft bokeh background, warm nostalgic documentary tone',
  },
  {
    match: /templo|iglesia|altar|santuario/i,
    shot:
      'interior of ancient stone sanctuary, candlelight and stained-glass glow, reverent atmosphere, wide symmetrical composition',
  },
  {
    match: /desierto|aren|dunas/i,
    shot:
      'vast biblical desert at sunset, long shadows on sand dunes, lone figure silhouette in distance, epic scale',
  },
];

function stripMetaLanguage(text: string): string {
  return text
    .replace(META_NOISE, ' ')
    .replace(GREETING_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchThemeShot(...sources: string[]): string | null {
  const combined = sources.filter(Boolean).join(' ');
  for (const { match, shot } of THEME_SHOTS) {
    if (match.test(combined)) return shot;
  }
  return null;
}

/** Extract visual direction separate from narration. */
export function extractSceneVisualParts(scene: SceneImageInput): {
  visualSpanish: string;
  moodHint: string;
} {
  if (scene.visualNote?.trim()) {
    return {
      visualSpanish: stripMetaLanguage(scene.visualNote),
      moodHint: stripMetaLanguage(scene.voiceoverPrompt ?? '').slice(0, 80),
    };
  }

  const [left, ...rest] = scene.text.split(' — ');
  const right = rest.join(' — ').trim();
  const visualRaw = stripMetaLanguage((left ?? scene.text).trim());
  const narration = stripMetaLanguage(scene.voiceoverPrompt ?? right).trim();

  // If text field is mostly narration (greetings, long prose), don't use it as visual.
  const visualLooksLikeNarration =
    GREETING_NOISE.test(visualRaw) ||
    (visualRaw.length > 120 && !THEME_SHOTS.some(t => t.match.test(visualRaw)));

  const visualSpanish = visualLooksLikeNarration ? '' : visualRaw;
  const moodHint = narration.slice(0, 100);

  return { visualSpanish, moodHint };
}

/** Build an English image prompt from a Spanish storyboard scene (heuristic, no LLM). */
export function buildSceneImagePrompt(
  scene: SceneImageInput,
  index: number,
  episodeTitle?: string,
): string {
  if (scene.imagePrompt?.trim()) {
    return scene.imagePrompt.trim();
  }

  const { visualSpanish, moodHint } = extractSceneVisualParts(scene);
  const themeShot =
    matchThemeShot(visualSpanish, moodHint, episodeTitle ?? '', scene.text) ??
    'contemplative biblical landscape, dramatic natural lighting, cinematic documentary still';

  const concreteVisual =
    visualSpanish.length >= 12 && !GREETING_NOISE.test(visualSpanish)
      ? translateVisualKeywords(visualSpanish)
      : themeShot;

  const mood =
    moodHint && !GREETING_NOISE.test(moodHint)
      ? `Atmosphere inspired by theme: ${translateVisualKeywords(moodHint).slice(0, 60)}`
      : 'Reverent, awe-inspiring mood';

  return [
    'Photorealistic cinematic still frame, 16:9 biblical documentary b-roll',
    episodeTitle ? `Episode theme: ${episodeTitle.slice(0, 60)}` : '',
    `Scene ${index + 1}: ${concreteVisual}`,
    mood,
    'Dramatic natural light, shallow depth of field, no text, no logos, no watermarks',
    `Distinct composition variant ${index + 1} — unique location and framing`,
  ]
    .filter(Boolean)
    .join('. ');
}

/** Light Spanish → English keyword expansion for image models. */
function translateVisualKeywords(spanish: string): string {
  const themed = matchThemeShot(spanish);
  if (themed) return themed;

  return spanish
    .replace(/á/g, 'a')
    .replace(/é/g, 'e')
    .replace(/í/g, 'i')
    .replace(/ó/g, 'o')
    .replace(/ú/g, 'u')
    .replace(/ñ/g, 'n')
    .replace(META_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
