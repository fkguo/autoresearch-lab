# Review Packet (v2): Idea-Generator Architecture Spec v0.2

## What to review

We are designing an `idea-generator` agent for an evidence-first HEP research ecosystem. The goal is to build a **standalone `idea-core` engine** with a **thin hepar/skill adapter**, and a plugin system that starts with HEP but scales to other theoretical physics domains.

This v2 packet includes updates made after the first dual review (schemas + RPC spec + island state machine + grounding audit gate).

Please review the architecture spec below for:
- Extensibility (DomainPack/Operator/SearchPolicy/Distributor)
- Machine-enforceable contracts (JSON Schema + OpenRPC)
- Evidence-first + novelty/folklore risk handling
- Cost control + search lifecycle correctness (multi-island, repopulate, bandit scheduling)
- Practical integration with C1/C2/W_compute and A0 gating

You may assume:
- Tools are available via MCP (INSPIRE/PDG/Zotero/KB/LaTeX), but `idea-core` must not import orchestrator internals.
- Multi-agent evaluation uses clean-room reviewers by default (Claude + Gemini).

## Architecture Spec (updated)

--- BEGIN SPEC ---

<SPEC_V2>

--- END SPEC ---

## Auxiliary artifacts added (for reference)

- JSON Schemas: `schemas/rationale_draft_v1.schema.json`, `schemas/idea_card_v1.schema.json`, `schemas/idea_node_v1.schema.json`
- OpenRPC: `schemas/idea_core_rpc_v1.openrpc.json`

## Output requirements

Follow the STRICT OUTPUT CONTRACT in your system prompt.

