# research-writer — M0-r2 Review Packet (PRL style corpus workflow)

Milestone goal: add an optional, auditable workflow to expand the writing-style corpus using PRL papers (Guo / U.-G. Meißner / M. Hoferichter) by fetching arXiv LaTeX sources via INSPIRE.

## Acceptance criteria
- Documents a PRL-focused style corpus source and how to fetch it.
- Adds a best-effort fetch script that is network-robust and writes an audit trace log.
- Updates the style profile with PRL/letter tactics and points to the corpus workflow.
- Smoke tests still pass.

## Evidence

### Smoke test output
```text
[smoke] help: scaffold CLI
[smoke] help: bibtex fixer
[smoke] help: double-backslash fixer
[smoke] help: PRL style corpus fetcher
[smoke] scaffold: fixture project -> paper/
[ok] patched 1 @article entry(ies) by adding journal="" (e.g. Bezanson2017)
[ok] research-writer scaffold complete
- project root: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.DCtvSfRfpQ/project
- tag: M2-smoke
- out: /private/var/folders/8q/y82gg9g93mxff1x7gx7w4pl40000gn/T/tmp.DCtvSfRfpQ/paper
[smoke] markdown double-backslash check: generated paper + skill assets
[smoke] latexmk: compile paper
[smoke] bibtex fixer: adds journal field
[smoke] double-backslash checker+fixer: markdown math only
[smoke] ok
```

---

## File: assets/style/prl_style_corpus.md
```markdown
# Optional style corpus: PRL papers (Guo / Meißner / Hoferichter)

If you want `research-writer` to better match the “PRL letter” voice (tight narrative, mechanism-first, concise), build a local style corpus from arXiv LaTeX sources of relevant PRL papers.

## Source (INSPIRE query)

- INSPIRE UI link (most recent PRL papers):  
  `https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true`

## Download arXiv sources (best-effort; logged)

```bash
python3 /Users/fkg/.codex/skills/research-writer/scripts/bin/fetch_prl_style_corpus.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
  --max-records 10 \
  --out-dir /tmp/prl_style_corpus
```

Outputs:
- `/tmp/prl_style_corpus/meta.json` — query + extraction configuration
- `/tmp/prl_style_corpus/trace.jsonl` — per-record success/failure log (network/DNS robust)
- `/tmp/prl_style_corpus/papers/<arxiv_id>/...` — extracted TeX/Bib/Sty sources (filtered by extension)

## Usage note (important)

This corpus is for learning **style and structure**, not for copying text. Do not paste paragraphs verbatim into new manuscripts.

```

