'use client';

import { useAuth } from '@/hooks/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Clock,
  CalendarOff,
  CheckSquare,
  Users,
  Scale,
  Upload,
  LogOut,
  Menu,
  X,
  ChevronLeft,
  UserCircle,
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ROLE_LABELS } from '@/lib/auth-shared';

const navItems = [
  { href: '/dashboard', label: '工作台', icon: LayoutDashboard },
  { href: '/overtime', label: '加班管理', icon: Clock },
  { href: '/leave', label: '调休管理', icon: CalendarOff },
  { href: '/approval', label: '审批中心', icon: CheckSquare, roles: ['admin', 'management', 'production'] },
  { href: '/employees', label: '人员管理', icon: Users, roles: ['admin', 'management'] },
  { href: '/balances', label: '工时汇总', icon: Scale },
  { href: '/import', label: '数据导入', icon: Upload, roles: ['admin', 'management'] },
  { href: '/profile', label: '个人中心', icon: UserCircle },
];

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const filteredNav = navItems.filter(
    (item) => !item.roles || item.roles.includes(user.role_category) || (user.position === '仓储工班长' && item.roles?.includes('production'))
  );

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-slate-200 transition-all duration-300 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        {/* Logo */}
        <div className={`h-14 flex items-center border-b border-slate-200 px-4 ${sidebarCollapsed ? 'justify-center' : ''}`}>
          <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          {!sidebarCollapsed && (
            <span className="ml-3 font-bold text-slate-800 whitespace-nowrap">调休管理</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
          {filteredNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center h-10 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-sky-50 text-sky-600 font-medium'
                    : 'text-slate-600 hover:bg-slate-100'
                } ${sidebarCollapsed ? 'justify-center' : 'px-3'}`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && <span className="ml-3 text-sm">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse Toggle */}
        <div className="border-t border-slate-200 p-2">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-center h-8 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* User */}
        <div className={`border-t border-slate-200 p-3 ${sidebarCollapsed ? 'flex flex-col items-center' : ''}`}>
          {!sidebarCollapsed && (
            <Link href="/profile" className="flex items-center gap-3 mb-2 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors">
              <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sm font-medium text-sky-600">
                {user.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.position}</p>
              </div>
            </Link>
          )}
          {sidebarCollapsed && (
            <Link href="/profile" className="mb-2">
              <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sm font-medium text-sky-600 hover:bg-sky-200 transition-colors">
                {user.name[0]}
              </div>
            </Link>
          )}
          {!sidebarCollapsed && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">
                {ROLE_LABELS[user.role_category]}
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className={`${sidebarCollapsed ? 'w-8 h-8 p-0' : 'w-full'} text-slate-500 hover:text-red-500`}
          >
            <LogOut className="w-4 h-4" />
            {!sidebarCollapsed && <span className="ml-2">退出登录</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/30" onClick={() => setMobileMenuOpen(false)} />
          <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white shadow-xl z-50 flex flex-col">
            <div className="h-14 flex items-center border-b border-slate-200 px-4">
              <div className="w-8 h-8 bg-sky-500 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <span className="ml-3 font-bold text-slate-800">调休管理</span>
              <button onClick={() => setMobileMenuOpen(false)} className="ml-auto p-1">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <nav className="flex-1 py-4 space-y-1 px-2">
              {filteredNav.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center h-10 px-3 rounded-lg transition-colors ${
                      isActive ? 'bg-sky-50 text-sky-600 font-medium' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="ml-3 text-sm">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-slate-200 p-3">
              <Link href="/profile" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 mb-3 hover:bg-slate-50 rounded-lg p-1 -m-1 transition-colors">
                <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center text-sm font-medium text-sky-600">
                  {user.name[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.position}</p>
                </div>
              </Link>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full text-slate-500 hover:text-red-500">
                <LogOut className="w-4 h-4 mr-2" /> 退出登录
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3">
          <button onClick={() => setMobileMenuOpen(true)} className="p-1">
            <Menu className="w-6 h-6 text-slate-600" />
          </button>
          <span className="font-bold text-slate-800">调休管理</span>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
