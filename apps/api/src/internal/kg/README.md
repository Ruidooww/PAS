# M7.1 Knowledge Graph

This module adds an entity-level graph on top of the existing RAGFlow-backed
`KbDocument` inventory.

## Entity Schema

- `KgEntityProduct`: product name, category, vendor, aliases, and JSON metadata.
- `KgEntityProposal`: proposal title, optional linked KG customer id, optional
  template id, and extracted chapter names.
- `KgEntityCustomer`: customer name, industry label, scale, and optional CRM id.
- `KgEntityIndustry`: industry name, optional code, and optional parent industry.

`KgRelation` links entities by type and id. The relation table intentionally
does not add foreign keys because the entity id can point to any of the four
entity tables.

## Relation Semantics

- `PRODUCT_USES`: proposal to product usage.
- `CUSTOMER_BUYS`: customer purchase or deployed product.
- `PROPOSAL_FOR_CUSTOMER`: proposal ownership by customer.
- `INDUSTRY_HAS_CUSTOMER`: industry membership.
- `PRODUCT_COMPETES`: product-to-product competition.

The original M7 route map also reserves two derived semantics for later
readers: hierarchical industry containment through `KgEntityIndustry.parentId`,
and provenance through `KgRelation.source.kbDocId`.

## Extraction Quality Notes

The current worker is extraction-only. It stores source provenance for every
relation as `{ kbDocId, ragflowDocId, chunkIds }` so recall and precision can be
audited against the originating RAGFlow chunks. No production quality baseline
has been collected in this PR; the acceptance pass should run at least 50
`KbDocument` rows and then measure per-entity recall and relation precision from
the stored provenance.
