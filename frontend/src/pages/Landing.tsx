/** Landing page for FreqDash */
import { Link } from 'react-router-dom';

const features = [
  {
    icon: '🤖',
    title: 'Мониторинг ботов',
    desc: 'Единый дашборд для всех ваших Freqtrade-ботов в реальном времени. Состояние, метрики, прибыль — всё в одном месте.',
  },
  {
    icon: '📊',
    title: 'Scoring Dashboard',
    desc: 'Оценка стратегий по 4 группам метрик: доходность 40%, риск 30%, стабильность 20%, эффективность 10%.',
  },
  {
    icon: '🛡️',
    title: 'Управление рисками',
    desc: '4 уровня контроля: на сделку, портфельный, дневной и недельный лимиты. Цветовая индикация и рекомендации.',
  },
  {
    icon: '📓',
    title: 'Журнал торговли',
    desc: 'Встроенный Trading Journal с авто-шаблонами и оценкой качества сигналов по методологии курса Freqtrade.',
  },
  {
    icon: '✅',
    title: 'Pre-Launch Checklist',
    desc: '67 пунктов проверки стратегии перед запуском. Автоматический подсчёт баллов и готовности (урок 22).',
  },
  {
    icon: '⚖️',
    title: 'Сравнение B↔D↔L',
    desc: 'Сверка Backtest, Dry-Run и Live с допусками ±50% по доходности и ≤1.5x по просадке.',
  },
  {
    icon: '🎯',
    title: 'Редактор pairlist',
    desc: 'Добавляйте и меняйте торговые пары прямо из интерфейса без редактирования JSON.',
  },
  {
    icon: '📱',
    title: 'Мобильное приложение',
    desc: 'Нативные приложения для iOS и Android. Весь дашборд всегда под рукой.',
  },
  {
    icon: '🔍',
    title: 'Автообнаружение',
    desc: 'Боты обнаруживаются автоматически через Docker. Добавьте контейнер — он появится в дашборде.',
  },
];

const faq = [
  {
    q: 'Что такое FreqDash?',
    a: 'FreqDash — это профессиональная веб-панель для мониторинга и управления неограниченным количеством торговых ботов Freqtrade из единого интерфейса. Включает интеграцию с курсом обучения Freqtrade.',
  },
  {
    q: 'Нужен ли свой сервер?',
    a: 'Да, FreqDash устанавливается на ваш собственный сервер (VPS) через Docker. Полный контроль над вашими данными и ботами.',
  },
  {
    q: 'Чем отличается аренда от LifeTime?',
    a: 'Аренда — 4 990 ₽/месяц с обновлениями и поддержкой. LifeTime — единоразовый платёж 49 900 ₽, навсегда ваш со всеми будущими обновлениями.',
  },
  {
    q: 'Сколько ботов можно подключить?',
    a: 'Неограниченное количество. FreqDash спроектирован для масштабирования — от одного бота до целого флота.',
  },
  {
    q: 'Есть ли демо-доступ?',
    a: 'Да, вы можете протестировать дашборд в демо-режиме перед покупкой. Обратитесь в Telegram для получения доступа.',
  },
  {
    q: 'Как получить обновления?',
    a: 'При аренде обновления выходят автоматически. При LifeTime — вы получаете все будущие обновления бесплатно.',
  },
];

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="group bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-200">
      <div className="text-3xl mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{desc}</p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* ── Navigation ── */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900 dark:text-white">FreqDash</span>
              <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 ml-1">Multi-Bot Dashboard</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://docs.freqdash.com/" target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Документация
              </a>
              <Link to="/login"
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Войти
              </Link>
              <a href="#pricing"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                Купить
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
              Управляй флотом
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                Freqtrade-ботов
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
              Профессиональная панель для мониторинга и управления неограниченным количеством ботов.
              Встроенные инструменты анализа рисков, оценки стратегий и журнал торговли — всё в одном интерфейсе.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200">
                Начать использовать
              </a>
              <Link to="/login"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                Войти в панель
              </Link>
            </div>
          </div>
        </div>
        {/* Decorative gradient */}
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* ── Stats ── */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {[
            { value: '∞', label: 'Ботов' },
            { value: '5', label: 'Таймфреймов' },
            { value: '4', label: 'Уровня риска' },
            { value: '67', label: 'Пунктов чек-листа' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{s.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Все инструменты в одном окне</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            FreqDash объединяет всё, что нужно для профессиональной торговли на Freqtrade.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Выберите тариф</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Начните с аренды или приобретите пожизненный доступ
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Monthly */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Аренда</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">4 990</span>
                <span className="text-lg text-gray-500 dark:text-gray-400"> ₽/мес</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Гибкий доступ, все обновления</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">✅ Все функции дашборда</li>
              <li className="flex items-center gap-2">✅ Неограниченное количество ботов</li>
              <li className="flex items-center gap-2">✅ Обновления и поддержка</li>
              <li className="flex items-center gap-2">✅ Мобильное приложение</li>
              <li className="flex items-center gap-2">✅ Документация курса</li>
            </ul>
            <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
              className="mt-8 block w-full text-center px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
              Оформить
            </a>
          </div>

          {/* Lifetime */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-blue-500 dark:border-blue-400 p-8 hover:shadow-lg transition-all duration-200">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
              Лучшая цена
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">LifeTime</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">49 900</span>
                <span className="text-lg text-gray-500 dark:text-gray-400"> ₽</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Единоразовый платёж, навсегда</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">✅ Всё из тарифа Аренда</li>
              <li className="flex items-center gap-2">✅ Пожизненные обновления</li>
              <li className="flex items-center gap-2">✅ Приоритетная поддержка</li>
              <li className="flex items-center gap-2">✅ Ранний доступ к новым функциям</li>
              <li className="flex items-center gap-2">💎 Навсегда ваш</li>
            </ul>
            <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
              className="mt-8 block w-full text-center px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
              Оформить
            </a>
            <p className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500">
              Не платите больше никогда — одноразовая покупка
            </p>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">Частые вопросы</h2>
        </div>
        <div className="space-y-4">
          {faq.map((item) => (
            <details key={item.q} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 open:shadow-sm transition-shadow">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                {item.q}
                <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.a}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 px-8 py-16 text-center">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Готовы управлять своим флотом?</h2>
            <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
              Присоединяйтесь к сообществу FreqDash. Получите полный контроль над вашими торговыми ботами уже сегодня.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing"
                className="px-8 py-3.5 text-base font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all duration-200">
                Выбрать тариф
              </a>
              <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
                className="px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:border-white/50 rounded-xl transition-all duration-200">
                Связаться в Telegram
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              © 2026 FreqDash. Все права защищены.
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <a href="https://docs.freqdash.com/" target="_blank" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Документация</a>
              <a href="https://t.me/geniok" target="_blank" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Telegram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