## File: scripts/bin/fetch_prl_style_corpus.py
```python
#!/usr/bin/env python3
"""
fetch_prl_style_corpus.py

Fetch a PRL writing-style corpus via INSPIRE → arXiv LaTeX sources.

Primary use (FK/Meissner/Hoferichter PRL query):
  python3 fetch_prl_style_corpus.py \
    --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
    --max-records 10 \
    --out-dir /tmp/prl_style_corpus

Notes:
- Best-effort and network-robust: failures are logged to JSONL and the script continues.
- Output is a *local* corpus for style learning; do NOT copy text verbatim into new manuscripts.
- Extraction is filtered to TeX/Bib/Sty-style files by default to keep the corpus small.
"""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import tarfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote, urlsplit
from urllib.request import Request, urlopen


ALLOWED_HOSTS = {"inspirehep.net", "arxiv.org", "export.arxiv.org"}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _host_ok(url: str) -> bool:
    try:
        host = urlsplit(url).netloc.split(":", 1)[0].lower()
    except Exception:
        return False
    return host in ALLOWED_HOSTS


def _http_get(url: str, *, accept: str, timeout_s: int = 30) -> bytes:
    if not _host_ok(url):
        raise ValueError(f"refusing host not in allowlist: {url}")
    req = Request(url, headers={"Accept": accept})
    with urlopen(req, timeout=timeout_s) as r:  # nosec - intended for controlled metadata fetch
        return r.read()


def _safe_id(s: str) -> str:
    s = (s or "").strip()
    s = s.replace("/", "_")
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s)
    return s.strip("_") or "unknown"


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def _append_jsonl(path: Path, obj: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, sort_keys=True) + "\n")


def _parse_inspire_query(query_url: str | None, query: str | None) -> str:
    if query and query.strip():
        return query.strip()
    if not query_url:
        raise ValueError("either --query or --query-url must be provided")

    u = urlsplit(query_url)
    if not u.netloc:
        raise ValueError(f"invalid query url: {query_url!r}")
    qs = parse_qs(u.query)
    q_vals = qs.get("q") or []
    if not q_vals or not q_vals[0].strip():
        raise ValueError("failed to extract q=... from --query-url")
    return q_vals[0].strip()


def _inspire_api_url(query: str, *, size: int, page: int, sort: str) -> str:
    q_enc = quote(query)
    return f"https://inspirehep.net/api/literature?sort={quote(sort)}&size={int(size)}&page={int(page)}&q={q_enc}"


def _extract_arxiv_id(md: dict[str, Any]) -> str:
    eprints = md.get("arxiv_eprints")
    if isinstance(eprints, list):
        for e in eprints:
            if isinstance(e, dict) and isinstance(e.get("value"), str) and e["value"].strip():
                return e["value"].strip()
    return ""


def _extract_title(md: dict[str, Any]) -> str:
    titles = md.get("titles")
    if isinstance(titles, list) and titles:
        t0 = titles[0] if isinstance(titles[0], dict) else {}
        v = t0.get("title")
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def _extract_year(md: dict[str, Any]) -> str:
    for key in ("preprint_date", "legacy_creation_date", "created"):
        v = md.get(key)
        if isinstance(v, str) and len(v) >= 4 and v[:4].isdigit():
            return v[:4]
    pub = md.get("publication_info")
    if isinstance(pub, list) and pub:
        p0 = pub[0] if isinstance(pub[0], dict) else {}
        y = p0.get("year")
        if isinstance(y, int):
            return str(y)
        if isinstance(y, str) and y.strip():
            return y.strip()
    return ""


def _extract_doi(md: dict[str, Any]) -> str:
    dois = md.get("dois")
    if isinstance(dois, list):
        for d in dois:
            if isinstance(d, dict) and isinstance(d.get("value"), str) and d["value"].strip():
                return d["value"].strip()
    return ""


def _extract_authors(md: dict[str, Any]) -> list[str]:
    authors = md.get("authors")
    out: list[str] = []
    if isinstance(authors, list):
        for a in authors:
            if not isinstance(a, dict):
                continue
            name = a.get("full_name") or a.get("name") or ""
            if isinstance(name, str) and name.strip():
                out.append(name.strip())
    return out


def _safe_member_path(name: str) -> Path | None:
    """
    Safe relative path (reject absolute and .. traversal).
    """
    try:
        p = Path(name)
    except Exception:
        return None
    if p.is_absolute():
        return None
    if ".." in p.parts:
        return None
    return p


def _download_arxiv_source(arxiv_id: str) -> bytes:
    # arXiv source endpoint returns a tar(.gz) stream.
    url = f"https://arxiv.org/e-print/{quote(arxiv_id)}"
    return _http_get(url, accept="application/x-tar, application/octet-stream")


@dataclass(frozen=True)
class Record:
    recid: str
    title: str
    year: str
    arxiv_id: str
    doi: str
    authors: list[str]


def _iter_inspire_records(query: str, *, size: int, max_records: int, sort: str, trace_path: Path) -> list[Record]:
    out: list[Record] = []
    page = 1
    while len(out) < max_records:
        url = _inspire_api_url(query, size=size, page=page, sort=sort)
        try:
            raw = _http_get(url, accept="application/json")
            obj = json.loads(raw.decode("utf-8", errors="replace"))
        except Exception as exc:
            _append_jsonl(trace_path, {"ts": _utc_now(), "event": "inspire_query_error", "url": url, "error": str(exc)})
            break

        hits = obj.get("hits", {}).get("hits", [])
        if not isinstance(hits, list) or not hits:
            break

        for h in hits:
            if len(out) >= max_records:
                break
            if not isinstance(h, dict):
                continue
            recid = str(h.get("id") or "").strip()
            md = h.get("metadata") if isinstance(h.get("metadata"), dict) else {}
            arxiv_id = _extract_arxiv_id(md)
            if not arxiv_id:
                _append_jsonl(
                    trace_path,
                    {"ts": _utc_now(), "event": "skip_no_arxiv", "recid": recid, "title": _extract_title(md)},
                )
                continue
            out.append(
                Record(
                    recid=recid,
                    title=_extract_title(md),
                    year=_extract_year(md),
                    arxiv_id=arxiv_id,
                    doi=_extract_doi(md),
                    authors=_extract_authors(md),
                )
            )

        page += 1
    return out


def _extract_filtered_tar(
    tar_bytes: bytes,
    *,
    out_dir: Path,
    exts: set[str],
    trace_path: Path,
    arxiv_id: str,
) -> int:
    count = 0
    try:
        tf = tarfile.open(fileobj=io.BytesIO(tar_bytes), mode="r:*")
    except Exception as exc:
        _append_jsonl(trace_path, {"ts": _utc_now(), "event": "tar_open_error", "arxiv_id": arxiv_id, "error": str(exc)})
        return 0

    for m in tf.getmembers():
        if not m.isfile():
            continue
        mp = _safe_member_path(m.name)
        if mp is None:
            continue
        suffix = mp.suffix.lower()
        if suffix not in exts:
            continue
        try:
            data = tf.extractfile(m).read() if tf.extractfile(m) is not None else None
        except Exception:
            data = None
        if not data:
            continue
        dst = out_dir / mp
        _ensure_dir(dst.parent)
        dst.write_bytes(data)
        count += 1

    return count


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--query-url", default="", help="INSPIRE UI query URL (we extract q=... from it).")
    ap.add_argument("--query", default="", help="INSPIRE query string (alternative to --query-url).")
    ap.add_argument("--sort", default="mostrecent", help="INSPIRE sort (default: mostrecent).")
    ap.add_argument("--page-size", type=int, default=50, help="INSPIRE page size (default: 50).")
    ap.add_argument("--max-records", type=int, default=10, help="Max INSPIRE records to process (default: 10).")
    ap.add_argument("--out-dir", type=Path, required=True, help="Output directory for the local corpus.")
    ap.add_argument(
        "--exts",
        default=".tex,.bib,.sty,.cls,.bst,.bbl,.txt",
        help="Comma-separated extensions to extract from arXiv sources (default: .tex,.bib,.sty,.cls,.bst,.bbl,.txt).",
    )
    ap.add_argument("--keep-tarballs", action="store_true", help="Also keep downloaded tarballs under out-dir/tarballs/.")
    ap.add_argument("--dry-run", action="store_true", help="Only list records and write metadata; do not download/extract.")
    args = ap.parse_args()

    try:
        query = _parse_inspire_query(args.query_url.strip() or None, args.query.strip() or None)
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2

    out_dir = args.out_dir.expanduser().resolve()
    _ensure_dir(out_dir)
    trace_path = out_dir / "trace.jsonl"
    meta_path = out_dir / "meta.json"

    exts = {("." + e.strip().lstrip(".")).lower() for e in str(args.exts).split(",") if e.strip()}
    _write_json(
        meta_path,
        {
            "created_at": _utc_now(),
            "query": query,
            "sort": args.sort,
            "page_size": args.page_size,
            "max_records": args.max_records,
            "extract_exts": sorted(exts),
        },
    )

    records = _iter_inspire_records(query, size=args.page_size, max_records=max(0, args.max_records), sort=args.sort, trace_path=trace_path)
    print(f"[ok] inspire records: {len(records)}")

    papers_dir = out_dir / "papers"
    tar_dir = out_dir / "tarballs"
    if args.keep_tarballs:
        _ensure_dir(tar_dir)

    for i, rec in enumerate(records, start=1):
        safe = _safe_id(rec.arxiv_id)
        rec_dir = papers_dir / safe
        _ensure_dir(rec_dir)
        _write_json(
            rec_dir / "record.json",
            {
                "fetched_at": _utc_now(),
                "recid": rec.recid,
                "title": rec.title,
                "year": rec.year,
                "authors": rec.authors,
                "doi": rec.doi,
                "arxiv_id": rec.arxiv_id,
                "inspire_api": f"https://inspirehep.net/api/literature/{rec.recid}",
                "arxiv_abs": f"https://arxiv.org/abs/{rec.arxiv_id}",
            },
        )

        print(f"[{i}/{len(records)}] {rec.arxiv_id} {rec.year} {rec.title[:80]}")
        if args.dry_run:
            continue

        try:
            tar_bytes = _download_arxiv_source(rec.arxiv_id)
            _append_jsonl(trace_path, {"ts": _utc_now(), "event": "arxiv_download_ok", "arxiv_id": rec.arxiv_id, "bytes": len(tar_bytes)})
        except Exception as exc:
            _append_jsonl(trace_path, {"ts": _utc_now(), "event": "arxiv_download_error", "arxiv_id": rec.arxiv_id, "error": str(exc)})
            continue

        if args.keep_tarballs:
            (tar_dir / f"{safe}.tar").write_bytes(tar_bytes)

        extracted = _extract_filtered_tar(tar_bytes, out_dir=rec_dir, exts=exts, trace_path=trace_path, arxiv_id=rec.arxiv_id)
        _append_jsonl(
            trace_path,
            {"ts": _utc_now(), "event": "arxiv_extract_done", "arxiv_id": rec.arxiv_id, "extracted_files": extracted},
        )

    print(f"[ok] wrote corpus: {out_dir}")
    print(f"[ok] trace: {trace_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

```

