---
name: camino-biblico-content
description: >-
  Content and SEO conventions for Camino Bíblico, a Spanish evangelical biblical
  YouTube channel. Use when writing prompts, scripts, SEO, shorts, doctrine review,
  or scheduling publish slots for CAS episodes.
---

# Camino Bíblico Content

## Channel profile

- **Audience**: Spanish-speaking evangelical Christians
- **Tone**: Warm, accessible, biblically faithful, YouTube-native hooks
- **Language**: Spanish (es-ES / Latin American neutral)
- **Format**: Long-form reflections + Shorts clips

## Production workflow

1. **Ideas** — Sidebar → **Contenido**: raw idea → AI proposals → approve one
2. **Brief** — `01-research/brief.md` from approved proposal
3. **Research** — `researcher` agent: verses, historical context, doctrinal notes
4. **Script** — `scriptwriter`: hook, narrative arc, application
5. **Doctrine review** — `doctrine_reviewer` blocks heresy; Bible accuracy is non-negotiable
6. **Editorial review** — clarity, redundancy, tone
7. **Production** — storyboard → assets → audio → video → thumbnail
8. **SEO** — titles, description with **chapters**, tags, **pinnedComment**
9. **Publish** — long video + Shorts on habitual schedule
10. **Analytics** — `analytics_agent` recommendations for next episodes

## Publish schedule (defaults)

From `packages/shared/src/schedule.ts`:

- **Long video**: Monday 15:00 (`America/Mexico_City`)
- **Shorts**: Tuesday, Thursday, Saturday 10:00

Configurable in Settings → habitual schedule UI.

## SEO requirements

Episode content must include:

- `seoTitles[]` — 3+ title variants
- `seoDescription` — YouTube description with **chapter timestamps**
- `seoTags[]` — relevant keywords
- `pinnedComment` — engagement question or CTA (shown in SEO workspace tab)
- `thumbnailUrl` — upload/generated thumbnail before publish

## Doctrine reviewer

- Validates verse citations, context, and theological claims
- **Blocks** content that contradicts core evangelical doctrine or misquotes Scripture
- Human must approve before script enters production stages

## Shorts strategy

`shorts_agent` extracts 3–5 viral moments; vertical 9:16, strong hook in first 2 seconds, link back to long video.

## Ideation prompts

Brainstorm (`apps/api/src/ideas/brainstorm.ts`) should propose titles + 3–5 bullet angles per proposal, grounded in biblical themes, not generic motivational content.
