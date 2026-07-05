import { existsSync } from 'node:fs';
import path from 'node:path';
import type { EpisodeContent, EpisodeDetail, EpisodeStage, Scene } from '@creator-ai-studio/shared';

export function isStageCompleted(episode: EpisodeDetail, stage: EpisodeStage): boolean {
  return episode.stages.find(s => s.stage === stage)?.status === 'completed';
}

export function sceneContentSignature(scenes: Scene[]): string {
  return JSON.stringify(
    scenes.map(s => ({
      id: s.id,
      text: s.text,
      visualNote: s.visualNote,
      voiceoverPrompt: s.voiceoverPrompt,
      duration: s.duration,
      transition: s.transition,
    })),
  );
}

/** Stages to unlock when the user edits episode content manually. */
export function stagesToInvalidate(
  before: EpisodeContent,
  after: EpisodeContent,
): EpisodeStage[] {
  const pending = new Set<EpisodeStage>();

  if ((before.script ?? '').trim() !== (after.script ?? '').trim()) {
    pending.add('storyboard');
    pending.add('assets');
    pending.add('audio');
    pending.add('subtitles');
    pending.add('video');
    pending.add('shorts');
    pending.add('seo');
  }

  if (JSON.stringify(before.outline ?? []) !== JSON.stringify(after.outline ?? [])) {
    pending.add('script');
    pending.add('storyboard');
    pending.add('assets');
    pending.add('subtitles');
    pending.add('video');
    pending.add('shorts');
  }

  if (sceneContentSignature(before.scenes) !== sceneContentSignature(after.scenes)) {
    pending.add('assets');
    pending.add('subtitles');
    pending.add('video');
    pending.add('shorts');
  }

  if ((before.musicUrl ?? '') !== (after.musicUrl ?? '')) {
    pending.add('video');
    pending.add('shorts');
  }

  if ((before.audioUrl ?? '') !== (after.audioUrl ?? '')) {
    pending.add('subtitles');
    pending.add('video');
    pending.add('shorts');
  }

  if ((before.subtitlesSrt ?? '') !== (after.subtitlesSrt ?? '')) {
    pending.add('video');
    pending.add('shorts');
  }

  if ((before.thumbnailUrl ?? '') !== (after.thumbnailUrl ?? '')) {
    pending.add('video');
  }

  const seoBefore = JSON.stringify({
    t: before.seoTitles,
    d: before.seoDescription,
    g: before.seoTags,
  });
  const seoAfter = JSON.stringify({
    t: after.seoTitles,
    d: after.seoDescription,
    g: after.seoTags,
  });
  if (seoBefore !== seoAfter) {
    pending.add('seo');
  }

  return [...pending];
}

export function allScenesHaveStoredImages(episodeDir: string, scenes: Scene[]): boolean {
  if (scenes.length === 0) return false;
  return scenes.every((scene, index) => {
    const filename = `slide-${String(index).padStart(3, '0')}.png`;
    if (scene.imageUrl?.includes(filename) && existsSync(path.join(episodeDir, '04-assets', filename))) {
      return true;
    }
    return Boolean(scene.imageUrl?.trim()) && existsSync(path.join(episodeDir, '04-assets', filename));
  });
}

export function hasAudioFile(episodeDir: string): boolean {
  return (
    existsSync(path.join(episodeDir, '05-audio', 'voiceover.mp3')) ||
    existsSync(path.join(episodeDir, '05-audio', 'narration.mp3'))
  );
}

export function hasVideoFile(episodeDir: string): boolean {
  return existsSync(path.join(episodeDir, '06-video', 'episode.mp4'));
}

export function hasSubtitlesFile(episodeDir: string): boolean {
  return existsSync(path.join(episodeDir, '06-subtitles', 'subtitles.srt'));
}

export function hasThumbnailFile(episodeDir: string): boolean {
  return existsSync(path.join(episodeDir, '07-thumbnail', 'thumbnail.png'));
}

export function hasBackgroundMusicFile(episodeDir: string): boolean {
  return existsSync(path.join(episodeDir, '05-audio', 'background-music.mp3'));
}

export function hasScriptContent(content: EpisodeContent): boolean {
  return (content.script ?? '').trim().length > 50;
}
