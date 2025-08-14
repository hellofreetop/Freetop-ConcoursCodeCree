import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated
} from 'react-native';
import { FontAwesome } from '@expo/vector-icons';

const AudioPlayer = memo(({
  message,
  isMe,
  isPlaying,
  onPlay,
  onStop,
  progressAnim
}) => {
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.audioPlayer}>
      <TouchableOpacity onPress={isPlaying ? onStop : onPlay}>
        <FontAwesome 
          name={isPlaying ? 'pause-circle' : 'play-circle'} 
          size={24} 
          color={isMe ? 'white' : '#075E54'} 
        />
      </TouchableOpacity>
      
      <View style={styles.audioProgressContainer}>
        <Animated.View 
          style={[
            styles.audioProgressBar,
            { 
              width: progressAnim?.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%']
              }) || '0%',
              backgroundColor: isMe ? 'rgba(255,255,255,0.7)' : '#075E54'
            }
          ]}
        />
      </View>
      
      <Text style={[
        styles.audioDuration,
        { color: isMe ? 'white' : '#075E54' }
      ]}>
        {formatTime(message.duration)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  audioProgressContainer: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 10,
    borderRadius: 3,
    overflow: 'hidden',
  },
  audioProgressBar: {
    height: '100%',
    borderRadius: 3,
  },
  audioDuration: {
    fontSize: 14,
  },
});

export default AudioPlayer;