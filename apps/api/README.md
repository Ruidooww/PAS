# PAS API

## QA knowledge base

Set `QA_KB_ID` to the RAGFlow dataset ID used by the QA routes:

```dotenv
QA_KB_ID=your_ragflow_dataset_id
```

When `QA_KB_ID` is omitted, the API keeps the mock-compatible default
`e0-mock-kb`. Real RAGFlow validation must set this variable to an existing
dataset ID; no request-time rewrite or local proxy is required.
