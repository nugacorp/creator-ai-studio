---
name: cas-youtube-release-safety
description: Safe YouTube release for Creator AI Studio — OAuth scopes, final video/metadata/thumbnail checks, explicit human authorization before upload, private/unlisted test uploads, prevent double publish.
---

# CAS YouTube Release Safety

YouTube upload is **high risk**. This skill applies only when a Work Order **explicitly authorizes** publication.

## Hard gates

1. **Written authorization** in WO: episode id, channel, visibility (private/unlisted/public).
2. **Human confirmation** before any upload API call.
3. **Video artifact exists** — final render on disk, not placeholder.
4. **Metadata complete** — title, description, tags from SEO agent or manual review.
5. **Thumbnail attached** — final asset, not stock placeholder.
6. **OAuth valid** — Google OAuth with YouTube scopes; token refresh working.

## Pre-upload checklist

| Item | Verify |
|------|--------|
| OAuth | Settings → YouTube connected |
| Scopes | Upload + manage videos |
| Duplicate | Episode not already `published` with `youtubeVideoId` |
| Visibility | Default **private** or **unlisted** for test WO |
| `authorized: true` | Required on publish-confirm endpoint |

## API behavior

Publish endpoints must require explicit confirmation flag — never auto-chain from `publish_package` job without human step.

## Test strategy

1. First upload: **private** video on test channel or unlisted.
2. Verify video in YouTube Studio before any public visibility change.
3. Document YouTube video id in episode metadata — no second upload for same episode.

## Do not

- Call confirm-publish without operator approval.
- Publish from CI, agent autoEnqueue, or smoke tests.
- Log OAuth refresh tokens or Google client secrets.

## References

- [docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md](../../docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md)
- [docs/02-operations/E2E_STAGING_CHECKLIST.md](../../docs/02-operations/E2E_STAGING_CHECKLIST.md)
