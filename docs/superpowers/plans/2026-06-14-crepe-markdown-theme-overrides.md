# Crepe Markdown Theme Overrides Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a maintainable Crepe markdown theme override layer that renders every block in `apps/electron/src/renderer/src/modules/shared/components/demo.md` consistently with Reflecta's design system.

**Architecture:** Do not tune by screenshot or by guessing CSS selectors. First inspect Crepe's source CSS and rendered DOM for each markdown block, then decide the smallest scoped override needed, then express the final style through project design tokens. `demo.md` is the coverage fixture; `milkdown-theme.css` is the only intended styling owner for editor/readonly markdown rendering.

**Tech Stack:** Milkdown Crepe, ProseMirror, CodeMirror, CSS design tokens, Vitest for non-visual verification.

---

## Scope

This plan covers markdown presentation in:

- `apps/electron/src/renderer/src/modules/shared/components/md-editor/milkdown-theme.css`
- `apps/electron/src/renderer/src/modules/shared/components/md-editor/`
- readonly rendering through `MarkdownPreview`, because it now uses the editor in readonly mode

This plan does not cover:

- Markdown parser feature work
- Mermaid/KaTeX/admonition behavior
- `md-preview` custom markdown render logic
- Playwright, Computer Use, or screenshot-based automated verification

---

## Guiding Principle

Every override must answer three questions before it is added:

1. **What does Crepe already render?**
   Inspect Crepe source CSS and actual DOM/class names first. Example: lists are not just browser `ol > li`; Crepe has `.milkdown-list-item-block`, `.label-wrapper`, and `.children`.

2. **Why is an override needed?**
   The override should fix a concrete mismatch: wrong base font, bad alignment, excessive spacing, incorrect token, broken control chrome, or default Crepe theme leaking into app UI.

3. **Which design token owns the final visual?**
   The final CSS should use Reflecta tokens for color, radius, border, shadow, and state. Avoid hard-coded theme colors and avoid importing a full Crepe visual theme such as `@milkdown/crepe/theme/nord.css`.

---

## Design Token Policy

Source of truth:

- `apps/electron/src/renderer/src/style.css`
- shadcn-style UI components under `apps/electron/src/renderer/src/components/ui/`

Use these token families:

- **Surface and text:** `--background`, `--foreground`, `--popover`, `--popover-foreground`
- **Subtle surfaces:** `--muted`, `--muted-foreground`, `color-mix(...)` derived from those tokens
- **Borders:** `--border`, `--input`, `--ring`
- **Accent and selection:** `--primary`, `--primary-foreground`, `--accent`, `--accent-foreground`
- **Radius:** `--radius-sm`, `--radius-md`, `--radius-lg`, or `min(var(--radius-md), 8px)` when the component should stay compact
- **Shadow:** prefer system-like low elevation. For floating editor controls use a local CSS variable derived from foreground transparency or match the app's `shadow-xs`/popover feel. Do not invent large decorative shadows.

Token usage rules:

- Text blocks should not use raw hex colors except for syntax highlighting where a third-party grammar already owns token colors.
- Borders should use `var(--border)` or a `color-mix` based on it.
- Inline elements use smaller radii than block containers.
- Code blocks, media, tables, and toolbar popovers may have radius; plain document sections should not look like cards.
- Avoid card-in-card visuals inside nested markdown.
- Hover/active states for toolbar/menu controls use `--accent`, `--muted`, `--primary`, and `--ring`, not Crepe theme defaults.

---

## Canonical Fixture

Use `apps/electron/src/renderer/src/modules/shared/components/demo.md` as the complete markdown coverage fixture.

It currently covers:

- H1-H6
- paragraph text
- bold, italic, bold italic, strikethrough
- inline code
- blockquote and nested blockquote
- unordered list
- ordered list
- nested list
- task list
- links and autolinks
- images and linked images
- fenced code blocks with multiple languages
- tables and alignment
- horizontal rules
- escaped markdown characters
- math-like markdown
- footnote-like markdown
- definition-list-like markdown
- nested composite blockquote containing heading, list, code, and table

