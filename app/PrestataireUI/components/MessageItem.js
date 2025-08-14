import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Image,
  Vibration
} from 'react-native';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import AudioPlayer from './AudioPlayer';

const MessageItem = memo(({
  item,
  senderId,
  otherUser,
  selectedMessages,
  onLongPress,
  onScrollToReply,
  onImagePress,
  currentPlayingAudio,
  onPlayAudio,
  onStopAudio,
  progressAnims
}) => {
  const isMe = item.sender_id === senderId;
  const isSelected = selectedMessages.some(m => m.id === item.id);

  const formatMessageTime = (timestamp) => {
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const handleLongPress = () => {
    onLongPress(item);
    Vibration.vibrate(50);
  };

  return (
    <View 
      style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage,
        isSelected && styles.selectedMessage
      ]}
    >
      {/* Reply Indicator */}
      {item.reply_to && (
        <Pressable 
          onPress={() => onScrollToReply(item.reply_to.id)}
          style={[
            styles.replyIndicator,
            isMe ? styles.myReplyIndicator : styles.otherReplyIndicator
          ]}
        >
          <View style={[
            styles.replyLine,
            isMe ? styles.myReplyLine : styles.otherReplyLine
          ]} />
          <View style={styles.replyContent}>
            <Text style={[
              styles.replySender,
              isMe ? styles.myReplySender : styles.otherReplySender
            ]}>
              {item.reply_to.sender_id === senderId ? 'Vous' : otherUser.name}
            </Text>
            {item.reply_to.type === 'image' ? (
              <Ionicons name="image" size={16} color={isMe ? 'white' : '#075E54'} />
            ) : item.reply_to.type === 'audio' ? (
              <Ionicons name="mic" size={16} color={isMe ? 'white' : '#075E54'} />
            ) : (
              <Text style={styles.replyText} numberOfLines={1}>
                {item.reply_to.content}
              </Text>
            )}
          </View>
        </Pressable>
      )}

      {/* Message Content */}
      {item.type === 'text' && (
        <Pressable onLongPress={handleLongPress}>
          <Text style={[
            styles.messageText,
            isMe ? styles.myMessageText : styles.otherMessageText
          ]}>
            {item.content}
          </Text>
        </Pressable>
      )}
      
      {item.type === 'image' && (
        <Pressable onLongPress={handleLongPress} onPress={() => onImagePress(item)}>
          <Image
            source={{ uri: item.file_url ? item.file_url[0] : item.localUri }}
            style={styles.imageMessage}
          />
          {item.content && (
            <Text style={[
              styles.captionText,
              isMe ? styles.myCaptionText : styles.otherCaptionText
            ]}>
              {item.content}
            </Text>
          )}
        </Pressable>
      )}
      
      {item.type === 'audio' && (
        <Pressable onLongPress={handleLongPress}>
          <AudioPlayer
            message={item}
            isMe={isMe}
            isPlaying={currentPlayingAudio === item.id}
            onPlay={() => onPlayAudio(item.id, item.file_url ? item.file_url[0] : item.localAudioUri)}
            onStop={onStopAudio}
            progressAnim={progressAnims[item.id]}
          />
        </Pressable>
      )}
      
      {/* Message Footer */}
      <View style={styles.messageFooter}>
        <Text style={[
          styles.messageTime,
          isMe ? styles.myMessageTime : styles.otherMessageTime
        ]}>
          {formatMessageTime(item.created_at)}
          {item.edited && ' (modifié)'}
        </Text>
        {isMe && (
          <View style={styles.statusContainer}>
            {!item.synced ? (
              <Ionicons 
                name="cloud-offline" 
                size={16} 
                color="rgba(255,255,255,0.7)" 
                style={styles.statusIcon}
              />
            ) : item.is_read ? (
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color="#34B7F1" 
                style={styles.statusIcon}
              />
            ) : (
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color="rgba(255,255,255,0.7)" 
                style={styles.statusIcon}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#075E54',
    borderTopRightRadius: 0,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderTopLeftRadius: 0,
  },
  selectedMessage: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#075E54',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: 'white',
  },
  otherMessageText: {
    color: '#075E54',
  },
  imageMessage: {
    width: 250,
    height: 250,
    borderRadius: 8,
  },
  captionText: {
    fontSize: 14,
    marginTop: 5,
  },
  myCaptionText: {
    color: 'white',
  },
  otherCaptionText: {
    color: '#075E54',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  messageTime: {
    fontSize: 12,
    marginRight: 5,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: 'rgba(0,0,0,0.5)',
  },
  statusContainer: {
    flexDirection: 'row',
  },
  statusIcon: {
    marginLeft: 5,
  },
  replyIndicator: {
    flexDirection: 'row',
    marginBottom: 5,
    borderRadius: 5,
    padding: 5,
  },
  myReplyIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  otherReplyIndicator: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  replyLine: {
    width: 3,
    marginRight: 5,
  },
  myReplyLine: {
    backgroundColor: 'white',
  },
  otherReplyLine: {
    backgroundColor: '#075E54',
  },
  replyContent: {
    flex: 1,
  },
  replySender: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  myReplySender: {
    color: 'white',
  },
  otherReplySender: {
    color: '#075E54',
  },
  replyText: {
    fontSize: 12,
    color: 'white',
  },
});

export default MessageItem;