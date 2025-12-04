import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { usePullToRefresh } from '../../../hooks/usePullToRefresh';
import { COLORS } from '../../../theme/colors';
import { useAuth } from '../../auth/AuthProvider';
import FilterBar from '../components/FilterBar';
import ItemCard from '../components/ItemCard';
import ItemListCard from '../components/ItemListCard';
import type { Category, Item } from '../types';
import { useListings } from '../useListings';

type HistoryEntry = { id: string; query: string };

export default function MarketplaceScreen() {
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected] = useState<'all' | Category>('all');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [refreshTick, setRefreshTick] = useState(0);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  // Pair each refresh gesture with a resolver so the pull-to-refresh indicator finishes only after Firestore returns.
  const pendingRefreshResolvers = useRef<(() => void)[]>([]);

  // ViewModel hook encapsulates marketplace data fetching + filtering so this screen can stay presentational.
  const { items, loading, error } = useListings({
    search: debouncedQ,
    category: selected,
    refreshKey: refreshTick,
    currentUserId: user?.uid,
  });

  useEffect(() => {
    if (!loading && pendingRefreshResolvers.current.length) {
      pendingRefreshResolvers.current.forEach((resolve) => resolve());
      pendingRefreshResolvers.current = [];
    }
  }, [loading]);

  useEffect(
    () => () => {
      if (pendingRefreshResolvers.current.length) {
        pendingRefreshResolvers.current.forEach((resolve) => resolve());
        pendingRefreshResolvers.current = [];
      }
    },
    []
  );

  const handleRefresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      pendingRefreshResolvers.current.push(resolve);
      setRefreshTick((tick) => tick + 1);
    });
  }, []);

  // Reuse the shared pull-to-refresh hook so gesture + indicator behavior stays consistent across screens.
  const pullRefresh = usePullToRefresh({
    onRefresh: handleRefresh,
    indicatorOffset: 8,
  });

  const onChangeQuery = (text: string) => {
    setSearchText(text);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(
      () => setDebouncedQ(text.trim().toLowerCase()),
      250
    );
  };

  const data: Item[] = useMemo(() => items, [items]);
  const addHistory = (query: string) => {
    if (!query.trim()) return;
    setHistory((prev) => {
      const existing = prev.filter((entry) => entry.query !== query.trim());
      const updated = [{ id: Date.now().toString(), query: query.trim() }, ...existing];
      return updated.slice(0, 5);
    });
  };
  const handleSubmitSearch = () => {
    addHistory(searchText);
    setShowHistory(false);
  };
  const handleUseHistory = (entry: HistoryEntry) => {
    setSearchText(entry.query);
    setDebouncedQ(entry.query.toLowerCase());
    setShowHistory(false);
  };
  const handleRemoveHistory = (entry: HistoryEntry) => {
    setHistory((prev) => prev.filter((item) => item.id !== entry.id));
  };

  const dismissSearchState = () => {
    setShowHistory(false);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.container}>
      {showHistory && history.length > 0 && (
        <TouchableOpacity
          style={styles.historyBackdrop}
          activeOpacity={1}
          onPress={dismissSearchState}
        />
      )}
      <View style={styles.header}>
        <View style={styles.searchWrapper}>
          <View style={styles.search}>
            <Feather name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.input}
              placeholder="Search items..."
              placeholderTextColor="#9CA3AF"
              value={searchText}
              onChangeText={onChangeQuery}
              onFocus={() => setShowHistory(true)}
              onSubmitEditing={handleSubmitSearch}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          {showHistory && history.length > 0 && (
            <View style={styles.historyDropdown} pointerEvents="auto">
              {history.map((entry) => (
                <View key={entry.id} style={styles.historyItem}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => handleUseHistory(entry)}
                  >
                    <Text style={styles.historyText}>{entry.query}</Text>
                  </TouchableOpacity>
                <TouchableOpacity
                  style={styles.historyDeleteHitSlop}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => handleRemoveHistory(entry)}
                >
                  <Feather name="x" size={14} color="#9CA3AF" />
                </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        <FilterBar selected={selected} onSelect={setSelected} />
        <View style={styles.metaRow}>
          <View style={{ flex: 1 }}>
            {(searchText.length > 0 || selected !== 'all') && (
              <Text style={styles.resultCount}>
                {data.length} result{data.length === 1 ? '' : 's'}
              </Text>
            )}
          </View>
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[styles.viewBtn, view === 'list' && styles.viewBtnActive]}
              onPress={() => setView('list')}
            >
              <Feather
                name="list"
                size={18}
                color={view === 'list' ? COLORS.primary : '#6B7280'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.viewBtn, view === 'grid' && styles.viewBtnActive]}
              onPress={() => setView('grid')}
            >
              <Feather
                name="grid"
                size={18}
                color={view === 'grid' ? COLORS.primary : '#6B7280'}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={{ flex: 1 }}>
        {pullRefresh.indicator}
        {loading && items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: '#6B7280' }}>Loading listings...</Text>
          </View>
        ) : error ? (
          <View style={styles.empty}>
            <Text style={{ color: '#EF4444' }}>{error}</Text>
          </View>
        ) : data.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: '#6B7280' }}>No items match your search.</Text>
          </View>
        ) : (
          <Animated.FlatList
            key={view}
            data={data}
            keyExtractor={(i) => i.id}
            numColumns={view === 'grid' ? 2 : 1}
            renderItem={({ item }) =>
              view === 'grid' ? (
                <ItemCard item={item} />
              ) : (
                <ItemListCard item={item} />
              )
            }
            style={pullRefresh.listStyle}
            contentContainerStyle={
              view === 'grid' ? styles.listContent : styles.listContentList
            }
            columnWrapperStyle={
              view === 'grid' ? styles.gridRow : undefined
            }
            ItemSeparatorComponent={
              view === 'list' ? () => <View style={{ height: 12 }} /> : undefined
            }
            onScroll={pullRefresh.onScroll}
            onScrollEndDrag={pullRefresh.onRelease}
            onMomentumScrollEnd={pullRefresh.onRelease}
            scrollEventThrottle={16}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, position: 'relative' },
  header: {
    backgroundColor: COLORS.white,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchWrapper: {
    marginHorizontal: 16,
    position: 'relative',
    zIndex: 20,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#374151',
  },
  historyDropdown: {
    position: 'absolute',
    top: '100%',
    marginTop: 6,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  historyBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 5,
  },
  historyText: {
    color: '#374151',
    fontSize: 14,
  },
  historyDeleteHitSlop: {
    padding: 6,
    marginLeft: 8,
  },
  resultCount: { color: '#6B7280', fontSize: 12 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 4,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 2,
    gap: 2,
  },
  viewBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewBtnActive: { backgroundColor: COLORS.white },
  listContent: { padding: 16, paddingBottom: 96 },
  listContentList: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },
  gridRow: { justifyContent: 'space-between', marginBottom: 16 },
});
