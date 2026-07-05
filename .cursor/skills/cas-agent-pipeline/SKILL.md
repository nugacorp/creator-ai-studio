---
name: cas-agent-pipeline
description: >-
  Documents Creator AI Studio agent pipeline order, runner patterns, job types,
  human approval gates, and stage invalidation. Use when running or modifying
  agents, Hermes plans, worker jobs, or Agent Studio overrides.
---

# CAS Agent Pipeline

## Execution order

Hermes plans; specialists run in this order:

1. `hermes` — orchestrator, production plan
2. `researcher` — biblical research, brief
3. `scriptwriter` — narrative script
4. `doctrine_reviewer` — **human approval gate**, blocks heresy
5. `editorial_reviewer` — **human approval gate**, clarity/tone
6. `storyboard_designer` — scenes, timing
7. `scene_asset_designer` — image prompts/assets per scene
8. `narrator` — TTS voice direction
9. `audio_engineer` — music + mix notes
10. `thumbnail_designer` — CTR thumbnail concept
11. `video_editor` — FFmpeg render coordination
12. `seo_optimizer` — titles, description, tags, chapters
13. `shorts_agent` — 3–5 vertical clips from episode
14. `analytics_agent` — post-publish recommendations

## runner.ts patterns

File: `apps/api/src/agents/runner.ts`

- `RunAgentOptions`: `{ episodeId, agentId, userId?, jobId?, input?, autoEnqueuePlan? }`
- `STAGE_FOR_AGENT`: maps agent → `EpisodeStage` for stage status updates
- `HERMES_PIPELINE_ORDER`: default downstream sequence after Hermes plan
- `shouldRequireHumanApproval`: gates `doctrine_reviewer` and `editorial_reviewer` (`HUMAN_APPROVAL_AGENT_IDS` in shared)
- Agent runs persist to episode agent store; outputs write stage folders under episode dir
- `autoEnqueuePlan: true` on Hermes enqueues planned agent jobs

## Agent Studio overrides

Per-agent system prompts can be overridden in episode `00-control/settings.json` (Agent Studio UI). Resolver: `apps/api/src/agents/overrides.ts`.

## Human approval gates

Blocked agents wait for explicit approval in workspace before downstream jobs proceed. Do not bypass in production without user authorization.

## stagesToInvalidate on edit

File: `apps/api/src/media/production-locks.ts`

When user edits episode content via PATCH, downstream stages reset if upstream content changed:

- Script change → storyboard, assets, audio, subtitles, video, shorts, seo
- Outline change → script + downstream
- Scenes change → assets, subtitles, video, shorts
- Audio/music/thumbnail changes → dependent render stages

Used in `apps/api/src/app.ts` on episode content merge.

## Job types

| Type | Purpose |
|------|---------|
| `agent` | Run one agent (`payload.agentId`) |
| `script` | Script generation job |
| `tts` | Narration synthesis |
| `render` | FFmpeg video render (requires ffmpeg on worker) |
| `thumbnail` | Thumbnail generation |
| `shorts` | Shorts cut/render |
| `seo` | SEO metadata job |
| `pipeline` | Full multi-step pipeline |
| `publish_package` | YouTube publish bundle (human gate) |

Worker polls `GET /api/jobs/pending`, claims and executes. Queue: BullMQ with Redis fallback to polling.

## Ideas → pipeline entry

Approving an idea (`PATCH /api/ideas/:id/proposals/:proposalId/approve`) creates episode, writes `01-research/brief.md`, sets Kanban **Investigación**, enqueues `researcher` agent job.
