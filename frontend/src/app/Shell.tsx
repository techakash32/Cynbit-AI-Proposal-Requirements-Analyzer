import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, BookOpen, ChevronRight, FilePlus2, FolderKanban, LayoutDashboard, LogOut, Menu, Settings, Sparkles, UserRound } from 'lucide-react';
import { api } from '../lib/api';
import type { User } from '../types/api';
import { useUIStore } from '../stores/ui';
import { Button } from '../components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Sheet, SheetContent, SheetTitle, SheetTrigger } from '../components/ui/radix';
import { BrandSignature } from '../components/shared/BrandSignature';

const navItems = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/projects/new', label: 'New Analysis', icon: FilePlus2 },
  { to: '/projects', label: 'My Projects', icon: FolderKanban },
  { to: '/proposals', label: 'Proposal Library', icon: Sparkles },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help & Documentation', icon: BookOpen },
];

export function Sidebar({ onNavigate, pathname }: { onNavigate?: () => void; pathname: string }) {
  const reduceMotion = useReducedMotion();
  return <aside className="flex h-full w-full flex-col bg-paper p-4">
    <Link to="/dashboard" onClick={onNavigate} className="mb-6 flex items-center gap-3 px-2 py-1 font-semibold tracking-tight"><BrandSignature /></Link>
    <nav className="flex flex-col gap-1" aria-label="Main navigation">
      {navItems.map(({ to, label, icon: Icon, end }) => {
        const active = end ? pathname === to : pathname === to || (to === '/projects' && pathname.startsWith('/projects/')) || (to === '/proposals' && pathname.startsWith('/proposals/')) || (to === '/analytics' && pathname.startsWith('/analyses'));
        return <NavLink key={to} to={to} end={end} onClick={onNavigate} className={`relative z-0 flex min-h-10 items-center gap-3 rounded-pill px-3 text-sm transition-colors ${active ? 'font-semibold text-paper' : 'text-muted-copy hover:bg-soft hover:text-copy'}`} aria-current={active ? 'page' : undefined}>
          {active && <motion.span className="nav-pill" layoutId="sidebar-active" transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 36 }} />}
          <Icon size={16} aria-hidden="true" /><span>{label}</span>
        </NavLink>;
      })}
    </nav>
    <div className="mt-auto border-t border-line pt-4"><p className="px-2 text-xs text-muted-copy">Assessment prototype · not an official Cynbit product</p></div>
  </aside>;
}

export function Shell({ user, children }: { user: User; children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const mobileOpen = useUIStore((state) => state.mobileSidebarOpen);
  const setMobileOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const path = location.pathname;
  const crumbs = path.split('/').filter(Boolean).map((segment) => ({ name: segment.replace(/-/g, ' '), href: `/${segment}` }));
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'U';
  async function logout() { try { await api('/auth/logout', { method: 'POST' }); } finally { navigate('/login', { replace: true }); } }
  return <div className="min-h-screen bg-paper text-copy">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <div className="sidebar-frame fixed inset-y-0 left-0 hidden border-r border-line lg:block"><Sidebar pathname={path} /></div>
    <header className="app-header sticky top-0 z-20 flex items-center justify-between border-b border-line bg-paper px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2"><Sheet open={mobileOpen} onOpenChange={setMobileOpen}><SheetTrigger asChild><Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu size={18} /></Button></SheetTrigger><SheetContent className="sheet-panel p-0 lg:hidden"><div className="visually-hidden"><SheetTitle>Navigation</SheetTitle></div><Sidebar pathname={path} onNavigate={() => setMobileOpen(false)} /></SheetContent></Sheet>
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm capitalize"><Link to="/dashboard" className="shrink-0 text-muted-copy hover:text-copy">Workspace</Link>{crumbs.length > 0 && <ChevronRight size={14} className="shrink-0 text-muted-copy" />}{crumbs.length > 0 && <span className="truncate font-medium text-copy">{crumbs.at(-1)?.name}</span>}</nav></div>
      <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="h-10 gap-2 rounded-pill px-2" aria-label="User menu"><span className="user-avatar grid place-items-center rounded-pill border border-line font-mono text-xs">{initials}</span><span className="user-email hidden truncate text-sm sm:inline">{user.email}</span></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><div className="px-3 py-2"><p className="text-sm font-medium">{user.name}</p><p className="text-xs text-muted-copy">{user.email}</p></div><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => navigate('/settings')}><UserRound className="mr-2" size={14} />Settings</DropdownMenuItem><DropdownMenuItem onSelect={() => void logout()}><LogOut className="mr-2" size={14} />Logout</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </header>
    <main id="main-content" tabIndex={-1} className="app-main px-4 py-6 outline-none sm:px-6"><div className="page-width">{children}</div></main>
  </div>;
}
