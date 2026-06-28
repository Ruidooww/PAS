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

interface NavLink {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: string;
}

interface NavGroup {
  label: string;
  items: NavLink[];
  adminOnly?: boolean;
}

interface MeResponse {
  role?: string;
}

const NAV: NavGroup[] = [
  {
    label: "客户",
    items: [
      { href: "/customers", label: "客户列表", icon: <UsersIcon /> },
      { href: "/opportunities", label: "商机管理", icon: <BriefcaseIcon /> },
    ],
  },
  {
    label: "方案",
    items: [
      { href: "/proposals/new", label: "新建方案", icon: <PlusFileIcon /> },
      { href: "/proposals", label: "方案列表", icon: <FileIcon /> },
    ],
  },
  {
    label: "工具",
    items: [
      { href: "/qa", label: "知识问答", icon: <ChatIcon /> },
    ],
  },
  {
    label: "管理",
    adminOnly: true,
    items: [
      { href: "/admin/feedback", label: "反馈看板", icon: <ChartIcon /> },
    ],
  },
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
  const [role, setRole] = useState<string | null>(null);

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
      .then((me: MeResponse | null) => {
        if (active) setRole(typeof me?.role === "string" ? me.role : null);
      })
      .catch(() => {
        if (active) setRole(null);
      });
    return () => {
      active = false;
    };
  }, []);

  function isActive(href: string): boolean {
    if (!pathname) return false;
    if (href === "/proposals" && pathname.startsWith("/proposals/new")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logoMark}>P</div>
          <div className={styles.logoText}>
            <span className={styles.logoName}>PAS</span>
            <span className={styles.logoSub}>售前助手</span>
          </div>
        </div>
        {NAV.filter((group) => !group.adminOnly || role === "admin").map((group) => (
          <div key={group.label} className={styles.navGroup}>
            <div className={styles.navLabel}>{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive(item.href) ? styles.active : ""}`}
              >
                <span className={styles.navIcon} aria-hidden>
                  {item.icon}
                </span>
                <span>{item.label}</span>
                {item.badge && <span className={styles.navBadge}>{item.badge}</span>}
              </Link>
            ))}
          </div>
        ))}
      </aside>

      <header className={styles.topbar}>
        <nav className={styles.breadcrumb} aria-label="breadcrumb">
          {breadcrumb.map((crumb, i) => {
            const isLast = i === breadcrumb.length - 1;
            return (
              <span key={`${crumb.label}-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {crumb.href && !isLast ? (
                  <Link href={crumb.href} style={{ color: "inherit", textDecoration: "none" }}>
                    {crumb.label}
                  </Link>
                ) : (
                  <span className={isLast ? styles.crumbCurrent : ""}>{crumb.label}</span>
                )}
                {!isLast && <span className={styles.crumbSep}>/</span>}
              </span>
            );
          })}
        </nav>

        <div className={styles.search}>
          <SearchIcon />
          <input type="search" placeholder="搜索客户、商机、方案…" />
        </div>

        <div className={styles.topActions}>
          <span className={styles.statusChip}>
            <BellDotIcon /> 待处理 3
          </span>
          <button className={styles.iconBtn} aria-label="通知">
            <BellIcon />
            <span className={styles.iconBadge} />
          </button>
          <div className={styles.userCard}>
            <div className={styles.avatar}>M</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>Mock 售前</span>
              <span className={styles.userRole}>presales · 在线</span>
            </div>
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.pageHeader}>
          <div className={styles.pageTitleBlock}>
            <h1 className={styles.pageTitle}>{pageTitle}</h1>
            {pageDescription && <p className={styles.pageDesc}>{pageDescription}</p>}
          </div>
          {actions && <div className={styles.pageActions}>{actions}</div>}
        </div>
        <div className={styles.pageBody}>{children}</div>
      </main>

      <footer className={styles.statusbar}>
        <span><span className={styles.statusDot} />API 已连接</span>
        <span>CRM: mock</span>
        <span>RAGFlow: localhost:19380</span>
        <span className={styles.spacer} />
        <span>{now}</span>
      </footer>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function BellDotIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M21 5a2 2 0 1 0-4 0" />
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function PlusFileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="12" y1="18" x2="12" y2="12" />
      <line x1="9" y1="15" x2="15" y2="15" />
    </svg>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-7" />
    </svg>
  );
}
