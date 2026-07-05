import { describe, it, expect } from 'vitest';
import { filterProjectsByChannel, projectMatchesChannel } from '../src/lib/channelScope';
import type { VideoProject } from '../src/types';

const sample = (channelId?: string): VideoProject => ({
  id: '1',
  title: 'Test',
  series: 'Reflexiones',
  status: 'Ideas',
  progress: 10,
  script: '',
  outline: [],
  scenes: [],
  seoTitles: [],
  seoDescription: '',
  seoTags: [],
  duration: '00:00',
  channelId,
});

describe('channelScope', () => {
  it('projectMatchesChannel returns true when no filter', () => {
    expect(projectMatchesChannel(sample('UC_a'), null)).toBe(true);
    expect(projectMatchesChannel(sample('UC_a'), undefined)).toBe(true);
  });

  it('projectMatchesChannel matches exact channelId', () => {
    expect(projectMatchesChannel(sample('UC_a'), 'UC_a')).toBe(true);
    expect(projectMatchesChannel(sample('UC_b'), 'UC_a')).toBe(false);
    expect(projectMatchesChannel(sample(), 'UC_a')).toBe(false);
  });

  it('filterProjectsByChannel filters when activeOnly', () => {
    const projects = [sample('UC_a'), sample('UC_b'), sample()];
    expect(filterProjectsByChannel(projects, 'UC_a', true)).toHaveLength(1);
    expect(filterProjectsByChannel(projects, 'UC_a', false)).toHaveLength(3);
  });
});
