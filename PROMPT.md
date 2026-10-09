Build v2 of the GOAL motion explainer: the same story and copy as v1, restyled to match a reference video's look and motion language. Work in this folder (`gold-brand-animation-v2`). It's empty, so set it up fresh.

<audience_and_purpose>
The piece explains how a GOAL campaign works to insurance agency owners: prospects, current clients, and marketing viewers. It plays with sound off, often on a phone. A viewer should come away knowing three things: the agency pays per click, about 6 in 10 clicks become leads on average, and every lead saw the agency's ad and completed its full form. v1 tells this story clearly but plays it safe visually. v2 should feel bold and crafted, the kind of motion piece people rewatch, while staying on brand and just as clear.
</audience_and_purpose>

<source_of_truth>
v1 lives at `/Users/tom_panos/current-projects/active-projects/goal-brand`. Read these before designing anything:
- `dist/goal-explainer-shot-list.md` for the five-scene narrative, every line of on-screen copy, timings, and brand rules. The scene 5 copy in this file is current (revised Oct 8).
- `src/index.html`, `src/main.js`, `src/styles.css` for how v1 is built: master clock, scene timeline, landscape and portrait stages, reduced motion, captions.
- `build.mjs` and `README.md` for the single-file build and Vercel setup.
- `assets/` for the logos: `goal-mark-400.png` (radar mark), `goal-wordmark-white-1200.png`, `goal-wordmark-black-1200.png`.

Reuse v1's architecture and build approach where they fit. Copy what you need into this folder rather than importing from the v1 folder, and leave v1 untouched.
</source_of_truth>

<copy>
Use v1's narrative and copy verbatim: every eyebrow, headline beat, label, counter, footnote, recap line, the tagline "Your brand. Your leads. Never resold." and the button "Talk with your GOAL team." Keep the scene order and the beat order within each scene.

The reference style is built on one huge word per scene. Each scene can add one oversized hero word, but it has to come from that scene's existing copy (for example CLICK, 6 IN 10, LEADS, YOUR AD). Don't write new sentences, taglines, or claims. If a scene needs a line v1 doesn't have, stop and list it for me instead of inventing it.

These messaging rules carry over from v1 and exist for accuracy:
- "6 in 10" is the only figure, and it always carries "about" or "on average," because it's an average across campaigns.
- Paid marks belong to clicks, never to leads. The agency pays for the click; a lead is what some clicks become. Both converting and non-converting clicks are paid.
- No "cost per lead." GOAL runs ad campaigns and doesn't sell leads.
- The footnote about mistyped or false info stays small, muted, and calm. It's rare, and the visuals shouldn't make it look like a problem.
- "Never resold" means the lead isn't sold to another agency. Nothing should imply no one else contacts the shopper.
- No dashes in on-screen copy. Twelve words or fewer per beat.
</copy>

<style_reference>
Match the style of a ~26 second motion piece (by @be_arsh on X, a Claude-made video). You can't view it, so here is what it does:

- **One dot is the whole idea.** It opens on a blank frame with a single small dot. The dot grows into a circle that becomes a portal into the first scene. Every scene is built around one circular object (sun, clock, wheel, eye, halftone globe, target rings), and every transition passes through a circle: an iris wipe, a circle expanding to flood the next color, or a match cut from one round object to the next.
- **Kinetic type.** Each scene has one giant word in a heavy grotesk, all caps, tight tracking, filling most of the frame width (RISE, TICK, FLIP, ROLL, LOOK, GROW, ZERO, SPIN, SPREAD). The circular object passes in front of or behind the word, masks part of it, or knocks letters out.
- **Flat, saturated color fields.** Every scene is one full-bleed solid background with two or three flat accent colors. No gradients, no drop shadows, no glass. Shapes have bold black or white outlines.
- **Halftone dot textures.** Some words and objects render as fields of dots (a dotted GROW, a globe made of dots), which carries the dot theme into texture.
- **Snappy motion.** Fast ease-outs with slight overshoot, quick scale pops, objects that spin, tick, or roll for a beat and then hand off. New visual idea roughly every 2 to 3 seconds.
- **Finale.** Every scene's circle reappears as a small tile in a grid, the tiles collapse back into the center dot, and the piece ends on a short line of text where the dot completes the sentence.
</style_reference>

