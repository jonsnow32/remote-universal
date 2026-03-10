import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  StatusBar,
} from 'react-native';

type Category = 'All' | 'Drama' | 'Sports' | 'Movie';

interface Show {
  id: string;
  title: string;
  channel: string;
  channelColor: string;
  time: string;
  duration: string;
  category: Category | 'Sports';
  isLive: boolean;
}

const SHOWS: Show[] = [
  { id: '1', title: 'UEFA Champions League', channel: 'ESPN HD', channelColor: '#E84B3A', time: 'Now', duration: '22:00', category: 'Sports', isLive: true },
  { id: '2', title: 'Late Night Talk Show', channel: 'NBC', channelColor: '#0070D2', time: '21:30', duration: '22:30', category: 'Drama', isLive: false },
  { id: '3', title: 'Crime Drama Special', channel: 'HBO', channelColor: '#6C1F7C', time: '22:00', duration: '23:30', category: 'Drama', isLive: false },
  { id: '4', title: 'Nature Documentary', channel: 'Netflix', channelColor: '#E50914', time: '22:30', duration: '00:00', category: 'Movie', isLive: false },
  { id: '5', title: 'NBA Playoffs 2024', channel: 'ESPN', channelColor: '#E84B3A', time: '20:30', duration: '23:00', category: 'Sports', isLive: false },
  { id: '6', title: 'Blockbuster Movie Night', channel: 'HBO', channelColor: '#6C1F7C', time: '21:00', duration: '23:15', category: 'Movie', isLive: false },
];

const CATEGORIES: Category[] = ['All', 'Drama', 'Sports', 'Movie'];

export function TVGuideScreen(): React.ReactElement {
  const [activeCategory, setActiveCategory] = useState<Category>('All');

  const filtered = activeCategory === 'All'
    ? SHOWS
    : SHOWS.filter(s => s.category === activeCategory);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0A0E1A" />

      <View style={styles.header}>
        <Text style={styles.title}>TV Guide</Text>
        <Text style={styles.subtitle}>Today</Text>
      </View>

      {/* Category filter */}
      <View style={styles.categories}>
        {CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.catPill, activeCategory === cat && styles.catPillActive]}
            onPress={() => setActiveCategory(cat)}
            activeOpacity={0.8}
          >
            <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={[styles.showRow, item.isLive && styles.showRowLive]}>
            {item.isLive && (
              <View style={styles.liveBadgePulse}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
            <View style={styles.timeCol}>
              <Text style={[styles.timeText, item.isLive && { color: '#00C896' }]}>{item.time}</Text>
              <Text style={styles.untilText}>→ {item.duration}</Text>
            </View>
            <View style={styles.showInfo}>
              <Text style={styles.showTitle} numberOfLines={1}>{item.title}</Text>
              <View style={[styles.channelBadge, { backgroundColor: item.channelColor + '22', borderColor: item.channelColor + '55' }]}>
                <Text style={[styles.channelText, { color: item.channelColor }]}>{item.channel}</Text>
              </View>
            </View>
            {item.isLive && (
              <TouchableOpacity style={styles.tuneBtn} activeOpacity={0.8}>
                <Text style={styles.tuneBtnText}>Tune</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#8892A4',
    marginTop: 2,
  },
  categories: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  catPill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#141928',
    borderWidth: 1,
    borderColor: '#2A3147',
  },
  catPillActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  catText: {
    color: '#8892A4',
    fontSize: 13,
    fontWeight: '600',
  },
  catTextActive: {
    color: '#FFFFFF',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    gap: 10,
  },
  showRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141928',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  showRowLive: {
    borderWidth: 1,
    borderColor: '#00C89633',
    backgroundColor: '#001A12',
  },
  liveBadgePulse: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#00C896',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
  },
  liveText: {
    color: '#00C896',
    fontSize: 9,
    fontWeight: '800',
  },
  timeCol: {
    width: 48,
    marginLeft: 6,
  },
  timeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  untilText: {
    color: '#8892A4',
    fontSize: 11,
    marginTop: 2,
  },
  showInfo: {
    flex: 1,
    gap: 5,
  },
  showTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  channelBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  channelText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tuneBtn: {
    backgroundColor: '#6C63FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
  },
  tuneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
