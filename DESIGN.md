# Design

> Visual system for the ZooPrep frontend. Direction: **Study Hall** (pivoted 2026-05-31). Register: product. See [PRODUCT.md](./PRODUCT.md) for strategy.

## Direction: Study Hall

Warm, editorial, type-forward. The feeling of a good study lamp and late-night focus, not a sterile testing center. Personality through an unexpected-for-the-category warm palette + a confident contrast serif, restraint through a borderless, hairline-ruled layout.

- **Borderless / hairline.** Almost no card boxes. Whitespace, thin rules (`edge` tokens), and section rhythm separate content. Elevation is reserved for genuinely floating things (menus, modals, the next-action). Editorial, airy.
- **Big-number focus.** Key figures (projected score, mastery, counts) are large Fraunces numerals. One dominant number per surface; everything else orbits it quiet and small.
- **Warm, not sterile.** The palette carries the brand's personality; analytics feel human.
- **Light-first, full dark mode.** Dark is a warm near-black (espresso/charcoal), not cool slate, not pure black.

## Color — warm amber/bronze + ink

Why: in a test app red=wrong and green=right are reserved semantics, so the brand color must avoid both. Amber/bronze is warm, encouraging, premium, and unmistakably not-College-Board-blue and not-AI-indigo. It gives the product personality while leaving red/green free for correctness.

Token system stays the source of truth (`surface-*`, `ink-*`, `edge-*`). New ramps:

- **brand = amber/bronze** (primary actions, focal accent, the signature rule under big numbers). Deep enough at 600–700 to pass contrast on white; used ≤15% of surface.
- **accent = pine/evergreen** (success, correct, strengths, upward progress). A muted, grown-up green, distinct from the pure-green "correct" feedback so the two don't compete.
- **ink** is warm graphite (a hair of warmth, not blue-slate).
- **surface** light: warm off-white (chroma toward amber, NOT a cream/sand body — true near-white with the faintest warm tint). dark: warm espresso/charcoal.
- Semantic feedback: **danger/wrong = rose-red**, **correct = emerald** (kept separate from brand so color never overloads meaning). Status always pairs color with icon/text.

## Typography

- **Display:** Fraunces (warm optical serif) for the greeting, big numbers, and section-level numerals. Carries the editorial personality. Heavier optical weight on hero numbers.
- **UI / body / data:** Inter for labels, buttons, body, tables, small data.
- **Numbers:** Fraunces for hero/focal numerals (personality); Inter `tabular-nums` for dense inline data (alignment).
- Pairing on a contrast axis (serif display + grotesque UI).

## Motion

Reuse the existing motion layer (useScrollReveal, useCountUp, useInView, useReducedMotion) — unchanged. Choreographed but intentional; every animation has a reduced-motion fallback.

- Big numbers count up. The signature amber rule under the hero number wipes in. Sparkline/ring draw in on view. Staggered section reveals.
- 150–250ms UI feedback; 400–700ms reveals. ease-out-expo/quart. No bounce.
- Test-taking surfaces stay calm/minimal.

## Layout

- Borderless: sections separated by `border-edge` hairlines + whitespace, not boxes.
- Hero = big-number focus: dominant Fraunces projected score, amber signature rule, quiet orbit of trend + goal + stats. No surrounding card.
- Lists use row dividers, not nested cards. Reserve `Surface` elevation for the single next-action and floating UI.
- Responsive structural; ≥44px touch targets; skeletons for loading.

## Build conventions

- Retoken in `index.css` (`:root` + `.dark`) and `tailwind.config.js` brand/accent ramps. All surfaces use semantic tokens.
- No new fonts (Fraunces + Inter already loaded). No new motion deps.

## Rollout

1. Foundation re-token + Button + Surface usage rules (Study Hall).
2. Flagship: Student Dashboard rebuilt big-number/borderless. Browser sign-off.
3. Roll across: result pages → tutor dashboard/analytics → remaining surfaces.
