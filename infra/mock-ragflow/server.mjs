import Fastify from "fastify";

const app = Fastify({ logger: false });
const kbId = "e0-mock-kb";
const docs = [
  { id: "mock-document", name: "Public product FAQ", status: "ready" },
  { id: "mock-internal-document", name: "Internal sales playbook", status: "ready" },
  { id: "mock-presales-document", name: "Presales checklist", status: "ready" },
];
const chunks = docs.map((doc, index) => ({
  id: `chunk-${index + 1}`,
  document_id: doc.id,
  document_keyword: doc.name,
  content: `Mock knowledge from ${doc.name}: configure document encryption from the PAS policy center.`,
  similarity: 0.98 - index * 0.01,
  kb_id: kbId,
}));

function retrieval(request) {
  const body = request.body ?? {};
  const whitelist = Array.isArray(body.document_ids) ? new Set(body.document_ids) : undefined;
  const visibleChunks = whitelist ? chunks.filter((chunk) => whitelist.has(chunk.document_id)) : chunks;
  return {
    code: 0,
    message: "success",
    data: {
      chunks: visibleChunks,
      total: visibleChunks.length,
      doc_aggs: [],
    },
  };
}

app.get("/health", async () => ({ ok: true }));
app.post("/retrieval", async (request) => retrieval(request));
app.post("/api/v1/retrieval", async (request) => retrieval(request));
app.get("/datasets", async () => ({
  code: 0,
  data: {
    datasets: [{ id: kbId, name: "PAS smoke KB" }],
  },
}));
app.get("/api/v1/datasets/:kbId/documents", async () => ({
  code: 0,
  data: {
    docs,
    total: docs.length,
  },
}));

await app.listen({ host: "0.0.0.0", port: Number(process.env.PORT ?? 9380) });
