# CT Prime Community website: standing rules

## Project
Single page site for CT Prime Community, a free Filipino crypto trading community on Discord (discord.gg/ctprime). One job: get visitors to join the Discord. Brand line from their own banner: "Stop guessing. Start planning." Three pillars from their banner: Beginner lessons, Live market screening, Filipino trading community. Mobile first: most traffic comes from Facebook/Instagram/TikTok in-app browsers on mid-range Philippine phones.

Reference projects by the same author (style + technique source, read `docs/reference-study.json` for the extracted patterns): GN Mazal Site (closest sibling, crypto community), GN Tech Run (build discipline, effects budget), Theoraux (typographic restraint, motion discipline), Portfolio (masked line reveals, cinematic polish).

## Stack
Vite 5 + vanilla JS (ES modules) + plain CSS. No frameworks. three.js only for the background, lazy imported. Run `npm run build` to verify. No other deps without asking the lead.

## Content lives in site.config.json
Discord invite, copy, pillars, channel previews, steps, FAQ, disclaimer, socials. Never hardcode copy in JS. Never invent facts: no member counts, no win rates, no testimonials, no prices of a paid tier, no named mentors. If a value is empty, hide the element.

## Brand tokens (src/styles/tokens.css is the source of truth)
- Night #090B10 (page base, matches the brand banner black), Deep #0D1A3A (navy panels, from the logo banners), Prime #5683DA (brand blue, sampled from the square logo), Sky #A9C1F2 (chip text, light blue), Ember #D08C70 (the peach glow in the banners, used only as glow and for stop loss/risk), Lens #F2875A (mascot glasses orange, tiny accents only), Horn #EEE6D6 (mascot horns, warm off white for body text on dark).
- Fonts (self hosted in /public/fonts, woff2, font-display swap): Plus Jakarta Sans 400/500/700/800 (everything), Montserrat 300/700 (logo lockup "PRIME / COMMUNITY" only), Silkscreen 400 (pixel font: live prices, mascot bubble, max 2 places).
- Signature device: the 45 degree slash from the CT monogram. Primary buttons have the slash cut on the right corners (clip-path), section transitions may use a slash edge. Do not use it on everything.
- Mascot: /img/mascot.png (pixel bull with shades, cut off at the bottom by design). It always peeks up from a bottom edge, never floats in the middle. image-rendering: pixelated.
- Logo: /img/ct-mark.svg (fill currentColor) + Montserrat "PRIME" 700 / "COMMUNITY" 300 lockup, uppercase (logo only).

