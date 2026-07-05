---
name: cas-youtube-release-safety
description: "Creator AI Studio YouTube release safety gate requiring explicit human authorization."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, youtube, oauth, release, safety]
---

# CAS YouTube Release Safety

Use before any YouTube upload, release, or publish confirmation.

## Inputs needed
- Episode ID.
- Explicit human authorization to upload/publish.
- Desired visibility: private, unlisted, or public.
- Confirmation of final metadata and thumbnail.

## Safety rules
- Never print OAuth tokens, refresh tokens, client secrets, cookies, or Authorization headers.
- Never publish automatically.
- Never confirm publish automatically.
- Use private or unlisted for tests unless public release is explicitly authorized.
- Prevent duplicate publication.

## Checklist
1. Confirm video artefact exists and is final.
2. Confirm title/description/tags/thumbnail are final.
3. Confirm YouTube OAuth connected.
4. Confirm required scopes are present.
5. Confirm target channel/account.
6. Confirm no existing `videoId`/published record for the episode.
7. Confirm human approval text explicitly authorizes upload.
8. Upload with requested visibility.
9. Do not call confirm-publish unless separately authorized after verifying upload result.
10. Record sanitized video ID/URL only if allowed.

## Prohibited actions
- Upload without explicit authorization.
- Public publish for tests unless explicitly authorized.
- Re-upload same episode without duplicate-safety check.

## Delivery format
Status, OAuth/scopes yes/no, artefacts yes/no, metadata yes/no, authorization yes/no, upload executed yes/no, visibility, duplicate check, next recommendation.
