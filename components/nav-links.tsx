'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3, Bell, BriefcaseBusiness, Building2, CalendarCheck2,
  CalendarClock, CalendarDays, ChevronDown, ChevronRight, Clock3,
  Coffee, FileClock, FileSpreadsheet, FileText, Fingerprint,
  FolderOpen, Home, KeyRound, MapPin, Search, Settings2,
  ShieldCheck, ScanFace, UserPlus, UserRound, UsersRound, WifiOff,
  X, type LucideIcon,
} from 'lucide-react';
import './workmate-sidebar.css';

type NavItem = { href: string; label: string };
type SectionId = 'workspace' | 'personal' | 'approvals' | 'management' | 'more';

const sections: { id: SectionId; title: string }[] = [
  { id: 'workspace', title: 'Workspace' },
  { id: 'personal', title: 'My work' },
  { id: 'approvals', title: 'Team & approvals' },
  { id: 'management', title: 'Management' },
  { id: 'more', title: 'More' },
];

const icons: Record<string, LucideIcon> = {
  '/dashboard': Home,
  '/breaks': Coffee,
  '/attendance': BarChart3,
  '/my-profile': UserRound,
  '/mobile-attendance': Fingerprint,
  '/my-attendance-history': CalendarClock,
  '/mobile-attendance/enroll': ScanFace,
  '/face-change': ScanFace,
  '/leaves': CalendarDays,
  '/regularizations': FileClock,
  '/weekly-off': CalendarCheck2,
  '/holidays': CalendarDays,
  '/on-leave-today': CalendarCheck2,
  '/department-employees': UsersRound,
  '/department-attendance': BarChart3,
  '/approvals/leaves': CalendarCheck2,
  '/approvals/regularizations': FileClock,
  '/review-weekly-off': CalendarCheck2,
  '/face-reviews': ScanFace,
  '/departments': Building2,
  '/employees': UsersRound,
  '/employees/new': UserPlus,
  '/employees/import': FileSpreadsheet,
  '/permissions': ShieldCheck,
  '/shifts': Clock3,
  '/attendance-settings': Settings2,
  '/locations': MapPin,
  '/documents': FolderOpen,
  '/password-reset-requests': KeyRound,
  '/leave-policy': FileText,
  '/mobile-attendance/button': Fingerprint,
  '/mobile-attendance/offline': WifiOff,
};

function getSection(href: string): SectionId {
  if (['/dashboard', '/breaks', '/attendance', '/on-leave-today'].includes(href)) return 'workspace';
  if (
    ['/my-profile', '/mobile-attendance', '/my-attendance-history',
      '/mobile-attendance/enroll', '/face-change', '/leaves', '/regularizations',
      '/weekly-off', '/holidays', '/mobile-attendance/button',
      '/mobile-attendance/offline'].includes(href)
  ) return 'personal';
  if (
    href.startsWith('/approvals/') ||
    ['/review-weekly-off', '/face-reviews', '/password-reset-requests',
      '/department-attendance', '/department-employees'].includes(href)
  ) return 'approvals';
  if (
    href.startsWith('/employees') ||
    ['/departments', '/permissions', '/shifts', '/attendance-settings',
      '/locations', '/documents', '/leave-policy'].includes(href)
  ) return 'management';
  return 'more';
}

function pathMatches(pathname: string, href: string) {
  return pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`));
}

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<SectionId, boolean>>({
    workspace: true, personal: false, approvals: false, management: false, more: false,
  });

  // When several links match a nested route, highlight the most specific one only.
  const currentHref = useMemo(
    () => items.filter((item) => pathMatches(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.href,
    [items, pathname],
  );
  const currentSection = currentHref ? getSection(currentHref) : 'workspace';

  useEffect(() => {
    setExpanded((previous) => previous[currentSection]
      ? previous
      : { ...previous, [currentSection]: true });
  }, [currentSection]);

  const term = search.trim().toLocaleLowerCase();
  const matching = term
    ? items.filter((item) => `${item.label} ${item.href}`.toLocaleLowerCase().includes(term))
    : items;

  return (
    <nav aria-label="Work Mate navigation" className="wm-sidebar-links wm-sidebar-v2">
      <div className="wm-side-search-wrap">
        <Search size={17} strokeWidth={2} aria-hidden="true" />
        <input
          aria-label="Search menu"
          type="search"
          placeholder="Search menu..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          autoComplete="off"
        />
        {search && (
          <button type="button" className="wm-side-search-clear" onClick={() => setSearch('')} aria-label="Clear menu search">
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="wm-side-groups">
        {sections.map((section) => {
          const groupItems = matching.filter((item) => getSection(item.href) === section.id);
          if (!groupItems.length) return null;
          const isOpen = Boolean(term) || expanded[section.id] || section.id === 'workspace' || currentSection === section.id;
          const isWorkspace = section.id === 'workspace';
          return (
            <section className="wm-side-group" key={section.id} aria-label={section.title}>
              {!isWorkspace && (
                <button
                  type="button"
                  className="wm-side-group-toggle"
                  aria-expanded={isOpen}
                  onClick={() => setExpanded((previous) => ({ ...previous, [section.id]: !previous[section.id] }))}
                >
                  <span>{section.title}</span>
                  <span className="wm-side-group-right">
                    <span className="wm-side-group-count">{groupItems.length}</span>
                    <ChevronDown size={14} className={isOpen ? 'wm-side-chevron wm-side-chevron-open' : 'wm-side-chevron'} aria-hidden="true" />
                  </span>
                </button>
              )}
              {isOpen && (
                <div className="wm-side-group-links">
                  {groupItems.map((item) => {
                    const Icon = icons[item.href] || BriefcaseBusiness;
                    const active = item.href === currentHref;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        prefetch={false}
                        className="wm-side-link"
                        aria-current={active ? 'page' : undefined}
                        title={item.label}
                        onMouseEnter={() => { if (!active) router.prefetch(item.href); }}
                        onFocus={() => { if (!active) router.prefetch(item.href); }}
                      >
                        <span className="wm-side-link-icon"><Icon size={18} strokeWidth={1.9} aria-hidden="true" /></span>
                        <span className="wm-side-link-text">{item.label}</span>
                        {active && <span className="wm-side-active-mark" aria-hidden="true" />}
                        {!active && <ChevronRight className="wm-side-link-arrow" size={15} aria-hidden="true" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
        {!matching.length && (
          <p className="wm-side-empty">No modules found for “{search.trim()}”.</p>
        )}
      </div>
      <p className="wm-side-help"><Bell size={13} strokeWidth={1.8} aria-hidden="true" /> Select a module to continue</p>
    </nav>
  );
}
