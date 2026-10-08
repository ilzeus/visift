# Visift

Turn image text into **an integrated article, structured notes, or a field table**, or transcribe it verbatim in image order. Output goes to the conversation by default, with Markdown-file export on explicit request.

> 中文文档：[README.md](README.md) · 同一份说明的中文版，小节逐条对应

The skill is pure prompt logic: `SKILL.md` routes and `references/` holds four detail documents in an [Agent Skills](https://agentskills.io) layout. Image reading and requested exports use the host’s existing capabilities; the skill bundles no runtime scripts or dependencies. `scripts/check-skill.mjs` is a development quality gate, not part of image processing.

## What problem it solves

For default organization tasks, the rules address these five types of problems:

| Habitual failure | What this skill does instead |
| --- | --- |
| Ask to integrate multiple images but receive separate per-image sections | Build a content inventory and integrate it into the selected article, notes, or table; strict transcription separately preserves source order |
| Transcribe every character on the image, so watermarks, account names and platform logos leak into the text | Preserve task-relevant text first, then use coherence and visual cues to exclude and log unrelated noise |
| The same point made three times in the images comes out three times | Delete fully covered entries only when conditions and attribution are compatible; retain complementary details, different versions, and conflicting statements |
| Recognize a few characters, then pad an essay with explanations the images never contained | Every knowledge point must be pointable at in a source image; if it can't be, delete it |
| Guess "the most natural wording" where the handwriting is blurry, without telling you | Check a clear copy of the same passage first; otherwise fill only 1–2 uniquely supported non-factual characters, with markers and a record |

## Scope

**Supported**: screenshots, photos, scans, photographed slides and whiteboards, UI text, tables and code blocks inside documents, text elements inside charts, and merging many images into one article.

**Not supported** (refused explicitly rather than attempted anyway):

- Video and animated GIF
- Purely decorative images and illustrations with no text
- Fragmentary content that only makes sense with outside knowledge
- Identifying objects, people, or scenes in an image

## Install

Copy the whole `visift/` directory into your agent's skills directory, then reload skills or start a new session.

| Agent | Project-level path |
| --- | --- |
| Codex | `.agents/skills/` |
| Qoder | `.qoder/skills/` |
| Claude Code | `.claude/skills/` |
| Generic | Whatever that agent's docs specify |

The local Codex session discovers the skill through `.agents/skills/visift/`. This copy must remain byte-identical to the single source at `visift/`; `scripts/check-skill.mjs` enforces that.

## Usage

Load it, send images, and ask in plain language:

```
把这些截图整理成一篇内容
Extract the text from these screenshots and merge it into one article
Turn these 10 lecture slides into a single set of notes
```

You can choose a body form, request body text without an editor’s note, retain per-item sources, or save a Markdown file. An explicit request for another language is treated and declared as a translated draft.

## Output forms

Choose the body form from the request, with an integrated article as the default. See [output selection and delivery](visift/references/image-types.md) for detailed rules.

| Form | Requested intent | Handling |
| --- | --- | --- |
| Integrated article (default) | Organize into one article, integrate the content | Group original sentences by topic or flow, retaining necessary lists, tables, and code |
| Structured notes | Make notes, use bullets, organize by hierarchy | Use source headings and sentences, preserving conditions, examples, and exceptions without default summarization |
| Field table | Arrange names, prices, or other fields in a table | Use requested or source-supported fields without mixing objects, times, versions, or conditions |
| Strict transcription | Transcribe verbatim, copy as written, extract fully in original order | Preserve all visible text in the specified region, or the whole image if none is specified; no filtering, deduplication, or inferred fills |

Articles, notes, and tables share one verified content inventory; changing layout does not trigger summarization. Strict transcription is a separate processing mode; “extract text” alone does not select it.

In field tables, use `（空）` for a visibly empty source cell, `[无法辨认]` for unreadable content, and `[内容被截断]` for cropping. Leave requested fields absent from the source empty and record them under missing fields, not recognition gaps.

The shared structure is “source title (optional) → body → separator → editor’s note”. Include only actual processing items; omit the whole note when there are none and sources were not requested. Locate relevant gaps, verification, differences, and missing fields.

## Delivery

| Request | Delivery |
| --- | --- |
| Only “organize this for me” | Show Markdown directly in the conversation without creating files automatically |
| Explicitly save, export, or provide a Markdown file | Create UTF-8 `.md` when the host can write files, read it back to verify, then return a link and a short note |
| Change only the delivery method | Reuse the existing body and notes without rewriting or repeating the file’s full text in the conversation |

Use the requested path, or the available output directory for the current task. Keep old versions with a non-conflicting filename unless explicitly asked to update an existing file. Without file-writing capability, provide copyable Markdown and state that no file was created.

This version defines conversation and Markdown-file delivery. HTML and JSON remain future directions; saving does not authorize website publishing.

## Upload batches and later edits

See [upload batches and later edits](visift/references/dedup-and-rewriting.md) for collection, continuation, and revision rules.

- When the user says they are still uploading or asks to wait, acknowledge only the received range; process after “all uploaded” or “start”. Otherwise, process directly.
- Keep image numbering stable across messages in the same batch, tracking processed and pending ranges and gap locations; retain the selected body form and delivery method.
- Split according to text density, table or code complexity, topic boundaries, and expected length. Wait for “continue” between conversation batches; deliver a complete file directly when it can be generated.
- Classify cross-image relations for new content and repair only the matching gaps with clearer images; preserve other finalized wording and order when the user requests a local edit.
- Conversation replies may show only local changes; files remain complete revised documents unless a fragment file is explicitly requested. State missing access to original images or prior full text instead of reconstructing from memory.
- Do not claim earlier messages were edited. Record later coverage or conflicts as pending integration, apply them when producing the complete version, and check for unprocessed images.

## Gap filling (why this doesn't become "AI freestyling")

When no visible source can resolve a gap, inferred filling requires **all four conditions at once**: only 1–2 non-factual characters are missing, they belong to a functional expression or recurring source phrase, meaning and scope stay unchanged, and context supports exactly one candidate. Do not fill whole content words or sentences.

Never infer numbers, units, amounts, times, dates, people, places, institutions, product names, versions, proper nouns, negations, conditions and degree words (if / must / only / may / not), conclusions, or comparisons. Without a readable source, use `[无法辨认]` or `[内容被截断]` according to the cause.

Fill and mark only a unique candidate that meets every condition, recorded as high confidence. A second reading means no fill; there is no medium-confidence exception for a neutral word. Never infer text cut off at an image edge.
Record each inferred fill, its location, and its evidence. Cross-image verification against visible text is logged separately and does not use `〔〕`. See the [gap and verification rules](visift/references/gap-filling.md).

## How noise text gets excluded

Determine relevance to the task first: tutorial buttons, discussion speakers and necessary times, and explicitly requested copy are content; page numbers may serve as internal location cues. Then apply **coherence** to the remaining text: is it part of the sentence or a layer pressed on top?

Take this lecture screenshot:

```
Title (dark block, white bold): 9. 获取源代码和二次开发
Semi-transparent signature pressed over the right side of the title: account name + bilibili logo
Bubble text below: 安装所需要的依赖，以便我能运行项目！
```

The content is "9. 获取源代码和二次开发 —— 安装所需要的依赖，以便我能运行项目！".
The string pressed on top of the title, set at a different size and carrying a platform logo, is a **watermark**: exclude it, don't explain who it belongs to, don't add any background about that account.

For text unrelated to the task, consider these cues in order; two matches are needed to classify it as noise:

1. **The same string recurs across multiple images** (still distinguish table headers, steps, and necessary notices)
2. **Wrong visual layer**: semi-transparent, outlined, pressed above the subject, glued to a corner
3. **Semantically incoherent with its surroundings**: it doesn't read as part of a sentence

Potential noise includes watermarks, platform marks, overlays, UI elements, headers and footers, QR prompts, and promotional copy. Category alone does not justify deletion; preserve uncertain items and note the uncertainty. See the [noise rules](visift/references/interference-text.md).

Two details worth calling out:
- An illegible watermark **does not consume a gap slot** (`[无法辨认]` is reserved for body content) — it goes straight to "not adopted".
- The exclusion must be recorded in the trailing "not adopted" list, so the filtering is auditable rather than silent.

## Cross-image integration and gap repair

Cross-image comparison and repair follow the [cross-image rules](visift/references/dedup-and-rewriting.md) and [gap verification rules](visift/references/gap-filling.md), respectively.

| Situation | Handling |
| --- | --- |
| Duplicate or fully covered entry | Delete one only when object, conditions, and attribution are compatible and its information is fully covered |
| Complementary details on one topic | Group by topic while preserving each original sentence and unique detail |
| Different versions or statements | Retain different conditions separately; preserve both sides of a conflict or unclear conditions and locate the difference in the note |
| Different legibility of one passage | Confirm the same version and passage with matching visible text, then copy the clear original and record its source |

Numbers and dates visible in the clear image may be transcribed verbatim. A similar template or later upload does not justify filling another version's gaps, and two unreadable areas must not be combined into a guess.

The internal inventory keeps image number, region, nearby original text, and disposition for each item. Gap, difference, and verification notes provide necessary locations by default; a complete source table remains available only on request.

A location could be “image 3, second bubble in the middle, amount obscured after ‘预算’”. Use local inspection for a doubtful area when the host supports it; if still unclear, keep the gap and request a clear image of that location only.

Once a new image is confirmed to match, repair that location, update current gap counts and fill records, and retain the verification source. Update the complete result in the selected form and delivery method by default; conversation replies may show only the requested local edit, while files remain complete revised documents. Preserve other finalized wording.

## Layout

```
visift/
├── README.md                          # human-facing doc, Chinese original
├── README_EN.md                       # this file — same sections, one-to-one with README.md
├── AGENTS.md                          # rules for any AI working inside this repo
├── CLAUDE.md                          # signpost: Claude Code only reads that filename
├── scripts/
│   └── check-skill.mjs                # development quality gate, never part of execution
├── evidence/
│   └── README.md                      # naming and format of run records
└── visift/
    ├── SKILL.md                       # entrypoint: modes and triggers, 8 steps, delivery routing, self-check
    └── references/                    # detail documents, loaded on demand
        ├── image-types.md             # output forms and template, Markdown delivery, 9 image-type rules
        ├── interference-text.md       # noise-text decision table + the three easiest misreads
        ├── dedup-and-rewriting.md     # cross-image relations, deduplication, upload batches, and later edits
        └── gap-filling.md             # gap locations, clear-source verification, unique fills, and later repairs
```

`SKILL.md` carries only routing and hard constraints; the detail lives in `references/`, and the entrypoint says in one line when to load which file. That keeps the entrypoint under 160 lines, so a short task never has to wade through every long rule.

## Quality gate

```
node scripts/check-skill.mjs
```

Zero dependencies, Node standard library only. It checks:

- frontmatter contains only `name` and `description`; `name` matches the directory name and is hyphen-case
- `description` is non-empty, single-line, ≤1024 characters **and** ≤1024 bytes (some runtimes truncate by bytes, and CJK costs three bytes per character)
- `description` still contains every trigger word (图片 / 整理 / 水印 / 干扰 / extract / transcribe / OCR / screenshot) — drop one and you lose host-side matches without ever seeing a symptom
- `SKILL.md` ≤160 lines; no TODO / FIXME / 待补充 / 占位
- every `references/…` path cited in `SKILL.md` actually exists (renames don't leave dead links)
- reverse check: a file in `references/` the entrypoint never mentions is dead weight the agent will never load
- the `.agents/skills/` install copy is byte-identical to the source and holds no stale extra files

Any FAIL exits 1, so this drops straight into CI.

## Test cases

The nine existing cases below target default article organization. Expected behavior is not an observed result or a passing record for the new output forms or file delivery.

| # | Case | Input | Expected behavior | Pass criteria |
| --- | --- | --- | --- | --- |
| 1 | Many images into one article | 5 screenshots on one topic (chat log + 3 tip bubbles + 1 table) | Output is a topic-organized continuous article; no "Image 1 / Image 2" blocks in the body | Any per-image sectioning = fail; meta info only allowed after the separator |
| 2 | Plain text screenshot | A 5-line text notification, including status bar and clock time | The 5 lines enter the body with wording untouched; status bar and time go to "not adopted" | No new sentences; no rewriting; no invented heading hierarchy |
| 3 | Technical doc with heading levels | One photographed page: 1 H1, 2 H2, a 3-row table, 1 code block | Heading levels map correctly; table rows and columns complete; code transcribed character for character including indentation | 0 missing table cells; units and version numbers not rounded; item count matches the original |
| 4 | Handwritten notes + occluded gaps | Photo of handwritten minutes, 3 illegible spots, one missing a connective | Fill and mark `〔〕` only when every condition holds and the missing characters are uniquely supported; the rest `[无法辨认]`; evidence listed at the end | Unregistered fill = fail; filling any factual content (number / conclusion) = fail |
| 5 | Watermark and noise text | Lecture screenshot: title 「9. 获取源代码和二次开发」 + semi-transparent signature and platform logo pressed over it + bubble text | Body carries only the title and bubble content; signature and logo counted under "not adopted" | Watermark text appearing in the body = fail; adding account background = fail; marking an illegible watermark `[无法辨认]` = fail |
| 6 | Factual gap must not be filled | An amount blocked by the cursor: 「预算 12＿ 元」 | Output 「预算 12`[无法辨认]` 元」 — no guessing 0 / 00 / 5 | Any guessed digit = fail |
| 7 | Text inside a chart | Bar chart screenshot: title, two axis labels, legend, 4 data labels | Text transcribed into the article; no description of bar heights, no trend inference | Any inference word (rising / falling / indicates / shows) = fail |
| 8 | Image with no text | A landscape photo, or a pure icon illustration | Reply "there is no extractable text in these images", optionally stating the supported scope | Any visual description = fail |
| 9 | Long text with repetition | A long-form article stating one point three times, each worded more fully | Keep the most complete statement in a single position, delete the other two and count them | No splicing fragments into a new sentence; no unique detail lost; that point appears exactly once in the body |

Optional regression cases: vertical and multi-column layouts, preserving the original typo with `[原文如此]`, content cut off at the image edge, and attaching a source table only when the user asks for traceability.

### Test results

**Not yet recorded per case.** The table above is designed cases and expected behavior. The examples in this README did come from real runs on real screenshots, but those runs were never scored against the nine pass criteria below, so they are not a record of passing — do not treat any row as passing.

### Run protocol

A run counts as a checkable record only if all of the following hold:

1. One group of images, one fixed request: "organize these into one article, merge the repeats, mark what you can't read".
2. Record the agent name, model name, date, and `SKILL.md` line count at the time — a different version is a different experiment and must not be pooled into the same statistics.
3. **Freeze the first output verbatim.** Nothing may be edited afterwards, not even a manual fix; corrections get a separate record labelled as a later attempt.
4. Score every row of the pass criteria as "pass / fail + what was observed", paying most attention to the fail conditions of cases 4, 5, 6 and 8 — those guard the anti-fabrication and noise-filtering floor.
5. Read the output straight through and judge the writing: article or per-image checklist? A checklist means step 7 (按所选形式组织正文) needs strengthening.
6. Do not write "overall pass" until all nine groups have run; report only what has actually run.
7. Deliberately broken samples built to test the criteria prove the criteria work — they are not the skill's score.

When results go into the table, keep "expected" and "observed" as separate columns; observed results never overwrite the expectation.

### evidence/

Each run gets one file: `evidence/tc<case>-<date>-<agent>-<model>.md`, containing in order the list of input images, the output verbatim, the per-criterion scoring, and the conclusion. The README states only the conclusion and links there — no unsourced claims that it "works well".

## Design tradeoffs

- **Organize without inventing**: articles, notes, and tables change structure only, without new concepts, elevated conclusions, or added summaries; strict transcription preserves source order.
- **Delete only, never rewrite**: dedupe means dropping whole redundant statements. Never merge two sentences into one "better" one — merging is a form of fabrication.
- **Every fill leaves a trace**: supplied characters go inside `〔〕` with their evidence registered, so the line between "organized" and "rewritten" stays visible to the reader.
- **Every exclusion leaves a trace**: preserve task-relevant text first; excluded unrelated watermarks, UI elements, and promotions are counted by category under "not adopted", with no silent deletion.
- **A short output is a correct output**: when the images say little, the article is short, and the skill explicitly forbids padding to reach length.
- **No visual description**: this is a text-organizing tool, not an image-understanding one, and that boundary is stated at the very front of the workflow.
- **The body is never translated**: article language follows the source images — Chinese in, Chinese out; English in, English out. Meta info, refusals, and gap notes use the language of the conversation with the user, which may differ. Asking for another language is a translation request, and the whole piece then gets declared a translated draft.
- **When rules conflict**: fidelity > readability > brevity. Length is what you sacrifice, never fidelity.

## Conventions

- YAML frontmatter uses only the open-spec fields `name` and `description`, with no dependency on any vendor-specific field.
- `description` is written as a trigger condition ("Use when …"), on a single line.
- Annotation tokens are fixed at five: `[无法辨认]`, `[内容被截断]`, `[原文如此]`, `〔〕`, `（空）`. No inventing new markers.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
