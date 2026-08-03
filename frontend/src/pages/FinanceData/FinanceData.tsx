/**
 * FinanceData Dashboard - Integrated AlexFinanceData into MultibotdashboardV7
 * Fetches real data from backend API
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Newspaper, 
  Activity,
  BarChart3,
  Globe,
  BookOpen,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle
} from 'lucide-react';
import { financeColors } from '../../styles/theme';
import { api } from '../../services/api';

// Types
interface CryptoPrice {
  id: number;
  coin_id: string;
  symbol: string;
  name: string;
  price_usd: number;
  change_24h_pct: number;
  market_cap: number;
  volume_24h: number;
}

interface Stock {
  id: number;
  symbol: string;
  name: string;
  price: number;
  change_percent: number;
  volume: number;
  sector?: string;
}

interface NewsItem {
  id: number;
  title: string;
  source: string;
  url?: string;
  symbol?: string;
  category: string;
  published_at: string;
}

interface BybitOrderbook {
  id: number;
  symbol: string;
  best_bid?: number;
  best_ask?: number;
  mid_price?: number;
  spread_pct?: number;
  bid_depth?: number;
  ask_depth?: number;
  imbalance?: number;
}

interface EconomicIndicator {
  id: number;
  indicator_id: string;
  name: string;
  value: number;
  date?: string;
}

interface SyncStatus {
  [key: string]: {
    source: string;
    status: string;
    records_processed: number;
    error_message?: string;
    created_at: string;
  }
}

export function FinanceData() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('overview');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real data from API
  const [cryptoData, setCryptoData] = useState<CryptoPrice[]>([]);
  const [stocksData, setStocksData] = useState<Stock[]>([]);
  const [newsData, setNewsData] = useState<NewsItem[]>([]);
  const [bybitData, setBybitData] = useState<BybitOrderbook[]>([]);
  const [economicData, setEconomicData] = useState<EconomicIndicator[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({});

  const fetchAllData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch all data in parallel
      const [
        cryptoRes,
        stocksRes,
        newsRes,
        bybitRes,
        economicRes,
        syncRes
      ] = await Promise.allSettled([
        api.get('/finance/crypto/prices?limit=20'),
        api.get('/finance/stocks?limit=20'),
        api.get('/finance/news?limit=20'),
        api.get('/finance/bybit/orderbook'),
        api.get('/finance/economic'),
        api.get('/finance/sync/status')
      ]);

      if (cryptoRes.status === 'fulfilled') {
        setCryptoData(cryptoRes.value.data || []);
      }
      if (stocksRes.status === 'fulfilled') {
        setStocksData(stocksRes.value.data || []);
      }
      if (newsRes.status === 'fulfilled') {
        setNewsData(newsRes.value.data || []);
      }
      if (bybitRes.status === 'fulfilled') {
        setBybitData(bybitRes.value.data || []);
      }
      if (economicRes.status === 'fulfilled') {
        setEconomicData(economicRes.value.data || []);
      }
      if (syncRes.status === 'fulfilled') {
        setSyncStatus(syncRes.value.data || {});
      }

      setLastUpdate(new Date());
    } catch (err) {
      setError(t('finance.error.fetchFailed'));
      console.error('Finance data fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000); // Auto-refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatNumber = (num: number | undefined, decimals: number = 2) => {
    if (num === undefined || num === null) return '-';
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const formatCurrency = (num: number | undefined, decimals: number = 2) => {
    if (num === undefined || num === null) return '-';
    return '$' + formatNumber(num, decimals);
  };

  const formatPercent = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
    const prefix = num >= 0 ? '+' : '';
    return `${prefix}${formatNumber(num)}%`;
  };

  const formatVolume = (num: number | undefined) => {
    if (num === undefined || num === null) return '-';
    if (num >= 1e12) return '$' + formatNumber(num / 1e12) + 'T';
    if (num >= 1e9) return '$' + formatNumber(num / 1e9) + 'B';
    if (num >= 1e6) return '$' + formatNumber(num / 1e6) + 'M';
    return '$' + formatNumber(num);
  };

  const tabs = [
    { id: 'overview', label: t('finance.overview'), icon: Activity },
    { id: 'crypto', label: t('finance.crypto'), icon: BarChart3 },
    { id: 'stocks', label: t('finance.stocks'), icon: DollarSign },
    { id: 'bybit', label: t('finance.bybitOrderbook'), icon: Globe },
    { id: 'economic', label: t('finance.economic'), icon: TrendingUp },
    { id: 'news', label: t('finance.news'), icon: Newspaper },
  ];

  const isSyncError = (source: string) => {
    return syncStatus[source]?.status === 'error';
  };

  return (
    <div className="min-h-screen bg-[#0f1419] text-[#e6edf3]">
      {/* Header */}
      <div className="header-gradient border-b border-[#30363d] px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gradient">{t('finance.title')}</h1>
              <p className="text-[#8b949e] mt-1">{t('finance.subtitle')}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[#8b949e] text-sm">
                <Clock size={16} />
                <span>{t('finance.lastUpdate')}: {lastUpdate.toLocaleTimeString()}</span>
              </div>
              <button
                onClick={fetchAllData}
                disabled={isLoading}
                className="flex items-center gap-2 btn-secondary"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                {t('finance.refresh')}
              </button>
            </div>
          </div>
          
          {error && (
            <div className="mt-4 flex items-center gap-2 text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg px-4 py-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-[#161b22] border-b border-[#30363d] px-6">
        <div className="max-w-7xl mx-auto">
          <nav className="flex gap-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-all border-b-2 ${
                    activeTab === tab.id
                      ? 'text-[#58a6ff] border-b-[#58a6ff]'
                      : 'text-[#8b949e] border-b-transparent hover:text-[#e6edf3]'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card-af p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8b949e] text-sm">{t('finance.btcPrice')}</p>
                    <p className="text-2xl font-bold text-[#e6edf3]">
                      {formatCurrency(cryptoData[0]?.price_usd)}
                    </p>
                    <p className={`text-sm ${(cryptoData[0]?.change_24h_pct || 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                      {formatPercent(cryptoData[0]?.change_24h_pct)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-[#58a6ff]/10 flex items-center justify-center">
                    <BarChart3 size={24} style={{ color: financeColors.crypto }} />
                  </div>
                </div>
                {isSyncError('crypto_prices') && (
                  <p className="text-xs text-[#f85149] mt-2">{t('finance.syncError')}</p>
                )}
              </div>

              <div className="card-af p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8b949e] text-sm">{t('finance.ethPrice')}</p>
                    <p className="text-2xl font-bold text-[#e6edf3]">
                      {formatCurrency(cryptoData[1]?.price_usd)}
                    </p>
                    <p className={`text-sm ${(cryptoData[1]?.change_24h_pct || 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                      {formatPercent(cryptoData[1]?.change_24h_pct)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-[#a371f7]/10 flex items-center justify-center">
                    <BarChart3 size={24} style={{ color: financeColors.stocks }} />
                  </div>
                </div>
              </div>

              <div className="card-af p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8b949e] text-sm">{t('finance.fedFundsRate')}</p>
                    <p className="text-2xl font-bold text-[#e6edf3]">
                      {economicData[0]?.value ? `${economicData[0].value}%` : '-'}
                    </p>
                    <p className="text-sm text-[#8b949e]">
                      {economicData[0]?.date || '-'}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-[#f778ba]/10 flex items-center justify-center">
                    <TrendingUp size={24} style={{ color: financeColors.economic }} />
                  </div>
                </div>
              </div>

              <div className="card-af p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8b949e] text-sm">{t('finance.latestNews')}</p>
                    <p className="text-2xl font-bold text-[#e6edf3]">{newsData.length || 0}</p>
                    <p className="text-sm text-[#8b949e]">{t('finance.today')}</p>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-[#d29922]/10 flex items-center justify-center">
                    <Newspaper size={24} style={{ color: financeColors.news }} />
                  </div>
                </div>
              </div>
            </div>

            {/* Top Movers & Bybit Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="card-af p-5">
                <h3 className="text-lg font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
                  <TrendingUp size={20} style={{ color: financeColors.crypto }} />
                  {t('finance.topCrypto')}
                </h3>
                <div className="space-y-3">
                  {cryptoData.slice(0, 5).map((coin) => (
                    <div key={coin.id} className="flex items-center justify-between py-2 border-b border-[#30363d] last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-[#e6edf3]">{coin.symbol}</span>
                        <span className="text-[#8b949e] text-sm">{coin.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[#e6edf3]">{formatCurrency(coin.price_usd)}</p>
                        <p className={`text-sm ${(coin.change_24h_pct || 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                          {(coin.change_24h_pct || 0) >= 0 ? <ArrowUpRight size={14} className="inline" /> : <ArrowDownRight size={14} className="inline" />}
                          {formatPercent(coin.change_24h_pct)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-af p-5">
                <h3 className="text-lg font-semibold text-[#e6edf3] mb-4 flex items-center gap-2">
                  <Globe size={20} style={{ color: financeColors.bybit }} />
                  {t('finance.bybitOrderbook')}
                </h3>
                <div className="space-y-3">
                  {bybitData.slice(0, 5).map((ob) => (
                    <div key={ob.id} className="flex items-center justify-between py-2 border-b border-[#30363d] last:border-0">
                      <div>
                        <span className="font-medium text-[#e6edf3]">{ob.symbol}</span>
                        <p className="text-[#8b949e] text-xs">{t('finance.spread')}: {((ob.spread_pct || 0) * 100).toFixed(3)}%</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[#e6edf3]">{formatCurrency(ob.mid_price)}</p>
                        <p className={`text-xs ${(ob.imbalance || 0) > 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                          {t('finance.imbalance')}: {formatPercent((ob.imbalance || 0) * 100)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'crypto' && (
          <div className="card-af p-6">
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-6">{t('finance.cryptoPrices')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#30363d]">
                    <th className="text-left py-3 text-[#8b949e] font-medium">{t('finance.coin')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.price')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.change24h')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.marketCap')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.volume24h')}</th>
                  </tr>
                </thead>
                <tbody>
                  {cryptoData.map((coin) => (
                    <tr key={coin.id} className="border-b border-[#30363d]/50 hover:bg-[#1a2332]">
                      <td className="py-4">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-[#e6edf3]">{coin.symbol}</span>
                          <span className="text-[#8b949e] text-sm">{coin.name}</span>
                        </div>
                      </td>
                      <td className="py-4 text-right text-[#e6edf3]">{formatCurrency(coin.price_usd)}</td>
                      <td className={`py-4 text-right ${(coin.change_24h_pct || 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                        {formatPercent(coin.change_24h_pct)}
                      </td>
                      <td className="py-4 text-right text-[#8b949e]">{formatVolume(coin.market_cap)}</td>
                      <td className="py-4 text-right text-[#8b949e]">{formatVolume(coin.volume_24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'stocks' && (
          <div className="card-af p-6">
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-6">{t('finance.stockPrices')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#30363d]">
                    <th className="text-left py-3 text-[#8b949e] font-medium">{t('finance.symbol')}</th>
                    <th className="text-left py-3 text-[#8b949e] font-medium">{t('finance.name')}</th>
                    <th className="text-left py-3 text-[#8b949e] font-medium">{t('finance.sector')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.price')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.change')}</th>
                    <th className="text-right py-3 text-[#8b949e] font-medium">{t('finance.volume')}</th>
                  </tr>
                </thead>
                <tbody>
                  {stocksData.map((stock) => (
                    <tr key={stock.id} className="border-b border-[#30363d]/50 hover:bg-[#1a2332]">
                      <td className="py-4 font-semibold text-[#e6edf3]">{stock.symbol}</td>
                      <td className="py-4 text-[#8b949e]">{stock.name}</td>
                      <td className="py-4 text-[#8b949e]">{stock.sector || '-'}</td>
                      <td className="py-4 text-right text-[#e6edf3]">{formatCurrency(stock.price)}</td>
                      <td className={`py-4 text-right ${(stock.change_percent || 0) >= 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                        {formatPercent(stock.change_percent)}
                      </td>
                      <td className="py-4 text-right text-[#8b949e]">{(stock.volume || 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'bybit' && (
          <div className="card-af p-6">
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-6">{t('finance.bybitOrderbookData')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {bybitData.map((ob) => (
                <div key={ob.id} className="bg-[#0f1419] border border-[#30363d] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-[#e6edf3]">{ob.symbol}</span>
                    <span className="text-[#58a6ff] text-sm">{t('finance.live')}</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-[#8b949e] text-sm">{t('finance.midPrice')}</span>
                      <span className="text-[#e6edf3]">{formatCurrency(ob.mid_price)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8b949e] text-sm">{t('finance.spread')}</span>
                      <span className="text-[#e6edf3]">{((ob.spread_pct || 0) * 100).toFixed(4)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8b949e] text-sm">{t('finance.bidDepth')}</span>
                      <span className="text-[#e6edf3]">{formatVolume(ob.bid_depth)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8b949e] text-sm">{t('finance.askDepth')}</span>
                      <span className="text-[#e6edf3]">{formatVolume(ob.ask_depth)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8b949e] text-sm">{t('finance.imbalance')}</span>
                      <span className={(ob.imbalance || 0) > 0 ? 'text-[#3fb950]' : 'text-[#f85149]'}>
                        {formatPercent((ob.imbalance || 0) * 100)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'economic' && (
          <div className="card-af p-6">
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-6">{t('finance.economicIndicators')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {economicData.map((indicator) => (
                <div key={indicator.id} className="bg-[#0f1419] border border-[#30363d] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[#8b949e] text-sm">{indicator.name}</p>
                      <p className="text-2xl font-bold text-[#e6edf3]">
                        {indicator.indicator_id === 'FEDFUNDS' || indicator.indicator_id === 'UNRATE'
                          ? `${indicator.value}%`
                          : formatNumber(indicator.value)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[#8b949e] text-xs">{indicator.date || '-'}</p>
                      <p className="text-[#58a6ff] text-xs">{indicator.indicator_id}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'news' && (
          <div className="card-af p-6">
            <h2 className="text-xl font-semibold text-[#e6edf3] mb-6">{t('finance.latestNews')}</h2>
            <div className="space-y-4">
              {newsData.map((news) => (
                <div key={news.id} className="bg-[#0f1419] border border-[#30363d] rounded-lg p-4 hover:border-[#58a6ff] transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-[#e6edf3] font-medium mb-2">{news.title}</h3>
                      <div className="flex items-center gap-3 text-sm text-[#8b949e]">
                        <span className="px-2 py-0.5 rounded bg-[#21262d] text-[#58a6ff]">{news.source}</span>
                        <span className="px-2 py-0.5 rounded bg-[#21262d] text-[#8b949e]">{news.category}</span>
                        <span>{new Date(news.published_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <BookOpen size={20} className="text-[#8b949e] ml-4" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