## Copy rules (house rules across the author's sites)
- No hyphens or dashes before text, no decorative leading lines before labels, no em or en dashes in copy. Hyphenated words become two words or one word ("sign up" not "sign-up").
- No tracked ALL CAPS eyebrows above headings. Section labels, where useful, are Discord channel names like `#beginner-lessons` (that is the community's own vocabulary).
- Sentence case. Plain verbs. Buttons say what happens: "Join the Discord". No "→" appended to button text.
- Filipino warmth is fine in small doses (Taglish in one or two places, e.g. "Tara, join na."), main copy in English.
- Not financial advice disclaimer in the planner and footer.

## Typography
- Headlines: Plus Jakarta Sans 800, letter-spacing -0.045em, line-height 0.98, sentence case. h1 clamp(44px, 8.4vw, 116px). h2 clamp(32px, 5vw, 64px). Titles on one line where possible (nowrap on short titles), otherwise text-wrap: balance, never an orphan.
- Body: 16px min on mobile (17px desktop), line-height 1.6, max 60ch, text-wrap: pretty. Nothing under 14px. Buttons at least 48px tall.

## Effects (all respect prefers-reduced-motion; content visible without JS)
- Splash: every load, about 1s, CT mark revealed by a 45 degree slash wipe, CSS fades it, JS removes the node. Must not block LCP.
- Hero load sequence (the one orchestrated moment): headline lines rise from masks (.mask > span, yPercent), chips then CTA follow, mascot peeks up last.
- Elsewhere: masked line reveal on h2 only, once, IntersectionObserver. No fade-up on every block.
- Background: fixed canvas, three.js fragment shader "aurora ribbon" matching the blurred blue ribbon + peach glow of the brand banners. Loaded on idle. DPR cap 1.5, 30fps cap on mobile, pause when hidden. Degrade to the static CSS gradient (#bg-fallback) on low end devices (hardwareConcurrency <= 4 or deviceMemory <= 4), reduced motion, no WebGL, or measured FPS < 24.
- SFX: Web Audio synthesized tick on click/tap, AudioContext after first gesture, low gain, mute toggle persisted in localStorage (try/catch).
- Cursor: native CSS cursor only, a pixel art arrow (Prime blue fill, black 1px pixel outline), 32px svg + 64px png, scoped to (hover: hover) and (pointer: fine).
- One shine sweep only, on the hero CTA.
- Animate only transform and opacity. One easing: cubic-bezier(.2,.8,.2,1).

## Performance + quality floor
Lighthouse mobile: Perf >= 90, A11y >= 95, BP >= 95, SEO >= 95. LCP < 2.5s, CLS < 0.1. Use svh/dvh, never 100vh. env(safe-area-inset-*). Visible focus (2px Sky outline, offset 3px). Skip link. Every text pair meets WCAG AA. No horizontal overflow at 360px. Every external link target="_blank" rel="noopener".

## Page length
About 6 screens on mobile max. Sections: header, hero (+ live ticker), inside the server (channel switcher), trade planner, how to join (3 steps), FAQ, final CTA + footer, mobile sticky join bar.

## REVISION 2 (user request, overrides anything above)
1. ONE BUTTON ONLY. The whole page has exactly one call to action: `#hero-join`, label "Join CT Prime", linking to the Discord invite (cfg.discord.url). The Discord URL text (discord.gg/...) must NEVER be visible anywhere on the page (not in copy, notes, pills, footer, tooltips). No header join button, no nav, no burger menu, no mobile menu, no sticky join bar, no final CTA button or invite pill, no "Try the planner" button, no social links. The header is just the brand lockup (left) and the mute toggle (right). Interactive tools (channel tabs, planner inputs, FAQ) stay; they are not CTAs. The final section `#cta` is a closing glass card (mark, h2, sub, mascot peeking) WITHOUT a button.
2. GIF: `/img/mascot.gif` is an animated pixel GIF of the bull (head bob, blink, glasses glint), made from mascot.png by the assets agent. The hero, the final section and the splash use the GIF. mascot.png stays as the static fallback (reduced motion swaps to png).
3. GLASSMORPHISM is a headline feature now (Mazal style, bright not murky): translucent gradient `linear-gradient(160deg, rgba(169,193,242,.12), rgba(13,26,58,.45))`, `backdrop-filter: blur(18px) saturate(160%)`, 1px border rgba(169,193,242,.2), top inset highlight `inset 0 1px 0 rgba(255,255,255,.12)`, deep tinted shadow, and a slow liquid sheen (one diagonal 45deg highlight drifting, transform only) on the big glass panels. Apply to: header (after scroll), hero chips, a glass "hero card" behind the CTA area is NOT needed (keep hero airy), channel switcher panel, planner panel, FAQ rows, steps, final card. Lighter blur on mobile (10px). `@supports not (backdrop-filter)` and `prefers-reduced-transparency` fallback to solid #0e1830.
4. TEXT ANIMATION is a headline feature now: hero line 1 masked line rise; hero line 2 "Start planning." per character rise with a Prime to Sky gradient shimmer sweeping through once; hero sub word by word fade/rise (35ms stagger); chips type in (pixel caret blink then text); section h2 per word masked rise when in view; mascot speech bubble types its text in Silkscreen with a blinking block caret; planner big readout counts/rolls to new values (tabular numbers). All transform/opacity only, all off under reduced motion, content visible without JS.
5. SPLASH: index.html now has a richer inline splash (aurora glow, CT mark slash wipe, PRIME letters rise, COMMUNITY letters slide in, slashed loading bar, GIF bull peeks). It fades out at ~1.85s and is fully gone at ~2.3s. splash.js removes it on the `sp-out` animationend (or a 3s fallback). The hero load sequence must start at ~1.9s (after the splash), not before.
