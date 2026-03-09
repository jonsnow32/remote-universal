import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, DeviceCard } from '@remote/ui-kit';

export function HomeScreen(): React.ReactElement {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Text style={[styles.title, { color: theme.colors.text, fontSize: theme.typography.fontSize.xl }]}>
        {theme.appName}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deviceList}>
        <DeviceCard
          id="samsung-qled-qn85b"
          name="QLED QN85B"
          brand="Samsung"
          category="TV"
          isConnected
          onPress={() => { /* navigate to remote */ }}
        />
        <DeviceCard
          id="daikin-emura-ftxj"
          name="Emura FTXJ"
          brand="Daikin"
          category="AC"
          onPress={() => { /* navigate to remote */ }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 16,
  },
  title: {
    fontWeight: '700',
    marginBottom: 24,
  },
  deviceList: {
    flexGrow: 0,
  },
});
