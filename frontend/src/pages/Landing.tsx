/** Landing page for FreqDash */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const featKeys = [
  { icon: '🤖', titleKey: 'nav.bots', descKey: 'landing.featuresSubtitle' },
  { icon: '📊', titleKey: 'scoring.title', descKey: 'scoring.desc' },
  { icon: '🛡️', titleKey: 'risk.title', descKey: 'risk.desc' },
  { icon: '📓', titleKey: 'journal.title', descKey: 'journal.desc' },
  { icon: '✅', titleKey: 'checklist.title', descKey: 'checklist.desc' },
  { icon: '⚖️', titleKey: 'compare.title', descKey: 'compare.desc' },
  { icon: '🎯', titleKey: 'nav.pairlistOptimizer', descKey: 'pairlist.subtitle' },
  { icon: '📱', titleKey: 'nav.bots', descKey: 'landing.rentFeatures.3' },
  { icon: '🔍', titleKey: 'nav.discovery', descKey: 'bots.manageDiscovery' },
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
  const { t } = useTranslation();

  const stats = [
    { value: '∞', labelKey: 'landing.stats.bots' },
    { value: '5', labelKey: 'landing.stats.timeframes' },
    { value: '4', labelKey: 'landing.stats.riskLevels' },
    { value: '67', labelKey: 'landing.stats.checklistItems' },
  ];

  const faqItems = [
    { qKey: 'landing.faq.q1', aKey: 'landing.faq.a1' },
    { qKey: 'landing.faq.q2', aKey: 'landing.faq.a2' },
    { qKey: 'landing.faq.q3', aKey: 'landing.faq.a3' },
    { qKey: 'landing.faq.q4', aKey: 'landing.faq.a4' },
    { qKey: 'landing.faq.q5', aKey: 'landing.faq.a5' },
    { qKey: 'landing.faq.q6', aKey: 'landing.faq.a6' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900 dark:text-white">{t('app.shortTitle')}</span>
              <span className="hidden sm:inline text-xs text-gray-500 dark:text-gray-400 ml-1">{t('app.subtitle')}</span>
            </div>
            <div className="flex items-center gap-3">
              <a href="https://docs.freqdash.com/" target="_blank" rel="noopener noreferrer"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t('landing.nav.docs')}
              </a>
              <Link to="/login"
                className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                {t('landing.nav.login')}
              </Link>
              <a href="#pricing"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
                {t('landing.nav.buy')}
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 dark:text-white leading-tight">
              {t('landing.hero.title1')}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                {t('landing.hero.title2')}
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
              {t('landing.hero.subtitle')}
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 transition-all duration-200">
                {t('landing.hero.cta1')}
              </a>
              <Link to="/login"
                className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200">
                {t('landing.hero.cta2')}
              </Link>
            </div>
          </div>
        </div>
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      </section>

      {/* Stats */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 mb-16">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
          {stats.map((s) => (
            <div key={s.labelKey} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400">{s.value}</div>
              <div className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{t(s.labelKey)}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('landing.featuresTitle')}</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            {t('landing.featuresSubtitle')}
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {featKeys.map((f) => (
            <FeatureCard key={f.titleKey} icon={f.icon} title={t(f.titleKey)} desc={t(f.descKey)} />
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('landing.pricingTitle')}</h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">{t('landing.pricingSubtitle')}</p>
        </div>
        <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Monthly */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 hover:shadow-lg transition-all duration-200">
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.rent')}</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">4 990</span>
                <span className="text-lg text-gray-500 dark:text-gray-400"> ₽/мес</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('landing.rentDesc')}</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {[0, 1, 2, 3, 4].map(i => (
                <li key={i} className="flex items-center gap-2">✅ {t(`landing.rentFeatures.${i}`)}</li>
              ))}
            </ul>
            <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
              className="mt-8 block w-full text-center px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
              {t('landing.order')}
            </a>
          </div>

          {/* Lifetime */}
          <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-sm border-2 border-blue-500 dark:border-blue-400 p-8 hover:shadow-lg transition-all duration-200">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
              {t('landing.lifetimeBadge')}
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">{t('landing.lifetime')}</h3>
              <div className="mt-4">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">49 900</span>
                <span className="text-lg text-gray-500 dark:text-gray-400"> ₽</span>
              </div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{t('landing.lifetimeDesc')}</p>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              {[0, 1, 2, 3, 4].map(i => (
                <li key={i} className="flex items-center gap-2">{
                  i === 4 ? '💎 ' : '✅ '
                }{t(`landing.lifetimeFeatures.${i}`)}</li>
              ))}
            </ul>
            <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
              className="mt-8 block w-full text-center px-6 py-3 text-base font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors">
              {t('landing.order')}
            </a>
            <p className="mt-3 text-xs text-center text-gray-400 dark:text-gray-500">
              {t('landing.lifetimeFooter')}
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">{t('landing.faq.title')}</h2>
        </div>
        <div className="space-y-4">
          {faqItems.map((item) => (
            <details key={item.qKey} className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 open:shadow-sm transition-shadow">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer text-sm font-medium text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400">
                {t(item.qKey)}
                <svg className="w-5 h-5 text-gray-400 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {t(item.aKey)}
              </div>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 to-purple-700 px-8 py-16 text-center">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">{t('landing.cta')}</h2>
            <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">{t('landing.ctaDesc')}</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
              <a href="#pricing"
                className="px-8 py-3.5 text-base font-semibold text-blue-700 bg-white hover:bg-blue-50 rounded-xl shadow-lg transition-all duration-200">
                {t('landing.ctaBtn1')}
              </a>
              <a href="https://t.me/geniok" target="_blank" rel="noopener noreferrer"
                className="px-8 py-3.5 text-base font-semibold text-white border-2 border-white/30 hover:border-white/50 rounded-xl transition-all duration-200">
                {t('landing.ctaBtn2')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {t('landing.footer')}
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <a href="https://docs.freqdash.com/" target="_blank" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">{t('landing.nav.docs')}</a>
              <a href="https://t.me/geniok" target="_blank" className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Telegram</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