## File: assets/style/style_profile.md
```markdown
# research-writer — FK LaTeX Writing Style Profile (M0)

This file summarizes recurring writing/style patterns inferred from a scan of the user’s existing LaTeX manuscripts (Overleaf projects listed in the M0 corpus below). It is intended as **guidance** for drafting new text in a similar technical voice, not as a phrase bank to copy verbatim.

## 1) High-level voice

- **Physics-first, mechanism-first**: lead with the physical question, then the mechanism/constraint (unitarity/analyticity/symmetry/power counting), then the quantitative consequence.
- **Active but restrained**: frequent “We …” for actions/results (“We show/derive/find”), but avoid hype. Prefer concrete verbs.
- **Skeptical by default**: treat literature claims as inputs that can fail; when leaning on them, either validate (derivation/check/limit) or label as *unverified* with a plan + kill criterion.
- **Definition-hardened**: quantities are defined operationally; if a number is quoted, the definition and extraction procedure are explicit (and uncertainties are discussed).
- **Comparative and diagnostic**: comparisons to prior methods/results are used to isolate *why* things differ (e.g., left-hand cuts, crossing, coupled channels, thresholds).

## 2) Paragraph mechanics (typical “moves”)

- **Context → gap → contribution** in the first 1–3 paragraphs of the Introduction.
- **Concrete signposting**:
  - “In this work, we …”
  - “This paper is organized as follows …”
  - “For simplicity, we …” / “Without loss of generality, …”
  - “As is well-known (see, e.g., …), …” when using standard facts.
- **Bridge equations to meaning**: after key equations, add a sentence explaining what controls the size/sign/limit; avoid leaving equations “hanging”.
- **Limit checks** are explicitly mentioned (threshold behavior, symmetry limits, scaling with parameters, consistency sum rules).

## 3) Technical LaTeX conventions (RevTeX/physics norms)

- Nonbreaking references: `Eq.~\\eqref{...}`, `Fig.~\\ref{...}`, `Ref.~\\cite{...}`, `Refs.~\\cite{...}`.
- Acronyms: define on first use with parentheses (“quantum chromodynamics (QCD)”).
- Parenthetical “e.g.” frequently appears as `{\it e.g.},` inside parentheses.
- Numerical results:
  - include uncertainties and units when meaningful;
  - use “within uncertainties”, “moderate”, “mild”, “negligible” with justification (what was varied and what moved).
- Avoid custom macros in shared Markdown math (they won’t render); in LaTeX, macros are used sparingly and locally.

## 4) Results presentation norms

- **Headline numbers** appear with:
  - definition/observable,
  - where they come from (equation + artifact),
  - a minimal self-consistency check (sum rule, identity, scaling),
  - and a short interpretation (“negative sign indicates attraction”, “dominant contribution is …”).
- **Uncertainty accounting** is broken down by dominant sources when possible (“primary uncertainty stems from …; Regge model dependence is negligible in …”).
- **When disagreeing with literature**:
  - state the literature claim precisely,
  - identify the missing ingredient/assumption,
  - show a diagnostic that distinguishes scenarios.

## 5) Figure/table caption style

- Captions are **descriptive and self-contained**:
  - identify what is plotted,
  - color/line conventions,
  - and (if relevant) what cut/kinematic region is used.
- Figures are used as part of the argument (not decoration): captions and surrounding text point to what feature matters.

## 6) “Auditability” add-ons for research-writer

To keep the paper arXiv-ready and auditable when generated from a `research-team` project:

- Any number quoted in the paper must have a **provenance pointer** (artifact path + key within JSON/CSV).
- Any external claim used in core reasoning must be either:
  - **validated** (derivation/check performed in `Draft_Derivation.md` or an artifact), or
  - marked **UNVERIFIED** with:
    - a validation plan (what to compute/check),
    - and a kill criterion (what failure would invalidate the claim).

## 7) PRL “letter” tactics (optional style corpus)

If the target deliverable is PRL/letter-like (tight and high-signal), common tactics in your corpus include:

- **Fast “hook” opening**: a short, high-level problem statement and why it matters; then the constraint/mechanism; then the headline consequence.
- **Concise structure**: fewer sections; keep technical scaffolding minimal in the main text and push long derivations/variants to an appendix or supplemental.
- **Result-forward figures**: 1–2 key figures that carry the argument; captions are self-contained and interpret the feature that matters.
- **Letter-style “Introduction.—” paragraph**: often used in PRL/letters (italic lead paragraph rather than a long sectioned preamble).

To expand the PRL-specific style corpus from your papers and coauthor papers, see:
- `assets/style/prl_style_corpus.md` (INSPIRE query + arXiv source downloader)

## 8) M0 corpus (inputs scanned; read-only)

The following projects were used as the style corpus (no files modified):

- `/Users/fkg/Dropbox/Apps/Overleaf/Jpsipi_JpsiK`
- `/Users/fkg/Dropbox/Apps/Overleaf/BaryonBaryonNc`
- `/Users/fkg/Dropbox/Apps/Overleaf/psip2Jpipi_dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Ds1DKgamma`
- `/Users/fkg/Dropbox/Apps/Overleaf/X(3872)fit`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE with lhc 2`
- `/Users/fkg/Dropbox/Apps/Overleaf/SigmaTerm`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsipiTFF`
- `/Users/fkg/Dropbox/Apps/Overleaf/GraviChPT_spinlessMatterField`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglmentDecuplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/JpsiNScatteringLength`
- `/Users/fkg/Dropbox/Apps/Overleaf/etap2etapipi`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2Jpsipp`
- `/Users/fkg/Dropbox/Apps/Overleaf/D0(2100)_EPJC`
- `/Users/fkg/Dropbox/Apps/Overleaf/Disc-Calculus`
- `/Users/fkg/Dropbox/Apps/Overleaf/ee2gammaCplusHM`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD Letter: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/PRD: piK_RoySteinerEq`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature Commun.: GFFs of nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/ERE_lhc`
- `/Users/fkg/Dropbox/Apps/Overleaf/OpenCharmTetraquarks`
- `/Users/fkg/Dropbox/Apps/Overleaf/EntanglementHeavyMesons`
- `/Users/fkg/Dropbox/Apps/Overleaf/Dispersive analyses of GFFs`
- `/Users/fkg/Dropbox/Apps/Overleaf/XfromLatticeQCD`
- `/Users/fkg/Dropbox/Apps/Overleaf/ZREFT-Letter`
- `/Users/fkg/Dropbox/Apps/Overleaf/Chiral representations of the nucleon mass at leading two-loop order`
- `/Users/fkg/Dropbox/Apps/Overleaf/Photoproduction_3872`
- `/Users/fkg/Dropbox/Apps/Overleaf/IsovectorX`
- `/Users/fkg/Dropbox/Apps/Overleaf/CompleteHHbarMultiplet`
- `/Users/fkg/Dropbox/Apps/Overleaf/0--engilish`
- `/Users/fkg/Dropbox/Apps/Overleaf/AnnHalo`
- `/Users/fkg/Dropbox/Apps/Overleaf/ProtonTFF_DalitzDecay`
- `/Users/fkg/Dropbox/Apps/Overleaf/cusps`
- `/Users/fkg/Dropbox/Apps/Overleaf/XAtom`
- `/Users/fkg/Dropbox/Apps/Overleaf/DN-scattering_length`
- `/Users/fkg/Dropbox/Apps/Overleaf/Nature: A new  paradigm for heavy-light meson spectroscopy`
- `/Users/fkg/Dropbox/Apps/Overleaf/axion-nucleon`
- `/Users/fkg/Dropbox/Apps/Overleaf/XEFT`
- `/Users/fkg/Dropbox/Apps/Overleaf/X3872dip`
- `/Users/fkg/Dropbox/Apps/Overleaf/Xmassprecise`
- `/Users/fkg/Dropbox/Apps/Overleaf/Neutron-halo scattering`
```

