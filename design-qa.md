# Homepage visual integration QA

## Scope

- Integrated the three generated feature illustrations into the rotating homepage banner.
- Promoted Image Delivery Pipeline, PDF Page Assembly, and AI Image Detection in the desktop and mobile navigation.
- Removed the desktop More menu and its two entries; restored AI Tools to the normal navigation treatment.

## Visual truth and evidence

- Source assets:
  - `public/illustrations/hero-image-workspace.webp`
  - `public/illustrations/hero-pdf-workspace.webp`
  - `public/illustrations/hero-ai-image-detection.webp`
- Desktop implementation: `.design-qa/home-final-1280-revised.png`, `.design-qa/home-ai-final-1280.png`
- Mobile implementation: `.design-qa/home-mobile-375.png`, `.design-qa/home-mobile-menu-375.png`
- Combined source/implementation comparison: `.design-qa/ai-source-vs-implementation-final.png` (source on the left, rendered homepage on the right)
- Viewports checked: 1280 × 720 and 375 × 844.
- States checked: dark theme, light theme, mobile menu open, all three banner slides, automatic rotation.

## Comparison history

1. The initial dark-theme illustration treatment was too dim and lost detail at reduced size.
2. Increased illustration brightness, retained contrast and cyan saturation, and added a WebKit-compatible radial mask.
3. Re-captured and compared the AI source and implementation together; the subject remains recognizable, the white source background blends into the dark banner, and the copy/CTA keep primary hierarchy.

## Interaction and responsive checks

- Previous/next controls change slides and reset the timer.
- The banner advances automatically after 6.5 seconds and pauses for reduced motion, hidden pages, and active dragging.
- Desktop navigation shows the three starred tools, contains no More menu, and renders AI Tools without featured styling.
- Mobile navigation opens and closes normally, keeps the same three starred tools first, and fits at 375 px without horizontal overflow.
- Light and dark themes retain readable text and visible illustration detail.
- Browser console errors: none.

## Automated verification

- TypeScript: passed (`npx tsc --noEmit`).
- Tests: 51 files / 195 tests passed (`npm test`).
- Production build: passed (`npm run build`).
- Diff whitespace check: passed (`git diff --check`; line-ending notices only).

## Severity review

- P0: none.
- P1: none.
- P2: none remaining.

Homepage result: passed

---

# Image Wobble Animator integration QA

## Scope

- Used the public PuruPuru Maker screen and interaction model as the functional reference.
- Adapted the tool to TabNative's existing shell, typography, dark/light themes, cards, controls, privacy copy, responsive navigation, and tutorial system.
- Added the tool as a common image utility rather than copying the source site's standalone branding.

## Visual truth and comparison evidence

- Desktop source: `.clone-source/purupuru-desktop-top.png`, `.clone-source/purupuru-desktop-bottom.png`.
- Mobile source: `.clone-source/purupuru-mobile-top.png`, `.clone-source/purupuru-mobile-middle.png`, `.clone-source/purupuru-mobile-bottom.png`.
- Desktop implementation states: `.design-qa/image-wobble-desktop-light.png`, `.design-qa/image-wobble-desktop-mask.png`, `.design-qa/image-wobble-desktop-preview.png`, `.design-qa/image-wobble-desktop-export.png`.
- Mobile implementation: `.design-qa/image-wobble-mobile-entry.png`.
- Same-viewport comparison inputs opened and reviewed:
  - `.design-qa/image-wobble-comparison-desktop.png` — source on the left, TabNative implementation on the right, both 1265 × 712.
  - `.design-qa/image-wobble-comparison-mobile.png` — source on the left, TabNative implementation on the right, both 375 × 812.
- Intentional visual difference: source pastel branding was replaced by TabNative's established cyan, neutral, border, radius, and typography system. The functional hierarchy remains upload → paint mask → preview/tune → export.

## Visual review

- Layout: desktop uses a stable 640 px editing stage beside settings; the canvas no longer shifts below the viewport when the preview controls become taller. Mobile stacks the editor and controls without horizontal overflow.
- Typography and copy: page title, task description, privacy status, best-use guidance, controls, and format limitations use direct product language rather than source-brand wording.
- Color and contrast: dark and light themes both keep headings, controls, inactive states, helper copy, and the cyan primary action legible.
- Assets: the built-in sample is an existing TabNative illustration with the correct 2:1 fit and no stretching.
- Interaction states: disabled upload state, loaded mask editor, active wobble preview, export progress, and completed animation result were all visually checked.

## Functional and responsive checks

- Local image validation and loading: passed with the bundled sample; source dimensions and format display correctly.
- Mask controls: fill, clear, invert, paint/erase, undo/redo state, brush size, and brush strength are wired.
- Motion controls: six presets, automatic sway/hop/orbit, sliders, direct drag force, and supported device motion are wired.
- Export: GIF (640 × 320, 1.1 MB), WebM (640 × 320, 482.8 KB), and supported MP4 (640 × 320, 613.3 KB) were generated in the in-app browser; the result preview and download action were enabled.
- Hydration: browser-dependent media support now initializes after mount, eliminating server/client disabled-state mismatch.
- Localization: all generated guide fields were added to the 11 non-English locale maps; Japanese homepage naming and description were verified through the language menu.
- Responsive metrics at mobile width: document client width 375 px, scroll width 375 px, canvas width 303 px; no horizontal overflow.
- Browser console after a clean load: no errors or warnings.

## Automated verification

- TypeScript: passed (`npx tsc --noEmit`).
- Focused tests: passed (`tests/image-wobble.test.ts`, `tests/navigation-priority.test.ts`).
- TypeScript and lint: passed.
- Unit and regression suite: 53 files / 202 tests passed.
- Production build: passed; `/image-wobble-maker` is included in the route manifest.
- Rendered Worker suite: 41 tests passed, including the new route, sitemap, guide link, and client-asset checks.

## Severity review

- P0: none.
- P1: none.
- P2: none remaining.

final result: passed
