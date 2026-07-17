# PicoKit design QA

## Target and capture

- Selected visual target: `C:\Users\Done\.codex\generated_images\019f5987-8fb2-7033-8ccf-c2d55ccaf1c2\exec-86a9d69e-84a2-4e92-94cd-ac31cc415648.png`
- Implementation: `http://localhost:3000/`
- Requested viewport: 1440 x 1024; in-app browser capture surface: 1425 x 905
- State: homepage, default search state, desktop dark theme
- Full comparison input: `.gstack/design-qa/comparison-home-pass3.png`
- Focused comparison input: `.gstack/design-qa/comparison-home-tools-pass3.png`
- Tool-page capture: `.gstack/design-qa/ai-image-detector-1440x1024-pass2.jpg`
- Mobile capture: `.gstack/design-qa/home-mobile-390x844-pass2.jpg`

## Comparison history

1. Pass 1 found an oversized hero title, undersized navigation/list type, and extra vertical space between the CTA and search field.
2. Updated the header scale, hero type scale and spacing, list typography, and tool-section offset.
3. Pass 3 aligned the header, hero, subtitle, CTA, search field, section label, and tool rows with the selected visual target. No remaining P0, P1, or P2 visual findings.

## Functional and responsive checks

- Homepage search filters across the full tool set; `C2PA` returned two matching tools.
- Escape clears and blurs the search field.
- Desktop primary navigation opens the AI image detector route.
- Mobile menu opens and exposes all primary and utility routes.
- 390 x 844 mobile layout has no horizontal overflow.
- AI image detector upload area, device panel, and privacy panel render correctly.
- Browser console errors/warnings: none.
- `npm run check`: passed (TypeScript, ESLint, 12 unit tests, production build, and 6 rendered-route tests).

final result: passed

## Multilingual QA — 2026-07-13

- Languages: Simplified Chinese (`zh-CN`) and English (`en`).
- Language selection persists across homepage, tool, and content-page navigation through local browser storage.
- The document language, page title, and description update with the active language.
- English desktop and 390 x 844 mobile layouts have no horizontal overflow.
- English homepage, image provenance tool, methodology page, mobile navigation, upload state, device panel, privacy copy, and footer were verified in the in-app browser.
- Browser console errors/warnings: none.
- `npm run check`: passed (TypeScript, ESLint, 15 unit tests, production build, and 6 rendered-route tests).

multilingual result: passed

## AI text input alignment QA — 2026-07-13

- Source visual truth: `C:\Users\Done\AppData\Local\Temp\codex-clipboard-10c5ad22-17b6-4da9-ba15-7aa7912bdd00.png`
- Implementation: `http://localhost:3000/ai-text-detector`
- Implementation screenshot: unavailable because the Codex in-app browser reports that screenshot and content-export commands are unsupported.
- Requested comparison viewport: 1077 x 1059.
- State: Chinese, empty text input, desktop dark theme.
- Full-view comparison evidence: blocked because a browser-rendered implementation screenshot could not be captured.
- Focused-region comparison evidence: blocked for the same reason; the input card was verified through live DOM geometry instead.

### Finding and fix history

1. The source screenshot showed the text counters placed beneath the description instead of aligned with it. Root cause: `CardHeader` renders as CSS Grid, while `flex-row` changed only flex direction and never changed its display mode.
2. Replaced the ineffective flex classes with an explicit responsive grid and moved characters/words into two equal counter cards.
3. Live desktop geometry after the fix: left description 580 x 54px; statistics region 168 x 57px; counter cards 80 x 57px each; all begin at y=492px. The textarea begins on the next row at y=565px. No horizontal overflow was detected.
4. Localized the textarea placeholder and tightened the title/description line height and spacing.

### Required fidelity surfaces

- Fonts and typography: existing PicoKit font stack and weights preserved; counters use tabular numerals and consistent 11px labels.
- Spacing and layout rhythm: title/description and counter cards now share a top baseline; textarea remains a separate full-width row.
- Colors and visual tokens: existing dark surface, cyan focus treatment, and white/10 borders preserved.
- Image quality and assets: no image assets are present in the edited component.
- Copy and content: Chinese and English descriptions and placeholder text remain available.

