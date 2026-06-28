"use client";

import React, { type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./app-shell.module.css";

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface AppShellProps {
  pageTitle: string;
  pageDescription?: string;
  breadcrumb: Breadcrumb[];
  actions?: ReactNode;
  children: ReactNode;
}

type ThemePreference = "light" | "dark";

interface NavLink {
  id: string;
  href: string;
  label: string;
  icon: ReactNode;
}

interface MeResponse {
  name?: string;
  role?: string;
}

const THEME_STORAGE_KEY = "pas-theme";

const NAV: NavLink[] = [
  { id: "home", href: "/", label: "总览", icon: <HomeIcon /> },
  { id: "proposal", href: "/proposals", label: "方案工作室", icon: <ProposalIcon /> },
  { id: "customers", href: "/customers", label: "客户画像", icon: <UsersIcon /> },
  { id: "opportunities", href: "/opportunities", label: "商机阶段", icon: <BriefcaseIcon /> },
  { id: "documents", href: "/documents", label: "方案文档", icon: <DocumentIcon /> },
  { id: "knowledge", href: "/knowledge", label: "知识库", icon: <BookIcon /> },
  { id: "qa", href: "/qa", label: "AI 助手", icon: <ChatIcon /> },
  { id: "analytics", href: "/analytics", label: "数据分析", icon: <ChartIcon /> },
  { id: "tasks", href: "/tasks", label: "任务检查", icon: <TaskIcon /> },
];

export function AppShell({
  pageTitle,
  pageDescription,
  breadcrumb,
  actions,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [now, setNow] = useState<string>("");
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [me, setMe] = useState<MeResponse | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = stored === "dark" || stored === "light" ? stored : prefersDark ? "dark" : "light";
    setTheme(next);
    document.documentElement.dataset.theme = next;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const update = () => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      setNow(
        `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`,
      );
    };
    update();
    const id = setInterval(update, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/me", {
      credentials: "include",
      headers: { accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((user: MeResponse | null) => {
        if (active) setMe(user);
      })
      .catch(() => {
        if (active) setMe(null);
      });
    return () => {
      active = false;
    };
  }, []);

  function isActive(item: NavLink): boolean {
    if (!pathname) return false;
    if (item.href === "/") return pathname === "/";
    if (item.id === "proposal" && pathname.startsWith("/proposals/new")) return false;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <div className={styles.shell} data-theme={theme}>
      <aside className={styles.iconRail} aria-label="主导航">
        <Link className={styles.brand} href="/" aria-label="PAS 总览">
          PAS
        </Link>
        <nav className={styles.railNav}>
          {NAV.map((item) => (
            <Link
              aria-current={isActive(item) ? "page" : undefined}
              aria-label={item.label}
              className={`${styles.railButton} ${isActive(item) ? styles.active : ""}`}
              data-shell-nav={item.id}
              href={item.href}
              key={item.id}
              title={item.label}
            >
              {item.icon}
            </Link>
          ))}
        </nav>
        <div className={styles.railUtility}>
          <Link
            aria-label="设置"
            className={`${styles.railButton} ${pathname?.startsWith("/settings") ? styles.active : ""}`}
            data-shell-utility="settings"
            href="/settings"
            title="设置"
          >
            <SettingsIcon />
          </Link>
        </div>
      </aside>

      <header className={styles.topbar}>
        <div className={styles.projectPicker}>
          <span className={styles.sectionTitle}>{pageTitle}</span>
          <nav className={styles.breadcrumb} aria-label="breadcrumb">
            {breadcrumb.map((crumb, i) => {
              const isLast = i === breadcrumb.length - 1;
              return (
                <span className={styles.crumb} key={`${crumb.label}-${i}`}>
                  {crumb.href && !isLast ? (
                    <Link href={crumb.href}>{crumb.label}</Link>
                  ) : (
                    <span className={isLast ? styles.crumbCurrent : ""}>{crumb.label}</span>
                  )}
                  {!isLast && <span className={styles.crumbSep}>/</span>}
                </span>
              );
            })}
          </nav>
        </div>

        <label className={styles.search}>
          <SearchIcon />
          <input type="search" placeholder="搜索 (⌘K)" />
        </label>

        <div className={styles.topActions}>
          <span className={styles.savedState}>
            <span className={styles.statusDot} />
            已保存 {now ? now.slice(-5) : "--:--"}
          </span>
          <button
            aria-label="切换主题"
            className={styles.toolbarButton}
            onClick={() => setTheme(nextTheme)}
            type="button"
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
            <span>{theme === "dark" ? "浅色" : "深色"}</span>
          </button>
          {actions && <div className={styles.pageActions}>{actions}</div>}
          <button className={styles.iconBtn} aria-label="通知" type="button">
            <BellIcon />
            <span className={styles.iconBadge} />
          </button>
          <div className={styles.userCard}>
            <div className={styles.avatar}>{(me?.name ?? "张伟").slice(0, 1)}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{me?.name ?? "张伟"}</span>
              <span className={styles.userRole}>{me?.role ?? "presales"}</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        {(pageDescription || actions) && (
          <div className={styles.pageHeader}>
            {pageDescription && <p className={styles.pageDesc}>{pageDescription}</p>}
          </div>
        )}
        <div className={styles.pageBody}>{children}</div>
      </main>

      <footer className={styles.statusbar}>
        <span className={styles.flowLabel}>方案编写进度</span>
        <div className={styles.flowSteps} aria-label="方案编写进度">
          {["需求分析", "方案设计", "方案评审", "商务方案", "定稿输出"].map((step, index) => (
            <span
              className={`${styles.flowStep} ${index === 0 ? styles.done : ""} ${index === 1 ? styles.current : ""}`}
              key={step}
            >
              <span className={styles.flowNo}>{index + 1}</span>
              <span>{step}</span>
            </span>
          ))}
        </div>
        <span className={styles.footerStatus}>
          <span className={styles.statusDot} />
          API 已连接
        </span>
      </footer>
    </div>
  );
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.8V21h14V9.8" />
      <path d="M9 21v-6h6v6" />
    </Icon>
  );
}

function ProposalIcon() {
  return (
    <Icon>
      <path d="M7 3h8l4 4v14H7z" />
      <path d="M15 3v5h5" />
      <path d="M10 13h6" />
      <path d="M10 17h5" />
    </Icon>
  );
}

function UsersIcon() {
  return (
    <Icon>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.8" />
      <path d="M16 3.2a4 4 0 0 1 0 7.6" />
    </Icon>
  );
}

function BriefcaseIcon() {
  return (
    <Icon>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Icon>
  );
}

function DocumentIcon() {
  return (
    <Icon>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h6" />
    </Icon>
  );
}

function BookIcon() {
  return (
    <Icon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
    </Icon>
  );
}

function ChatIcon() {
  return (
    <Icon>
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      <path d="M8 9h8" />
      <path d="M8 13h5" />
    </Icon>
  );
}

function ChartIcon() {
  return (
    <Icon>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </Icon>
  );
}

function TaskIcon() {
  return (
    <Icon>
      <path d="M9 11 12 14 22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </Icon>
  );
}

function SettingsIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 19.4 9c.2.6.8 1 1.6 1h.1a2 2 0 1 1 0 4H21c-.8 0-1.4.4-1.6 1z" />
    </Icon>
  );
}

function SearchIcon() {
  return (
    <Icon>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </Icon>
  );
}

function BellIcon() {
  return (
    <Icon>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Icon>
  );
}

function MoonIcon() {
  return (
    <Icon>
      <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8z" />
    </Icon>
  );
}

function SunIcon() {
  return (
    <Icon>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </Icon>
  );
}
