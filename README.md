# GOAL brand animation v2

The v1 explainer of how a GOAL campaign works (paid clicks, about 6 in 10 clicks becoming leads, every lead having seen the agency's ad and completed its full form), restyled around one blue dot: flat full bleed color fields, one circle per scene, one oversized word per scene taken from that scene's copy, and circle wipes between scenes. Same story, same copy, about 52 seconds.

## Layout

- `src/` is the source: `index.html`, `styles.css`, `main.js`. The logos are referenced from `assets/`.
- `assets/` holds the logos the build inlines (`goal-mark-400.png`, `goal-wordmark-white-1200.png`), plus the black wordmark for light uses.
- `build.mjs` inlines the CSS, JS and logos into single-file pages:
  - `dist/goal-explainer.html`, the player with controls and captions
  - `dist/goal-explainer-autoplay.html`, the clean version with no controls and no captions
  - `public/index.html` and `public/player.html`, the deploy output (clean build at the root, player at `/player`)
- `dist/goal-explainer-shot-list.md` is the shot list for rebuilding the piece as video.
- `dist/screenshots/` holds the verification frames: every beat in landscape and portrait, plus each scene at rest for reduced motion.

## Build

```bash
node build.mjs
```

No dependencies. Node 20 or newer.

## Deploy

Set up for Vercel as a static site: `vercel.json` runs `node build.mjs` and serves `public/`. The clean autoplay build is the site root and the player is at `/player`. Either page accepts `?controls=0` and `?captions=0`.

## How it runs

One master clock drives everything, including the halftone canvas, so any timestamp renders the same frame (`window.__goal.seek(ms)` jumps there, which is how the frames were captured and how the piece can be recorded to MP4). The stage is designed twice, landscape 1920 by 1080 and portrait 1080 by 1920; the page picks the one that matches the viewport and re-measures every path on rotation. With `prefers-reduced-motion` each scene shows at rest with Previous and Next, in both builds.

## Playback

Space plays or pauses. Left and Right arrows step between scenes. R replays. C toggles captions. The progress segments at the top are clickable.

## Copy and brand rules

The copy is v1's, unchanged. Twelve words or fewer per beat, no dashes, no "cost per lead". "6 in 10" is the only figure and always carries "about" or "on average". Paid marks belong to clicks, never to leads. Colors stay within dark #080C10, blue #057BE5, light blue #339FFF, white, the v1 neutrals, and mint #3BEECA as a small accent. Logos only fade or scale.
