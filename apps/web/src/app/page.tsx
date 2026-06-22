import { projectOverview } from "../lib/project";

const services = [
  { name: "Web", detail: "Next.js 15", port: projectOverview.webPort, state: "ready" },
  { name: "API", detail: "NestJS · strict TS", port: projectOverview.apiPort, state: "ready" },
  { name: "Data", detail: "PostgreSQL · Redis · MinIO", port: null, state: "compose" },
] as const;

const foundations = [
  "共享领域类型由 @pas/shared 统一导出",
  "外部能力通过 RagflowClient / LlmClient / CrmClient 隔离",
  "必填环境变量经 Zod 校验，启动时 fail fast",
  "RAGFlow 使用可替换 Mock，业务开发不被真实契约阻塞",
] as const;

export default function Home() {
  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandMark">P</span>
          <div>
            <strong>PAS</strong>
            <span>Presales Assistance System</span>
          </div>
        </div>
        <div className="environment"><span /> Development</div>
      </header>

      <div className="shell">
        <section className="intro" aria-labelledby="page-title">
          <p className="eyebrow">E0 · ENGINEERING FOUNDATION</p>
          <h1 id="page-title">工程基建工作台</h1>
          <p className="lede">
            PAS monorepo 已建立统一的前后端、领域契约与外部能力边界，后续 Epic 可在同一工程约束下并行推进。
          </p>
        </section>

        <section className="servicePanel" aria-labelledby="services-title">
          <div className="sectionHeading">
            <div>
              <p className="sectionLabel">Runtime</p>
              <h2 id="services-title">本地服务</h2>
            </div>
            <span className="statusSummary">3 service groups</span>
          </div>
          <div className="serviceRows">
            {services.map((service) => (
              <div className="serviceRow" key={service.name}>
                <span className={`statusDot ${service.state}`} aria-hidden="true" />
                <strong>{service.name}</strong>
                <span>{service.detail}</span>
                <code>{service.port ? `localhost:${service.port}` : "docker compose"}</code>
              </div>
            ))}
          </div>
        </section>

        <div className="contentGrid">
          <section className="foundation" aria-labelledby="foundation-title">
            <p className="sectionLabel">Architecture contract</p>
            <h2 id="foundation-title">E0 已建立的边界</h2>
            <ol>
              {foundations.map((item, index) => (
                <li key={item}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </section>

          <aside className="qaPanel" aria-labelledby="qa-title">
            <p className="sectionLabel">Mock verification</p>
            <h2 id="qa-title">假问答入口</h2>
            <p>该路由通过 NestJS DI 注入 `RagflowClientMock`，用于验证业务层不直接耦合 RAGFlow。</p>
            <div className="endpoint">
              <span>POST</span>
              <code>/api/demo/qa</code>
            </div>
            <pre>{`curl -X POST http://localhost:3001/api/demo/qa \\
  -H "Content-Type: application/json" \\
  -d '{"query":"PAS E0 是否就绪？"}'`}</pre>
          </aside>
        </div>

        <section className="roles" aria-label="Shared roles">
          <span>Shared roles</span>
          <div>
            {projectOverview.roles.map((role) => <code key={role}>{role}</code>)}
          </div>
          <p>Source: @pas/shared</p>
        </section>
      </div>
    </main>
  );
}