## File: SKILL.md
```markdown
---
name: research-writer
description: Turn a `research-team` project into an arXiv-ready RevTeX4-2 (12pt, onecolumn) paper draft with provenance tables, BibTeX hygiene, and deterministic Markdown/LaTeX escape checks.
---

# Research Writer

Agent-first skill: given an existing `research-team` project root (with `Draft_Derivation.md`, `knowledge_base/`, and `artifacts/`), scaffold a **coherent, arXiv-ready paper folder** and provide deterministic hygiene checks so the draft is auditable and safe to iterate.

Default paper style:
- RevTeX 4.2, `12pt`, `onecolumn` (English-first).

## Quick start (one-shot scaffold)

```bash
bash scripts/bin/research_writer_scaffold.sh \
  --project-root /path/to/research-team-project \
  --tag M1-r1 \
  --out paper/
```

Optional (best-effort online BibTeX fetch from INSPIRE/DOI; writes `paper/bibtex_trace.jsonl`):

```bash
bash scripts/bin/research_writer_scaffold.sh \
  --project-root /path/to/research-team-project \
  --tag M1-r1 \
  --out paper/ \
  --fetch-bibtex
```

This generates `paper/` containing:
- `paper/main.tex`
- `paper/references.bib`
- `paper/figures/` (symlinks ok)
- `paper/latexmkrc` (or `paper/Makefile`)
- `paper/README.md`

## What it does (conceptually)

1) Reads `Draft_Derivation.md` and builds a paper skeleton that **points back to source sections** (no hallucinated derivations).
2) Pulls headline numbers/figures from `artifacts/` manifests/summaries and writes a **Results provenance** table (artifact path + JSON/CSV key).
3) Produces a BibTeX file with **RevTeX4-2 hygiene** (APS-style safety: ensure `@article` has `journal = ""` if unknown).
4) Runs deterministic hygiene checks, including the **double-backslash-in-math** bug (`\\Delta` instead of `\Delta`) with optional auto-fix.

## Hard policies (must follow)

1) **Scientific skepticism is mandatory**: any external claim used in core reasoning/headline results must be either:
   - independently validated (derivation, limit check, or artifact reproduction), or
   - labeled `UNVERIFIED` with a validation plan + kill criterion.
2) **No hard cutoff on real workflows**: citations/links to software/data archives are allowed (Zenodo/Figshare/institutional repos/experiment pages). Prefer stable anchors; require trace logging rather than forbidding.
3) **Network/DNS robustness**: if metadata/BibTeX fetch fails, degrade gracefully by writing stable links + minimal placeholders for later backfill.
4) **Markdown/LaTeX hygiene**: avoid accidental LaTeX over-escaping in math; provide deterministic check + optional deterministic fix.

## Artifact contract (inputs)

This skill assumes a `research-team`-style project root, with best-effort fallbacks.

### Required
- `Draft_Derivation.md` — primary derivation notebook (source of equations/definitions; paper must cite/point to sections, not invent missing steps).

### Strongly recommended
- `knowledge_base/` — background, priors, methodology traces, and reference notes (for auditability and “UNVERIFIED” validation plans).
- `artifacts/` — reproducibility outputs for a given tag (see below).

### Artifacts: accepted layouts (best-effort detection)

For a given `--tag <TAG>`, the scaffold searches (in order):
- `artifacts/runs/<TAG>/` (preferred)
- `artifacts/<TAG>/`
- `artifacts/<TAG>_manifest.json` + `artifacts/<TAG>_analysis.json` (demo layout)

Within an artifacts run dir, common files are recognized:
- `manifest.json` / `*_manifest.json`
- `summary.json` / `summary.csv`
- `analysis.json` / `*_analysis.json`

Minimum expectations for provenance:
- A manifest lists produced outputs (plots/tables/data paths) and (ideally) parameters/versions.
- A summary/analysis provides headline numbers with definitions/keys.

## Deterministic hygiene tools

- Double-backslash math check/fix (Markdown math only): see `scripts/bin/check_md_double_backslash.sh` and `scripts/bin/fix_md_double_backslash_math.py`.
- BibTeX RevTeX 4.2 hygiene: see `scripts/bin/fix_bibtex_revtex4_2.py`.
- BibTeX fetch trace (when `--fetch-bibtex` is used): see `paper/bibtex_trace.jsonl`.

## Style profile (FK voice)

Use the FK style guide when drafting or rewriting text:
- `assets/style/style_profile.md`
- `assets/style/writing_voice_system_prompt.txt`
- Optional PRL-focused corpus download: `assets/style/prl_style_corpus.md` (script: `scripts/bin/fetch_prl_style_corpus.py`)

## Operational docs

- Quickstart: `README.md`
- Workflows/debugging: `RUNBOOK.md`
- Milestones/acceptance criteria: `ROADMAP.md`
```

