import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

interface NavItem {
  name: string;
  href: string;
  icon: string;
}

interface NavGroup {
  name: string;
  icon: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    name: 'Дашборд',
    icon: '📊',
    items: [
      { name: 'Панель', href: '/', icon: '📊' },
    ],
  },
  {
    name: 'Боты',
    icon: '🤖',
    items: [
      { name: 'Боты Freqtrade', href: '/freqtrade-bots', icon: '🖥️' },
      { name: 'История ботов', href: '/historic', icon: '📈' },
      { name: 'Обнаружение', href: '/discovery', icon: '🔍' },
    ],
  },
  {
    name: 'Аналитика',
    icon: '📈',
    items: [
      { name: 'Результаты бэктеста', href: '/backtest', icon: '📉' },
      { name: 'Сравнение', href: '/compare', icon: '⚖️' },
      { name: 'Оценка стратегий', href: '/scoring', icon: '🏆' },
      { name: 'Риски', href: '/risk', icon: '🛡️' },
      { name: 'Чек-лист', href: '/checklist', icon: '✅' },
    ],
  },
  {
    name: 'Инструменты',
    icon: '🛠️',
    items: [
      { name: 'Лаборатория стратегий', href: '/strategy-lab', icon: '🔬' },
      { name: 'Оптимизатор pairlist', href: '/pairlist-selector', icon: '🎯' },
      { name: 'Финансовые данные', href: '/financedata', icon: '💰' },
    ],
  },
  {
    name: 'Ещё',
    icon: '📋',
    items: [
      { name: 'Журнал', href: '/journal', icon: '📓' },
      { name: 'Оповещения', href: '/alerts', icon: '🔔' },
      { name: 'Настройки', href: '/settings', icon: '⚙️' },
    ],
  },
];

// Flat list for mobile (keeps old behaviour for simplicity)
const flatNavigation: NavItem[] = navGroups.flatMap(g => g.items);

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    // Initially expand the group containing the current route
    const current = window.location.pathname;
    const active = new Set<string>();
    for (const g of navGroups) {
      if (g.items.some(item => current === item.href || current.startsWith(item.href + '/'))) {
        active.add(g.name);
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
    { name: 'Пользователи', href: '/users', icon: '👥' },
  ];
  const isAdmin = user?.role === 'admin';

  const renderNavItem = (item: NavItem) => (
    <Link
      key={item.name}
      to={item.href}
      onClick={() => setSidebarOpen(false)}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
        location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          ? 'bg-blue-600 text-white'
          : 'text-gray-300 hover:bg-[#30363d] hover:text-white'
      }`}
    >
      <span className="text-base">{item.icon}</span>
      <span className="font-medium text-sm">{item.name}</span>
    </Link>
  );

  // ── Mobile sidebar (flat, no groups) ──
  const mobileNav = (
    <div
      className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-[#30363d] transform transition-transform duration-300 ease-in-out lg:hidden ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b border-[#30363d]">
        <div className="flex items-center gap-2">
          <img src={logoImage} alt="Logo" className="h-10 w-10 object-contain rounded" />
          <span className="text-lg font-bold text-[#e6edf3]">FreqDashboard</span>
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
          <span className="text-lg">🚪</span>
          <span className="font-medium">Выход</span>
        </button>
      </nav>
    </div>
  );

  // ── Desktop sidebar (grouped, collapsible) ──
  const desktopNav = (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:bg-[#161b22] lg:border-r lg:border-[#30363d]">
      <div className="flex items-center gap-2 h-16 px-4 border-b border-[#30363d]">
        <img src={logoImage} alt="Logo" className="h-10 w-10 object-contain rounded" />
        <span className="text-lg font-bold text-[#e6edf3]">FreqDashboard</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
        {navGroups.map(group => {
          const isExpanded = expandedGroups.has(group.name);
          const anyActive = group.items.some(
            item => location.pathname === item.href || location.pathname.startsWith(item.href + '/')
          );

          return (
            <div key={group.name}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.name)}
                className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                  anyActive && !isExpanded
                    ? 'text-blue-400 bg-[#1c2533]'
                    : 'text-gray-400 hover:bg-[#30363d] hover:text-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{group.icon}</span>
                  <span className="font-semibold text-xs uppercase tracking-wider">{group.name}</span>
                </span>
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Group items */}
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

        {/* Admin items */}
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
                <span className="text-base">👑</span>
                <span className="font-semibold text-xs uppercase tracking-wider">Админ</span>
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

      <div className="px-2 py-4 border-t border-[#30363d]">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 w-full"
        >
          <span className="text-lg">🚪</span>
          <span className="font-medium">Выход</span>
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
        {/* Mobile header with hamburger */}
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
          <span className="text-lg font-bold text-[#e6edf3]">FreqDashboard</span>
        </div>
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
