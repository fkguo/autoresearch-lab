VERDICT: READY

## Blockers
(None)

## Non-blocking
- `FormalismRegistry` in `formalism_registry.py` strictly adheres to M3.1 minimal requirements (toy, eft, lattice).
- `DomainPackIndex` in `domain_pack.py` correctly bootstraps the default HEP pack with these formalisms.
- `IdeaCoreService.campaign_init` in `service.py` properly merges the default registry with user overrides and validates non-emptiness.
- `IdeaCoreService.node_promote` now includes the critical check `formalism_not_in_registry`, validating candidate formalisms against the campaign's effective registry.
- `test_formalism_registry_m31.py` confirms the default pack contents and the failure mode for empty registries.
- `test_node_promote.py` verifies the new promotion gate logic, including the `formalism_not_in_registry` error condition.
- The implementation of `node_promote` logic for `formalism_not_in_registry` correctly iterates through candidate formalisms and checks existence in the registry, raising the appropriate RpcError with details.

## Real-research fit
The minimal formalism registry (toy, eft, lattice) provides a sufficient starting point for HEP research simulations and theoretical scaffolding. The ability to override/extend this registry in `campaign.init` ensures flexibility for more specialized domains later. The strict checks in `node.promote` prevent "hallucinated" formalisms from propagating, which is essential for maintaining the integrity of the research graph.

## Robustness & safety
- **Fail-fast on invalid state:** Empty registries and unknown formalisms cause immediate, clear errors.
- **Idempotency:** `campaign.init` and `node.promote` maintain idempotency protections.
- **Schema Validation:** Although implicit via the `RpcError` structure, the error data correctly maps to expected schema failure modes.
- **Thread Safety:** `DomainPackIndex` uses a lock for its cache, ensuring safe concurrent access if the service were to be used in a threaded context (though currently largely sequential/single-threaded in tests).

## Specific patch suggestions
- Consider adding a `validate_formalism` method to `FormalismRegistry` or `IdeaCoreService` to centralize the logic used in `node_promote` and potentially `search.step` or other future endpoints, rather than inline checking.
- The `DomainPackAssets` loader mechanism is flexible, but ensure that in future iterations, we don't accidentally allow "lazy loading" of invalid packs to crash a running campaign; the current `campaign.init` load check mitigates this well for now.
