# PAS Governance Guards

These scripts provide lightweight repository checks for PAS V1.5 / V2-prep governance.

## Commands

- `pnpm guard`: run all PAS governance guards.
- `pnpm guard:providers`: check direct concrete provider imports outside approved boundaries.
- `pnpm guard:services`: check service-layer provider coupling.
- `pnpm guard:phase`: check later-stage runtime implementation terms.

Compatibility aliases are also available:

- `pnpm guard:imports`
- `pnpm guard:service`

## Boundaries

Provider-specific code is allowed behind these boundaries:

- `apps/api/src/clients/**`
- `packages/clients/**`

The guards also avoid failing test fixtures, mocks, and adapter/plugin support paths where a concrete provider reference may be intentional.

Current narrow support-path exceptions:

- `apps/api/src/config/**` owns the central env schema and may name provider env vars without directly using provider SDKs.
- `apps/api/src/public/public-clients.module.ts` is existing NestJS DI wiring that selects the public RAGFlow client through the client boundary.

## Existing-Code Policy

These guards are intentionally conservative. They fail on obvious runtime provider coupling and later-stage implementation terms, while avoiding broad business refactors in this governance PR. If future legitimate exceptions appear, prefer a small allowlist or warning-only rule inside `tools/guards/**` rather than changing application code only to satisfy the guard.