## File: RUNBOOK.md
```markdown
# research-writer — Runbook

## Common workflows

### 1) Scaffold a paper from a research-team project

```bash
bash scripts/bin/research_writer_scaffold.sh --project-root /path/to/project --tag M1-r1 --out paper/
```

### 2) Compile (if TeX toolchain exists)

```bash
cd paper
latexmk -pdf main.tex
```

### 3) BibTeX hygiene (RevTeX4-2)

If BibTeX fails on `@article` entries without a `journal` field:

```bash
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib paper/references.bib --in-place
```

### 4) Markdown double-backslash math check (and fix)

Check (warn-only by default):

```bash
bash scripts/bin/check_md_double_backslash.sh --root paper
```

Fix (in-place):

```bash
python3 scripts/bin/fix_md_double_backslash_math.py --root paper --in-place
```

### 5) Optional: build a PRL style corpus (INSPIRE → arXiv sources)

Use this when you want to better match PRL/letter writing style and structure.

```bash
python3 scripts/bin/fetch_prl_style_corpus.py \
  --query-url "https://inspirehep.net/literature?sort=mostrecent&size=50&page=1&q=%28a%20f%20k%20guo%20or%20a%20u%20g%20meissner%20or%20a%20m%20hoferichter%29%20and%20j%20phys.rev.lett.&ui-citation-summary=true" \
  --max-records 10 \
  --out-dir /tmp/prl_style_corpus
