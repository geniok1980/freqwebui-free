import React, {useState} from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Linking,
} from 'react-native';
import {useCryptoPrices, useNews, useEconomicIndicators} from '../hooks/useApi';
import {theme} from '../theme';

type Tab = 'prices' | 'movers' | 'news';

export function FinanceDataScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('prices');
  const [refreshing, setRefreshing] = useState(false);

  const {data: prices, isLoading: pricesLoading, refetch: refetchPrices} = useCryptoPrices();
  const {data: news, isLoading: newsLoading, refetch: refetchNews} = useNews();
  const {data: economic} = useEconomicIndicators();

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchPrices(), refetchNews()]);
    setRefreshing(false);
  };

  const sortedPrices = [...(prices || [])].sort(
    (a, b) => Math.abs(b.change_24h_pct || 0) - Math.abs(a.change_24h_pct || 0),
  );

  const renderTab = (tab: Tab, label: string) => (
    <TouchableOpacity
      key={tab}
      style={[styles.tab, activeTab === tab && styles.tabActive]}
      onPress={() => setActiveTab(tab)}>
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Финансовые данные</Text>
        <Text style={styles.subtitle}>Крипто, новости, макро</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        {renderTab('prices', 'Цены')}
        {renderTab('movers', 'Movers')}
        {renderTab('news', 'Новости')}
      </View>

      {activeTab === 'prices' && (
        <FlatList
          data={prices || []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <View style={styles.priceRow}>
              <View style={{flex: 1}}>
                <Text style={styles.coinName}>{item.name}</Text>
                <Text style={styles.coinSymbol}>{item.symbol.toUpperCase()}</Text>
              </View>
              <View style={{alignItems: 'flex-end'}}>
                <Text style={styles.priceValue}>
                  ${item.price_usd.toLocaleString(undefined, {maximumFractionDigits: 6})}
                </Text>
                {item.change_24h_pct !== undefined && (
                  <Text
                    style={[
                      styles.changeValue,
                      {color: item.change_24h_pct >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative},
                    ]}>
                    {item.change_24h_pct >= 0 ? '+' : ''}
                    {item.change_24h_pct.toFixed(2)}%
                  </Text>
                )}
              </View>
              {item.market_cap && (
                <Text style={styles.marketCap}>
                  ${(item.market_cap / 1_000_000_000).toFixed(1)}B
                </Text>
              )}
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{pricesLoading ? 'Загрузка...' : 'Нет данных'}</Text>
          }
        />
      )}

      {activeTab === 'movers' && (
        <FlatList
          data={sortedPrices.filter(p => p.change_24h_pct !== undefined).slice(0, 30)}
          keyExtractor={item => `mover-${item.id}`}
          renderItem={({item}) => (
            <View style={styles.priceRow}>
              <View style={{flex: 1}}>
                <Text style={styles.coinName}>{item.name}</Text>
                <Text style={styles.coinSymbol}>{item.symbol.toUpperCase()}</Text>
              </View>
              <Text
                style={[
                  styles.changeValueLarge,
                  {color: (item.change_24h_pct || 0) >= 0 ? theme.colors.profitPositive : theme.colors.profitNegative},
                ]}>
                {(item.change_24h_pct || 0) >= 0 ? '+' : ''}
                {(item.change_24h_pct || 0).toFixed(2)}%
              </Text>
            </View>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.empty}>Нет данных</Text>}
        />
      )}

      {activeTab === 'news' && (
        <FlatList
          data={news || []}
          keyExtractor={item => String(item.id)}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.newsCard}
              onPress={() => item.url && Linking.openURL(item.url)}
              activeOpacity={0.7}>
              <View style={styles.newsHeader}>
                <Text style={styles.newsSource}>{item.source}</Text>
                {item.symbol && <Text style={styles.newsSymbol}>{item.symbol}</Text>}
                {item.published_at && (
                  <Text style={styles.newsDate}>
                    {new Date(item.published_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
              <Text style={styles.newsTitle}>{item.title}</Text>
              {item.sentiment_score !== undefined && (
                <View style={styles.sentimentRow}>
                  <View
                    style={[
                      styles.sentimentBar,
                      {
                        width: `${Math.abs(item.sentiment_score) * 100}%`,
                        backgroundColor:
                          item.sentiment_score > 0.3
                            ? theme.colors.profitPositive
                            : item.sentiment_score < -0.3
                            ? theme.colors.profitNegative
                            : theme.colors.warning,
                      },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
          }
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>{newsLoading ? 'Загрузка...' : 'Нет новостей'}</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: theme.colors.bg},
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: 56,
    paddingBottom: theme.spacing.md,
    backgroundColor: theme.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {fontSize: theme.fontSize.xl, fontWeight: '800', color: theme.colors.text},
  subtitle: {fontSize: theme.fontSize.sm, color: theme.colors.textMuted, marginTop: 2},

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.bg,
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.bgCard,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  tabActive: {backgroundColor: theme.colors.primary, borderColor: theme.colors.primary},
  tabText: {fontSize: theme.fontSize.sm, color: theme.colors.textSecondary},
  tabTextActive: {color: '#fff'},

  list: {paddingHorizontal: theme.spacing.lg, paddingBottom: 100},
  empty: {textAlign: 'center', color: theme.colors.textMuted, marginTop: 60},

  // Price rows
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  coinName: {fontSize: theme.fontSize.md, fontWeight: '600', color: theme.colors.text},
  coinSymbol: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginTop: 2},
  priceValue: {fontSize: theme.fontSize.md, fontWeight: '700', color: theme.colors.text},
  changeValue: {fontSize: theme.fontSize.sm, fontWeight: '600', marginTop: 2, textAlign: 'right'},
  changeValueLarge: {fontSize: theme.fontSize.lg, fontWeight: '700', minWidth: 80, textAlign: 'right'},
  marketCap: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted},

  // News
  newsCard: {
    backgroundColor: theme.colors.bgCard,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  newsHeader: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6},
  newsSource: {fontSize: theme.fontSize.xs, color: theme.colors.primary, fontWeight: '600'},
  newsSymbol: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.warning,
    backgroundColor: '#f59e0b20',
    paddingHorizontal: 4,
    borderRadius: 4,
    overflow: 'hidden',
  },
  newsDate: {fontSize: theme.fontSize.xs, color: theme.colors.textMuted, marginLeft: 'auto'},
  newsTitle: {fontSize: theme.fontSize.md, color: theme.colors.text, lineHeight: 20},
  sentimentRow: {
    height: 4,
    backgroundColor: theme.colors.border,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  sentimentBar: {height: 4, borderRadius: 2},
});
