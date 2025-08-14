import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Clipboard
} from 'react-native';
import { Feather } from '@expo/vector-icons';

const MessageActionsModal = memo(({
  visible,
  selectedMessage,
  senderId,
  onClose,
  onReply,
  onEdit,
  onDelete
}) => {
  if (!selectedMessage) return null;

  const isMe = selectedMessage.sender_id === senderId;

  const handleCopy = () => {
    if (selectedMessage.type === 'text') {
      Clipboard.setString(selectedMessage.content);
      Alert.alert("Copié", "Le message a été copié dans le presse-papiers");
      onClose();
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Supprimer le message",
      "Êtes-vous sûr de vouloir supprimer ce message ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: () => {
            onDelete(selectedMessage.id);
            onClose();
          }
        }
      ]
    );
  };

  return (
    <Modal
      transparent
      visible={visible}
      onRequestClose={onClose}
      animationType="slide"
    >
      <TouchableOpacity 
        style={styles.overlay}
        onPress={onClose}
        activeOpacity={1}
      >
        <View style={styles.container}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              onReply(selectedMessage);
              onClose();
            }}
          >
            <Feather name="corner-up-left" size={24} color="#075E54" />
            <Text style={styles.actionText}>Répondre</Text>
          </TouchableOpacity>
          
          {isMe && selectedMessage.type === 'text' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => {
                onEdit(selectedMessage);
                onClose();
              }}
            >
              <Feather name="edit" size={24} color="#075E54" />
              <Text style={styles.actionText}>Modifier</Text>
            </TouchableOpacity>
          )}
          
          {isMe && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={24} color="#E53E3E" />
              <Text style={[styles.actionText, { color: '#E53E3E' }]}>Supprimer</Text>
            </TouchableOpacity>
          )}

          {selectedMessage.type === 'text' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={handleCopy}
            >
              <Feather name="copy" size={24} color="#075E54" />
              <Text style={styles.actionText}>Copier</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 15,
    borderTopLeftRadius: 15,
    borderTopRightRadius: 15,
    paddingBottom: 30, // Safe area padding
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  actionText: {
    fontSize: 12,
    color: '#075E54',
    marginTop: 5,
    textAlign: 'center',
  },
});

export default MessageActionsModal;