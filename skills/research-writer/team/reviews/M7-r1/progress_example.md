# PRL discussion-logic extraction — progress

- Updated: 2026-01-29T00:35:59.043023+00:00
- Out: `/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/discussion_logic`
- Corpus: `/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/prl_style_corpus_fixture`
- INSPIRE query: `fixture`
- Total papers: **1**
- Packs present: **1/1**
- Dual-model complete: **1/1**

## Last run

- processed=1 errors=0 skipped_existing=0 skipped_no_main_tex=0

## Batch summary (N=10)

| batch | ranks | packs | dual-model |
|---:|:---:|:---:|:---:|
| 1 | 1-1 | 1/1 | 1/1 |

## Missing outputs

- Missing Claude: 0
- Missing Gemini: 0
- Missing both: 0

## Next up (first 10 not complete)

- (none)

## Continue

Repair missing model outputs:

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py --out-dir "/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/discussion_logic" --corpus-dir "/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/prl_style_corpus_fixture" --mode repair --n 10 --resume --run-models
```

Add the next batch:

```bash
python3 scripts/bin/research_writer_learn_discussion_logic.py --out-dir "/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/discussion_logic" --corpus-dir "/private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.iC3wRhvrdu/prl_style_corpus_fixture" --mode new --n 10 --resume --run-models
```