<how_to_translate_it_to_goal>
GOAL is a natural fit: v1 already uses a blue dot as its continuity device (cursor tap, traveling clicks, the dot on each lead), and the GOAL radar mark is concentric rings. Make the dot the spine of v2: the same blue dot is a click, then a lead, then the center of the radar mark.

Starting directions per scene. Improve on them if you find something clearer.
1. **Intro.** Dark frame, one blue dot. It pulses, rings ripple out, and it resolves into the radar mark with "How your GOAL campaign works."
2. **Your ad.** The circle opens onto a brand blue field. The ad lands in the top result on phone and desktop. The dot is the tap and the click, and each click flies to the paid counter.
3. **Clicks to leads.** Ten dots, each marked paid when clicked. Six become leads, four go muted gray. "6 IN 10" is the hero word, rendered in halftone dots. Then "Every click is paid, lead or not," with all ten paid marks pulsing.
4. **Every lead.** An eye (the reference's LOOK scene) whose iris is the blue dot, for "Every lead saw your ad." Then the forms fill on phone and desktop and leads arrive in the inbox with their two checks. Footnote last, small and muted.
5. **Recap and close.** The scene circles return as a tile grid beside the three recap lines, collapse into the dot, the dot becomes the radar mark, then the wordmark, tagline, and button.

Keep v1's beat timings as the baseline (about 45 seconds total). Tighten or stretch individual beats as the motion needs, but every line of copy has to stay on screen long enough to read twice at normal speed.
</how_to_translate_it_to_goal>

<brand>
- Base on the v1 site palette: background #080C10, primary blue #057BE5, light blue #339FFF, white, and the v1 neutrals. For the reference's saturated full-bleed fields, use solid brand blue #057BE5 and white as scene backgrounds alongside #080C10. Mint #3BEECA from `goal-brand/design-tokens.css` is allowed as a small accent only. No magenta, violet, orange, or yellow; they're in the reference but not in GOAL's brand.
- Type: Sora 800 for hero words and headlines, Outfit for everything else, as in v1. Nothing smaller than 28px on the 1920 by 1080 stage.
- Logos only fade or scale in. Never recolor, stretch, rotate, mask, or halftone them, and keep clear space around them.
- Simple and pleasant beats busy. When the style and clarity conflict, clarity wins.
</brand>

<deliverables>
Match v1's output set:
- `src/` source plus a dependency-free `build.mjs` that inlines everything into single-file pages.
- `dist/goal-explainer.html` (player with controls and captions) and `dist/goal-explainer-autoplay.html` (clean, no controls or captions).
- `public/` and `vercel.json` set up like v1, with the clean build at the root.
- Landscape 1920 by 1080 and portrait 1080 by 1920 stages, switching on orientation like v1.
- `prefers-reduced-motion` shows each scene in its final state with Previous and Next.
- `dist/goal-explainer-shot-list.md`, an updated shot list in v1's format so the piece can be rebuilt as video.
- A short `README.md`.

Drive all animation from one master clock, as v1 does, so any timestamp renders the same frame. That keeps it recordable to MP4 later.
</deliverables>

<verification>
Before you call it done, render it in Playwright (Chromium is installed) and capture frames at every beat in both orientations into `dist/screenshots/`. Look at each one and check:
- Every line of copy matches v1 exactly, with nothing added except per-scene hero words taken from existing copy.
- No paid mark ever sits on a lead, and exactly six leads and four gray clicks appear in scene 3.
- Text is readable over every background and nothing clips at either orientation.
- Colors stay inside the brand list above.
Fix what fails, then end with a short recap: what you built, the hero word you chose for each scene, any timing changes from v1, and anything you'd want me to decide.
</verification>

Keep the work to this brief. If you see a better idea that changes the story or the copy, put it in the recap as a suggestion instead of building it.
