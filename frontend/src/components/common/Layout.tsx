import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  key: string;
  href: string;
  icon: string;
}

interface NavGroup {
  key: string;
  icon: string;
  items: NavItem[];
}

// Static nav structure — no hooks. Translations happen at render time in renderNavItem.
const NAV_GROUPS: { key: string; icon: string; items: { key: string; href: string; icon: string }[] }[] = [
    {
      key: 'dashboard',
      icon: '\u{1F4CA}',
      items: [{ key: 'panel', href: '/', icon: '\u{1F4CA}' }],
    },
    {
      key: 'bots',
      icon: '\u{1F916}',
      items: [
        { key: 'botsFreqtrade', href: '/freqtrade-bots', icon: '\u{1F5A5}\uFE0F' },
        { key: 'botHistory', href: '/historic', icon: '\u{1F4C8}' },
        { key: 'discovery', href: '/discovery', icon: '\u{1F50D}' },
      ],
    },
    {
      key: 'analytics',
      icon: '\u{1F4C8}',
      items: [
        { key: 'backtestResults', href: '/backtest', icon: '\u{1F4C9}' },
        { key: 'compare', href: '/compare', icon: '\u2696\uFE0F' },
        { key: 'strategyScoring', href: '/scoring', icon: '\u{1F3C6}' },
        { key: 'risks', href: '/risk', icon: '\u{1F6E1}\uFE0F' },
        { key: 'checklist', href: '/checklist', icon: '\u2705' },
      ],
    },
    {
      key: 'tools',
      icon: '\u{1F6E0}\uFE0F',
      items: [
        { key: 'strategyLab', href: '/strategy-lab', icon: '\u{1F52C}' },
        { key: 'pairlistOptimizer', href: '/pairlist-selector', icon: '\u{1F3AF}' },
        { key: 'financeData', href: '/financedata', icon: '\u{1F4B0}' },
      ],
    },
    {
      key: 'more',
      icon: '\u{1F4CB}',
      items: [
        { key: 'journal', href: '/journal', icon: '\u{1F4D3}' },
        { key: 'alerts', href: '/alerts', icon: '\u{1F514}' },
        { key: 'settings', href: '/settings', icon: '\u2699\uFE0F' },
      ],
    },
  ];

export function Layout({ children }: LayoutProps) {
  const { t, i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const current = window.location.pathname;
    const active = new Set<string>();
    const groups = NAV_GROUPS;
    for (const g of groups) {
      if (g.items.some(item => current === item.href || current.startsWith(item.href + '/'))) {
        active.add(g.key);
      }
    }
    return active;
  });
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const toggleGroup = (name: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const adminItems: NavItem[] = [
    { key: 'users', href: '/users', icon: '\u{1F465}' },
  ];
  const isAdmin = user?.role === 'admin';

  const toggleLanguage = () => {
    const next = i18n.language?.startsWith('ru') ? 'en' : 'ru';
    i18n.changeLanguage(next).catch(console.error);
  };

  const navGroups = NAV_GROUPS;
  const flatNavigation = navGroups.flatMap(g => g.items);

  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.key}
      to={item.href}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
        location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-[#30363d] hover:text-white'
      }`}
    >
      <span className="text-base">{item.icon}</span>
      <span className="font-medium text-sm">{t(`nav.${item.key}`)}</span>
    </Link>
  );

  // Mobile sidebar
  const mobileNav = (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-[#30363d] transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-10 w-10 object-contain rounded" />
          <span className="text-lg font-bold text-[#e6edf3]">{t('app.title')}</span>
        </div>
        <button onClick={() => setSidebarOpen(false)} className="text-[#8b949e] hover:text-[#e6edf3]">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <nav className="px-2 py-4 space-y-1 overflow-y-auto">
        {flatNavigation.map(renderNavItem)}
        {isAdmin && adminItems.map(renderNavItem)}
        <button
          onClick={() => { logout(); setSidebarOpen(false); }}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 w-full mt-4 border-t border-[#30363d] pt-4"
        >
          <span className="text-lg">{'\u{1F6AA}'}</span>
          <span className="font-medium">{t('auth.logout')}</span>
        </button>
      </nav>
    </div>
  );

  // Desktop sidebar
  const desktopNav = (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:bg-[#161b22] lg:border-r lg:border-[#30363d]">
      <div className="flex items-center gap-2 h-16 px-4 border-b border-[#30363d]">
        <img src={logoImage} alt="Logo" className="h-10 w-10 object-contain rounded" />
        <span className="text-lg font-bold text-[#e6edf3]">{t('app.title')}</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navGroups.map(group => {
          const isExpanded = expandedGroups.has(group.key);
          const anyActive = group.items.some(
            item => location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          );

          return (
            <div key={group.key}>
              <button
                onClick={() => toggleGroup(group.key)}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                  anyActive && !isExpanded
                    ? 'text-blue-400 bg-[#1c2533]'
                    : 'text-gray-400 hover:bg-[#30363d] hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{group.icon}</span>
                  <span className="font-semibold text-xs uppercase tracking-wider">{t(`nav.${group.key}`)}</span>
                </span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  isExpanded ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'
                }`}
              >
                <div className="ml-2 border-l border-[#30363d] pl-2 space-y-0.5">
                  {group.items.map(renderNavItem)}
                </div>
              </div>
            </div>
          );
        })}

        {isAdmin && (
          <div>
            <button
              onClick={() => toggleGroup('admin')}
              className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                expandedGroups.has('admin')
                  ? 'text-blue-400 bg-[#1c2533]'
                  : 'text-gray-400 hover:bg-[#30363d] hover:text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-base">{'\u{1F451}'}</span>
                <span className="font-semibold text-xs uppercase tracking-wider">{t('nav.admin')}</span>
              </span>
              <svg
                className={`h-4 w-4 transition-transform duration-200 ${expandedGroups.has('admin') ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ${
                expandedGroups.has('admin') ? 'max-h-40 opacity-100 mt-1' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="ml-2 border-l border-[#30363d] pl-2 space-y-0.5">
                {adminItems.map(renderNavItem)}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Language switcher */}
      <div className="px-2 py-2 border-t border-[#30363d]">
        <button
          onClick={toggleLanguage}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-400 hover:bg-[#30363d] hover:text-gray-200 w-full text-left transition-colors"
        >
          <span className="text-base">{'\u{1F310}'}</span>
          <span className="font-medium text-sm">{i18n.language?.startsWith('ru') ? 'English' : 'Русский'}</span>
        </button>
      </div>

      <div className="px-2 py-2 border-t border-[#30363d]">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 w-full"
        >
          <span className="text-lg">{'\u{1F6AA}'}</span>
          <span className="font-medium">{t('auth.logout')}</span>
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#e6edf3]">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {mobileNav}
      {desktopNav}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        <div className="lg:hidden flex items-center h-14 px-4 bg-[#161b22] border-b border-[#30363d]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-[#8b949e] hover:text-[#e6edf3] mr-4"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src={logoImage} alt="Logo" className="h-8 w-8 object-contain rounded mr-2" />
          <span className="text-lg font-bold text-[#e6edf3]">{t('app.title')}</span>
        </div>
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
