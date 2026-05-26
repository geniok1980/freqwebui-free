import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import logoImage from '../../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: 'Панель', href: '/', icon: '📊' },
  { name: 'Боты Freqtrade', href: '/freqtrade-bots', icon: '🖥️' },
  { name: 'История ботов', href: '/historic', icon: '📈' },
  { name: 'Финансовые данные', href: '/financedata', icon: '💰' },
  { name: 'Лаборатория стратегий', href: '/strategy-lab', icon: '🔬' },
  { name: 'Оптимизатор pairlist', href: '/pairlist-selector', icon: '🎯' },
  { name: 'Результаты бэктеста', href: '/backtest', icon: '📉' },
  { name: 'Сравнение', href: '/compare', icon: '⚖️' },
  { name: 'Обнаружение', href: '/discovery', icon: '🔍' },
  { name: 'Оповещения', href: '/alerts', icon: '🔔' },
  { name: 'Настройки', href: '/settings', icon: '⚙️' },
];

const adminNavigation = [
  { name: 'Пользователи', href: '/users', icon: '👥' },
];

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const allNavigation =
    user?.role === 'admin' ? [...navigation, ...adminNavigation] : navigation;

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#e6edf3]">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#161b22] border-r border-[#30363d] transform transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-[#30363d]">
          <div className="flex items-center gap-2">
            <img
              src={logoImage}
              alt="Logo"
              className="h-10 w-10 object-contain rounded"
            />
            <span className="text-lg font-bold text-[#e6edf3]">
              FreqDashboard
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="text-[#8b949e] hover:text-[#e6edf3]"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <nav className="px-2 py-4 space-y-1">
          {allNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-[#30363d] hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
          
          {/* Logout in mobile sidebar */}
          <button
            onClick={() => { logout(); setSidebarOpen(false); }}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-900/20 w-full mt-4 border-t border-[#30363d] pt-4"
          >
            <span className="text-lg">🚪</span>
            <span className="font-medium">Выход</span>
          </button>
        </nav>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:bg-[#161b22] lg:border-r lg:border-[#30363d]">
        <div className="flex items-center gap-2 h-16 px-4 border-b border-[#30363d]">
          <img
            src={logoImage}
            alt="Logo"
            className="h-10 w-10 object-contain rounded"
          />
          <span className="text-lg font-bold text-[#e6edf3]">
            FreqDashboard
          </span>
        </div>
        
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {allNavigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                location.pathname === item.href || location.pathname.startsWith(item.href + '/')
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-[#30363d] hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="font-medium">{item.name}</span>
            </Link>
          ))}
        </nav>
        
        {/* Logout in desktop sidebar */}
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

      {/* Main content */}
      <div className="lg:ml-64 flex flex-col min-h-screen">
        {/* Page content */}
        <main className="flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