```

## Debugging

### “No artifacts found for tag”

- Ensure the `--tag` matches a folder under `artifacts/runs/<TAG>/` or files like `artifacts/<TAG>_manifest.json`.
- If your project uses a different layout, run scaffold with `--verbose` and inspect the printed search paths.

### “latexmk not found”

- This is expected on minimal environments. Smoke tests must report `SKIPPED: latexmk not found` and still pass.

### Network/DNS failures during BibTeX fetch

- The scaffold must degrade gracefully: keep stable links (INSPIRE/arXiv/DOI) as placeholders and allow later backfill.
```

## File: scripts/dev/run_all_smoke_tests.sh
```bash
#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

tmp_root="$(mktemp -d)"
trap 'rm -rf "${tmp_root}"' EXIT

if command -v rg >/dev/null 2>&1; then
  grep_re() { rg -n "$1" "$2" >/dev/null; }
else
  grep_re() { grep -nE "$1" "$2" >/dev/null; }
fi

echo "[smoke] help: scaffold CLI"
bash scripts/bin/research_writer_scaffold.sh --help >/dev/null

echo "[smoke] help: bibtex fixer"
python3 scripts/bin/fix_bibtex_revtex4_2.py --help >/dev/null

echo "[smoke] help: double-backslash fixer"
python3 scripts/bin/fix_md_double_backslash_math.py --help >/dev/null

echo "[smoke] help: PRL style corpus fetcher"
python3 scripts/bin/fetch_prl_style_corpus.py --help >/dev/null

echo "[smoke] scaffold: fixture project -> paper/"
proj="${tmp_root}/project"
out="${tmp_root}/paper"
cp -R "scripts/dev/fixtures/minimal_project" "${proj}"

python3 "${proj}/scripts/make_artifacts.py" --tag M2-smoke >/dev/null

bash scripts/bin/research_writer_scaffold.sh --project-root "${proj}" --tag M2-smoke --out "${out}"
test -f "${out}/main.tex"
test -f "${out}/references.bib"
test -f "${out}/latexmkrc"
test -f "${out}/README.md"
test -d "${out}/figures"
grep_re '^[[:space:]]*journal[[:space:]]*=[[:space:]]*\"\"' "${out}/references.bib"

echo "[smoke] markdown double-backslash check: generated paper + skill assets"
bash scripts/bin/check_md_double_backslash.sh --root "${out}" --fail >/dev/null
bash scripts/bin/check_md_double_backslash.sh --root "assets" --fail >/dev/null

if command -v latexmk >/dev/null 2>&1; then
  echo "[smoke] latexmk: compile paper"
  latexmk_log="${tmp_root}/latexmk.log"
  if ! (cd "${out}" && latexmk -pdf main.tex >"${latexmk_log}" 2>&1); then
    echo "[smoke] FAIL: latexmk failed; log follows:" >&2
    cat "${latexmk_log}" >&2
    exit 1
  fi
else
  echo "[smoke] SKIPPED: latexmk not found"
fi

echo "[smoke] bibtex fixer: adds journal field"
bib="${tmp_root}/references.bib"
cat >"${bib}" <<'EOF'
@article{Key1,
  title = {Test entry},
  year = {2020}
}
EOF
set +e
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib "${bib}" >/dev/null 2>&1
code=$?
set -e
if [[ $code -ne 1 ]]; then
  echo "ERROR: expected exit 1 (fixes needed) for bibtex fixer; got ${code}" >&2
  exit 1
fi
python3 scripts/bin/fix_bibtex_revtex4_2.py --bib "${bib}" --in-place >/dev/null
grep_re '^[[:space:]]*journal[[:space:]]*=[[:space:]]*\"\"' "${bib}"

echo "[smoke] double-backslash checker+fixer: markdown math only"
md_dir="${tmp_root}/md"
mkdir -p "${md_dir}"
cat >"${md_dir}/t.md" <<'EOF'
Inline math: $\\Delta = 1$, $k^\\* = 0$.
Code span (must not change): `\\Delta`
$$
\\gamma_{\\rm lin} = 2
$$
EOF
set +e
bash scripts/bin/check_md_double_backslash.sh --root "${md_dir}" --fail >/dev/null 2>&1
code=$?
set -e
if [[ $code -ne 1 ]]; then
  echo "ERROR: expected exit 1 for --fail with bad escapes; got ${code}" >&2
  exit 1
fi
python3 scripts/bin/fix_md_double_backslash_math.py --root "${md_dir}" --in-place >/dev/null
bash scripts/bin/check_md_double_backslash.sh --root "${md_dir}" --fail >/dev/null
grep_re '\\\\Delta' "${md_dir}/t.md"  # should still exist in code spans (fixer must not touch inline code)

echo "[smoke] ok"
```

