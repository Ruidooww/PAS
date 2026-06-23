# IdP clients

PAS E1 uses a provider-neutral `IdpClient` interface with mock, Feishu, and WeCom implementations. Business code imports from `@pas/clients`; provider-specific subpaths are available for focused tests and future integration wiring.