import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OfflineIndicator = memo(({ isOnline }) => {
  if (isOnline) return null;

  return (
    <View style={styles.offlineBar}>
      <View style={styles.offlineContent}>
        <Ionicons name="cloud-offline" size={16} color="white" />
        <Text style={styles.offlineText}>
          Mode hors ligne - Les messages seront envoyés lors de la reconnexion
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  offlineBar: {
    backgroundColor: '#E53E3E',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  offlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    marginLeft: 6,
    textAlign: 'center',
  },
});

export default OfflineIndicator;