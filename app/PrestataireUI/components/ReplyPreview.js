import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ReplyPreview = memo(({
  visible,
  replyingTo,
  senderId,
  otherUser,
  keyboardHeight,
  onCancel
}) => {
  if (!visible || !replyingTo) return null;

  const getMessagePreview = () => {
    switch (replyingTo.type) {
      case 'text':
        return replyingTo.content;
      case 'image':
        return '📷 Photo';
      case 'audio':
        return '🎤 Message audio';
      default:
        return 'Message';
    }
  };

  return (
    <View style={[
      styles.replyPreview,
      { bottom: keyboardHeight > 0 ? keyboardHeight + 10 : 70 }
    ]}>
      <View style={styles.replyIndicator} />
      <View style={styles.replyContent}>
        <Text style={styles.replyToText}>
          Réponse à {replyingTo.sender_id === senderId ? 'vous' : otherUser?.name || 'Utilisateur'}
        </Text>
        <Text style={styles.replyMessageText} numberOfLines={1}>
          {getMessagePreview()}
        </Text>
      </View>
      <TouchableOpacity 
        onPress={onCancel}
        style={styles.cancelButton}
      >
        <Ionicons name="close" size={24} color="#E53E3E" />
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  replyPreview: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#f8f9fa',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e9ecef',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  replyIndicator: {
    width: 4,
    height: 40,
    backgroundColor: '#075E54',
    borderRadius: 2,
    marginRight: 12,
  },
  replyContent: {
    flex: 1,
  },
  replyToText: {
    fontSize: 12,
    color: '#075E54',
    fontWeight: '600',
    marginBottom: 2,
  },
  replyMessageText: {
    fontSize: 14,
    color: '#6c757d',
  },
  cancelButton: {
    padding: 4,
    marginLeft: 8,
  },
});

export default ReplyPreview;