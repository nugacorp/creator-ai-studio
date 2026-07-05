import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PUBLISH_SCHEDULE,
  formatNextPublishSlot,
  formatPublishScheduleSummary,
  suggestNextPublishSlot,
} from '../src/schedule.js';

describe('suggestNextPublishSlot', () => {
  it('suggests next Monday 15:00 for long video from Sunday', () => {
    // 2026-07-05 is a Sunday
    const from = new Date(2026, 6, 5, 10, 0, 0);
    const slot = suggestNextPublishSlot(DEFAULT_PUBLISH_SCHEDULE, 'longVideo', from);
    expect(slot.getDay()).toBe(1);
    expect(slot.getHours()).toBe(15);
    expect(slot.getMinutes()).toBe(0);
    expect(slot.getDate()).toBe(6);
  });

  it('skips to next week when Monday slot already passed', () => {
    const from = new Date(2026, 6, 6, 16, 0, 0); // Monday after 15:00
    const slot = suggestNextPublishSlot(DEFAULT_PUBLISH_SCHEDULE, 'longVideo', from);
    expect(slot.getDay()).toBe(1);
    expect(slot.getDate()).toBe(13);
    expect(slot.getHours()).toBe(15);
  });

  it('suggests nearest Tue/Thu/Sat for shorts', () => {
    const from = new Date(2026, 6, 6, 8, 0, 0); // Monday
    const slot = suggestNextPublishSlot(DEFAULT_PUBLISH_SCHEDULE, 'shorts', from);
    expect(slot.getDay()).toBe(2); // Tuesday
    expect(slot.getHours()).toBe(10);
  });
});

describe('formatPublishScheduleSummary', () => {
  it('formats Camino Bíblico defaults in Spanish', () => {
    const summary = formatPublishScheduleSummary(DEFAULT_PUBLISH_SCHEDULE);
    expect(summary.longVideo).toContain('Video largo (lun 15:00)');
    expect(summary.shorts).toContain('Shorts (mar/jue/sáb 10:00)');
    expect(summary.timezone).toBe('America/Mexico_City');
  });
});

describe('formatNextPublishSlot', () => {
  it('includes kind and localized date', () => {
    const slot = new Date(2026, 6, 6, 15, 0, 0);
    const label = formatNextPublishSlot(slot, 'longVideo');
    expect(label).toMatch(/Próximo video largo:/);
  });
});