When a markdown category is added to the editor, add it to `demo.md` first or explicitly document why it is not part of editor styling.

---

## Block-By-Block Review Checklist

For every block below, follow the same workflow:

1. Read relevant Crepe source CSS under `@milkdown/crepe/theme/common`.
2. Identify the actual selector and DOM shape used by Crepe.
3. Compare against `demo.md` visual intent and Reflecta tokens.
4. Add only the scoped override needed under `.reflecta-md-editor`.
5. Add or update non-visual verification for the selector and token usage.

### 1. Root And Base Typography

Confirm:

- Which Crepe reset rules set font size and line height.
- Whether any block overrides paragraph text back to `16px`.
- Whether readonly preview inherits the same editor base.

Design target:

- Body text baseline is `14px`.
- Paragraph rhythm is compact and note-oriented, not document-editor spacious.
- Font family follows the app, not Crepe visual theme fonts.

Verification:

- Static test proves Crepe visual themes are not imported.
- Static test proves paragraph and root selectors override Crepe's `16px` paragraph reset.

### 2. Headings

Confirm:

- Crepe heading selectors and their default large document sizes.
- Whether heading margins cause excessive gaps in `demo.md`.

Design target:

- H1-H3 provide hierarchy but remain appropriate inside an app panel.
- H4-H6 should not jump back to browser/root `16px` if the base is `14px`.
- Heading font uses the app font and foreground token.

Verification:

- Static test checks heading selectors exist and do not rely only on inherited Crepe defaults.
- Manual code review confirms no full Crepe title font token is reintroduced.

### 3. Inline Text And Links

Confirm:

- Crepe inline code styles.
- Link preview/edit overlay classes are separate from link text.
- Wiki link classes from local extension.

Design target:

- Links use primary token and app underline behavior.
- Inline code uses muted surface, compact radius, and code font.
- Wiki link chips should not increase line height or look like large buttons.

Verification:

- Static test checks inline code, link, and wiki-link selectors use app tokens.
- Demo fixture contains normal links, title links, autolinks, reference links, and wiki links should be added if missing from `demo.md`.

### 4. Blockquote

Confirm:

- Crepe reset uses `blockquote::before`.
- Nested blockquote DOM remains regular nested blockquote.

Design target:

- Single subtle left border.
- No duplicated pseudo bars.
- No filled card background.
- Nested blockquotes remain compact.

Verification:

- Static test checks `blockquote::before` is neutralized.
- Static test checks blockquote border/background use app tokens or transparent background.

### 5. Lists

Confirm:

- Crepe's actual list DOM from source and runtime inspection.
- Difference between bullet, ordered, nested, and task list structures.
- Whether task list uses native checkbox, Crepe label wrapper, or both.

Design target:

- Marker and text align on the same baseline.
- Nested list indentation is predictable and not overly wide.
- Ordered list markers stay readable but muted.
- Task checkboxes align with text and use app primary/accent color.

Verification:

- Static test checks `.milkdown-list-item-block`, `.label-wrapper`, label content, and list paragraph selectors are present.
- Static test checks native fallback `ul/ol/li` selectors are still present.
- Static test checks task checkbox selector is present.
- The test should fail if someone only styles `ol/li` and misses Crepe's real list DOM.

### 6. Media

Confirm:

- Crepe image block and inline image classes.
- Video paste support output shape from the editor adapter.

Design target:

- Media stays within content width.
- Media can use system border/radius, but should not become a decorative card.
- Readonly preview still supports medium zoom; zoom behavior is not part of CSS override.

Verification:

- Static test checks image/video selectors are scoped to `.reflecta-md-editor`.
- Unit tests for paste/upload behavior remain separate from theme tests.

### 7. Code Blocks

Confirm:

- Crepe code block wrapper classes.
- CodeMirror classes for content, gutter, active line, active gutter, language tools, and toolbar buttons.

Design target:

- Code body is compact and readable.
- Active line/gutter should not produce a dark square or unrelated highlight.
- Language/tool buttons use app border, radius, and muted foreground.
- Syntax colors can remain from CodeMirror where appropriate, but chrome must match system.

