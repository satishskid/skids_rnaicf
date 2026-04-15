# Bundled fonts

Subsetted Noto fonts inlined into the Worker bundle. Satori requires raw
TTF/OTF/WOFF (no WOFF2), so these stay uncompressed on disk and rely on
Worker-time gzip for over-the-wire compression.

## Current bundle

| File | Script(s) | Raw | Gzipped |
|---|---|---|---|
| `NotoSans-Regular.subset.ttf` | Latin + Latin-1 supplement + common punctuation | ~35 KB | ~20 KB |
| `NotoSans-Bold.subset.ttf` | same | ~35 KB | ~21 KB |
| `NotoSansDevanagari-Regular.subset.ttf` | Devanagari U+0900–U+097F + ZWJ/ZWNJ + dotted-circle | ~156 KB | ~62 KB |
| `NotoSansDevanagari-Bold.subset.ttf` | same | ~155 KB | ~64 KB |
| **Total** |  | **~381 KB** | **~167 KB** |

Worker bundle limit is 10 MB compressed (paid plan). Font budget for the
starter set is **< 1 MB compressed**; current usage is ~17%.

## Locales covered

- `en` — Latin (Inter-style fallback via Noto Sans)
- `hi` — Devanagari (Hindi); also covers Marathi (`mr`) on the same script

Other Indian scripts (Tamil, Bengali, Telugu, Kannada, Malayalam, Gujarati,
Gurmukhi) ship in commits 3c+ once rollout order is finalised.

## Subset strategy

- Latin fonts include **printable ASCII (U+0020–U+007E)**, **Latin-1
  supplement (U+00A0–U+00FF)**, and a small set of **general punctuation**
  glyphs (em/en dashes, smart quotes, bullets, ellipsis, ₹).
- Devanagari fonts include the **full Devanagari block (U+0900–U+097F)**
  plus **ZWJ/ZWNJ** and **dotted-circle (U+25CC)** for proper conjunct
  rendering. ASCII is included so mixed Hindi+English strings (e.g.
  campaign codes inside Hindi text) render with a single font fallback.
- Hinting is stripped (`--no-hinting`) and CFF subroutines are flattened
  (`--desubroutinize`) — both knock ~30% off raw size with no perceptible
  quality loss at the sizes used in the templates (9–18 px).

## Regenerating

Source TTFs come from the upstream Noto repos:

- `NotoSans-Regular.ttf` / `NotoSans-Bold.ttf`
  https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/full/ttf/
- `NotoSansDevanagari-Regular.ttf` / `NotoSansDevanagari-Bold.ttf`
  https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSansDevanagari/full/ttf/

```sh
# Requires: pip install fonttools brotli
LATIN="U+0020-007E,U+00A0-00FF,U+2010-2015,U+2018-201F,U+2022,U+2026,U+2030,U+2039-203A,U+20B9"
DEV="U+0020-007E,U+0030-0039,U+0900-097F,U+200C-200D,U+25CC"

for f in NotoSans-Regular NotoSans-Bold; do
  pyftsubset "$f.ttf" --unicodes="$LATIN" --layout-features='*' \
    --no-hinting --desubroutinize --output-file="$f.subset.ttf"
done

for f in NotoSansDevanagari-Regular NotoSansDevanagari-Bold; do
  pyftsubset "$f.ttf" --unicodes="$DEV" --layout-features='*' \
    --no-hinting --desubroutinize --output-file="$f.subset.ttf"
done
```

Drop the resulting `*.subset.ttf` files into this directory.

## Adding a new script

1. Pick the script's Unicode block (e.g. Tamil = U+0B80–U+0BFF).
2. Run `pyftsubset` against the upstream `NotoSans<Script>-Regular.ttf` /
   `NotoSans<Script>-Bold.ttf` with `U+0020-007E,U+0030-0039,U+200C-200D,U+25CC`
   plus the script block.
3. Add the font to `index.ts`'s locale map.
4. Re-measure gzipped total and update the table above. If it crosses
   500 KB compressed, drop the bold weights and lean on satori's algorithmic
   faux-bold (slight quality hit, major size win).
