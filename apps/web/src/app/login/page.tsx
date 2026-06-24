import type { Metadata } from "next";

import styles from "./login.module.css";

export const metadata: Metadata = {
  title: "登录 | PAS",
};

export default function LoginPage() {
  return (
    <main className={styles.page}>
      <section className={styles.panel} aria-labelledby="login-title">
        <div className={styles.brand}>
          <span className={styles.mark}>P</span>
          <div className={styles.brandText}>
            <strong>PAS</strong>
            <span>Presales Assistance System</span>
          </div>
        </div>
        <h1 id="login-title">登录售前工作台</h1>
        <p>使用企业身份访问内部知识问答与引用资料。</p>
        <a className={styles.loginButton} href="/auth/login?provider=mock">
          登录
        </a>
      </section>
    </main>
  );
}
