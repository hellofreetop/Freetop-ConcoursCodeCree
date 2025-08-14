import React, { memo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const RecordingIndicator = memo(({
  isRecording,
  recordingDuration,
  onStopRecording
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isRecording) return null;

  return (
    <View style={styles.recordingIndicatorContainer}>
      <View style={styles.recordingContent}>
        <View style={styles.recordingAnimation}>
          <Animated.View 
            style={[
              styles.recordingPulse,
              { transform: [{ scale: pulseAnim }] }
            ]} 
          />
        </View>
        <Text style={styles.recordingText}>
          Enregistrement... {formatTime(recordingDuration)}
        </Text>
        <TouchableOpacity 
          style={styles.stopRecordingButton}
          onPress={onStopRecording}
        >
          <Ionicons name="stop" size={24} color="white" />
        </TouchableOpacity>
      </View>
      <Text style={styles.recordingHint}>
        Relâchez pour envoyer, glissez pour annuler
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  recordingIndicatorContainer: {
    position: 'absolute',
    bottom: 70,
    left: 0,
    right: 0,
    backgroundColor: '#075E54',
    padding: 15,
    alignItems: 'center',
  },
  recordingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingAnimation: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  recordingPulse: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'red',
  },
  recordingText: {
    color: 'white',
    fontSize: 16,
    flex: 1,
  },
  recordingHint: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 5,
  },
  stopRecordingButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default RecordingIndicator;