Verification:

- Static test checks `.milkdown-code-block`, `.cm-content`, `.cm-gutters`, `.cm-activeLine`, `.cm-activeLineGutter`, and `.cm-gutterElement.cm-activeLineGutter`.
- Static test checks code block chrome uses `--border`, `--muted`, `--background`, or derived token mixes.

### 8. Tables

Confirm:

- Crepe table wrapper and cell selectors.
- Table drag/handle selectors that should remain interactive in editable mode.

Design target:

- Dense table suitable for notes.
- Borders use app border token.
- Header background uses muted surface token.
- Cell padding should be compact.
- Preview may scroll horizontally.

Verification:

- Static test checks table wrapper, table, th/td, and header selectors.
- Static test checks no large fixed padding from Crepe remains as the effective override.

### 9. Horizontal Rule

Confirm:

- Crepe reset uses padded HR with visual height.

Design target:

- A simple single-line divider.
- Uses `--border`.
- Spacing is enough to separate sections but not a thick band.

Verification:

- Static test checks HR height/padding/background override.

### 10. Math, Footnotes, Definition Lists

Confirm:

- Whether current Crepe setup renders these as specialized nodes or plain fallback text.
- Whether any plugin is actually enabled for these blocks.

Design target:

- If unsupported, fallback text must still follow base typography.
- If later enabled by official plugin, add plugin-specific DOM to this plan and to `demo.md`.

Verification:

- Static test guards against unsupported fallback text leaking to 16px.
- No custom renderer should be added just for styling.

### 11. Nested Composite Blocks

Confirm:

- Behavior of `demo.md` nested blockquote containing heading, list, code, and table.

Design target:

- Nested blocks reuse their base styles.
- Parent blockquote only adjusts containment spacing.
- No nested cards or heavy shadows inside markdown content.

Verification:

- Static tests cover selectors used by nested blocks.
- Manual review verifies nested-specific overrides are limited and justified.

### 12. Floating Controls

Confirm:

- Crepe toolbar, slash menu, link preview, link edit, block handle, code tools, and table handles.
- Which controls should be hidden in readonly preview.

Design target:

- Floating controls look like app popovers.
- Radius follows `--radius-md` or compact min-radius patterns.
- Shadow is low elevation and consistent with app popover usage.
- Buttons are icon-sized and token-driven.
- Readonly preview hides editing controls.

Verification:

- Static test checks toolbar/menu/link popover selectors use `--popover`, `--popover-foreground`, `--border`, radius token, and system shadow.
- Static test checks readonly preview hide selectors still exist.

---

## Implementation Phases

### Phase 1: Source Audit

- [ ] Read Crepe common theme CSS files relevant to every `demo.md` block:
  - reset
  - list item
  - code mirror
  - table
  - toolbar
  - link tooltip
  - block edit
  - image
- [ ] Record the real selector ownership for each block in a short markdown table inside the plan or a companion note.
- [ ] Remove any assumption-based override from the candidate CSS if its selector cannot be tied to Crepe source or runtime DOM.

Exit criteria:

- Every override target has a source-backed selector.
- Lists are explicitly documented as Crepe list blocks, not just native `ol/li`.

### Phase 2: Design-System Mapping

- [ ] Map each visual property category to Reflecta tokens:
  - text color
  - muted text
  - surface
  - border
  - selection
  - hover
  - focus ring
  - radius
  - shadow
- [ ] Decide which markdown blocks should have structural chrome:
  - code blocks
  - tables
  - media
  - floating controls
- [ ] Decide which markdown blocks should remain document-like:
  - paragraphs
  - headings
  - lists
  - blockquote
  - horizontal rule

Exit criteria:

- No raw visual color is introduced unless it is syntax highlighting.
- Radius and shadow decisions are documented by component type, not copied ad hoc.
- Full Crepe visual themes are not imported.

### Phase 3: CSS Organization

- [ ] Reorganize `milkdown-theme.css` by responsibility:
  - imports
  - Crepe token bridge
  - editor surface
  - base typography
  - headings
  - inline content
  - lists
  - blockquote and divider
  - media
  - code
  - tables
  - wiki links
  - floating controls
  - readonly preview
