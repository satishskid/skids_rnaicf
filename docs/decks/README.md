# Decks

Presentations for the SKIDS platform, authored in [Marp](https://marp.app) markdown.

## Files

| File | Purpose |
|---|---|
| `edge-stack-v1-release.md` | Source — edit here. Marp markdown with inline CSS theme. |
| `edge-stack-v1-release.pptx` | Generated — hand to business / clinical leadership. |
| `edge-stack-v1-release.pdf` | Generated — printable / email-friendly. |
| `edge-stack-v1-release.html` | Generated — shareable link, works in any browser. |

## Rebuild

```sh
# One-time: install marp-cli globally
npm install -g @marp-team/marp-cli

# From repo root:
cd docs/decks
marp edge-stack-v1-release.md --pptx --allow-local-files
marp edge-stack-v1-release.md --pdf  --allow-local-files
marp edge-stack-v1-release.md --html --allow-local-files
```

## Why Marp (not pptxgenjs)

- Content and styling are readable in one `.md` file — easier to review in a PR.
- Three output formats from one source (pptx / pdf / html) — no duplicate pipelines.
- Works with `git diff` cleanly; binary outputs are the rebuilt artefact.
- No Node build dependencies beyond `marp-cli` itself.

## Visual QA

```sh
# Render + convert to per-slide images:
pdftoppm -jpeg -r 120 edge-stack-v1-release.pdf slide
# Inspect each slide-NN.jpg, then delete:
rm -f slide-*.jpg
```