### Remaining blocker

- A same-viewport browser screenshot is required before visual comparison can be marked passed. No P0/P1 functional issue remains in the measured layout.

final result: blocked

## AI tools directory QA — 2026-07-14

### Target and evidence

- Source visual truth: `C:\Users\Done\.codex\visualizations\2026\07\14\019f5ec1-fe72-7ff3-ae79-d5b1a5628c59\ai-directory-qa\source-picokit-home-1280x900.png`
- Implementation: `http://localhost:3002/ai-tools`
- Implementation screenshot: `C:\Users\Done\.codex\visualizations\2026\07\14\019f5ec1-fe72-7ff3-ae79-d5b1a5628c59\ai-directory-qa\implementation-ai-tools-1280x900.png`
- Full-view comparison evidence: `C:\Users\Done\.codex\visualizations\2026\07\14\019f5ec1-fe72-7ff3-ae79-d5b1a5628c59\ai-directory-qa\comparison-source-vs-ai-tools.png`
- Focused header and hero comparison: `C:\Users\Done\.codex\visualizations\2026\07\14\019f5ec1-fe72-7ff3-ae79-d5b1a5628c59\ai-directory-qa\comparison-header-focused.png`
- Viewport: 1280 x 900 desktop; additional responsive check at 390 x 844.
- State: English desktop dark theme, default directory state. Search, Trending filter, language switch, and mobile navigation were checked separately.

### Findings

- No actionable P0, P1, or P2 visual differences remain.
- The directory intentionally changes the homepage's centered single-column hero into a left-aligned task-discovery hero with a right-side evidence panel. The shared header scale, display type, cyan accent, dark surfaces, border rhythm, radii, and 1280px content frame remain consistent with the source product.
- The first full-view comparison passed without visual fixes. No P0/P1/P2 iteration loop was required.

### Required fidelity surfaces

- Fonts and typography: the existing Inter/Arial/PingFang fallback stack, black display weight, compact tracking, body scale, mono eyebrow labels, and optical hierarchy match the PicoKit source. Desktop and mobile headings wrap without clipping.
- Spacing and layout rhythm: header height, 32px desktop gutters, section dividers, square-edged card grids, compact radii, and vertical section cadence match the source. The 390px layout has no horizontal overflow.
- Colors and tokens: the existing `#080808`/`#0d0d0d` dark surfaces, white/10-15 borders, zinc text ladder, cyan primary accent, and amber Trending state are consistent and maintain readable contrast.
- Image quality and asset fidelity: neither the source flow nor this directory requires hero or product imagery. Existing Lucide icons are used consistently for task categories; no fake brand logos, custom SVGs, CSS drawings, placeholders, or stretched raster assets were introduced.
- Copy and content: 64 platforms have concise English and Chinese descriptions, official direct links, clear category labels, non-sponsored positioning, a review date, and availability disclaimers.
- Interaction states: search (`voice` → 8 matches), Trending (13 matches), reset, category controls, English/Chinese switching, and the mobile menu with the new AI directory entry were verified in the in-app browser.
- Accessibility: semantic headings and regions, labelled search, pressed filter states, visible focus rings, 40px+ controls, reduced-motion support from the shared stylesheet, and 390px text wrapping were checked.
- Browser console errors/warnings on a fresh verification tab: none.

### Comparison history

1. Existing PicoKit homepage and the new AI tools directory were captured at the same 1280 x 900 viewport and combined into one side-by-side comparison image.
2. A focused header/hero comparison confirmed matching navigation height, logo scale, type family, token palette, and divider treatment.
3. No P0/P1/P2 mismatch was found, so no post-comparison visual change was necessary.

### Follow-up polish

- P3: official brand marks could be added later only if PicoKit adopts a maintained logo-asset policy; generic category icons are intentionally used now to avoid inaccurate or stale logo approximations.

final result: passed