- [ ] Keep selectors scoped under `.reflecta-md-editor`.
- [ ] Prefer lower-complexity selectors unless Crepe source requires specificity.
- [ ] Use `!important` only when overriding Crepe reset or third-party inline-ish state rules that cannot otherwise be won cleanly.

Exit criteria:

- The CSS file reads as a theme layer, not as a patch pile.
- Each section maps to a `demo.md` block group.

### Phase 4: Non-Visual Verification

- [ ] Add a CSS contract test that reads `milkdown-theme.css`.
- [ ] Assert full Crepe visual themes such as `nord.css` are not imported.
- [ ] Assert required selector groups exist for each `demo.md` block category.
- [ ] Assert design-token usage for critical chrome:
  - border token on code/table/media/popovers
  - popover token on floating controls
  - radius token or compact radius pattern on chrome
  - system shadow variable/pattern on floating controls
- [ ] Assert known Crepe defaults are covered:
  - paragraph `16px`
  - blockquote pseudo bar
  - list label wrapper dimensions
  - HR padded band
  - CodeMirror active gutter

Exit criteria:

- The test catches the classes of regressions seen in screenshots without using Playwright or Computer Use.
- The test does not attempt pixel-perfect rendering; it verifies ownership and token alignment.

### Phase 5: Final Review

- [ ] Read `demo.md` top to bottom and confirm every block has a corresponding CSS ownership decision.
- [ ] Run focused editor tests.
- [ ] Run lint.
- [ ] Run typecheck only to record repo baseline; do not fix unrelated typecheck errors in this styling task.
- [ ] Summarize remaining intentionally unsupported markdown blocks, especially math, footnotes, and definition lists.

Exit criteria:

- Every block in `demo.md` is either styled by Crepe with acceptable defaults, styled by the override layer, or explicitly marked unsupported/fallback.
- Final notes explain why each override exists and which design token family it follows.

---

## Verification Strategy Without Playwright Or Computer Use

Use these checks:

1. **CSS source contract**
   - Reads `milkdown-theme.css`.
   - Checks required selectors exist.
   - Checks known Crepe defaults are explicitly overridden.
   - Checks no full Crepe visual theme import is present.

2. **Design token contract**
   - Checks styling for borders, surface, popover, radius, shadow, hover, and selection references Reflecta tokens or documented derived `color-mix(...)`.
   - Fails when new hard-coded visual colors are added outside syntax highlighting.

3. **Demo coverage contract**
   - Reads `demo.md`.
   - Checks canonical block headings still exist.
   - Forces future markdown block additions to update either `demo.md` or the styling contract.

4. **Existing behavior tests**
   - Keep editor behavior and preview behavior tests separate from theme contract tests.
   - Theme tests should not instantiate the full editor unless a selector cannot be reasoned about from source.

---

## Deliverables

- A cleaned `milkdown-theme.css` organized by markdown block and control type.
- A short source-audit note or table mapping `demo.md` block category to Crepe selector ownership.
- A non-visual CSS contract test that guards selector coverage and token usage.
- A final explanation listing:
  - which Crepe defaults were intentionally overridden
  - which Reflecta token family each override follows
  - which markdown features remain fallback/unsupported

---

## Self-Review

Spec coverage:

- Follow design token for radius/shadow/color/border: covered in Design Token Policy and Phase 2.
- Do not prescribe concrete implementation logic: plan now describes workflow, ownership, and verification rather than fixed CSS snippets.
- Required process “翻源码 -> 确认覆盖逻辑 -> 对齐 design system”: encoded in Guiding Principle, Block-By-Block Review Checklist, and Phases 1-3.
- Use `demo.md` as full markdown fixture: covered in Canonical Fixture and Demo Coverage Contract.
- No Playwright or Computer Use: covered in Verification Strategy.

Placeholder scan:

- No placeholder markers remain.

Risk:

- Static CSS tests cannot prove exact pixels. They are intended to prevent the specific regression class here: wrong selector ownership, Crepe default leakage, and token drift.
