import React, { memo, forwardRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from 'react-native';
import { Ionicons, Entypo } from '@expo/vector-icons';

const InputArea = memo(forwardRef(({
  text,
  onTextChange,
  editingMessage,
  selectedMedia,
  showAttachmentMenu,
  onToggleAttachmentMenu,
  onSendText,
  onSendMedia,
  onCancelEdit,
  onStartRecording,
  onStopRecording
}, ref) => {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.inputContainer}
    >
      {selectedMedia ? (
        <TouchableOpacity
          style={styles.sendMediaButton}
          onPress={onSendMedia}
        >
          <Ionicons name="send" size={24} color="white" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          onPress={onToggleAttachmentMenu}
          style={styles.attachmentButton}
        >
          <Entypo name="attachment" size={20} color="#075E54" />
        </TouchableOpacity>
      )}

      <TextInput
        ref={ref}
        style={styles.textInput}
        value={text}
        onChangeText={onTextChange}
        placeholder={editingMessage ? "Modifier le message..." : "Tapez un message"}
        placeholderTextColor="#A0AEC0"
        multiline
        onSubmitEditing={onSendText}
      />

      {editingMessage ? (
        <TouchableOpacity 
          style={styles.cancelEditButton}
          onPress={onCancelEdit}
        >
          <Ionicons name="close" size={24} color="#E53E3E" />
        </TouchableOpacity>
      ) : text ? (
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={onSendText}
        >
          <Ionicons name="send" size={24} color="#075E54" />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity 
          style={styles.recordButton}
          onLongPress={onStartRecording}
          onPressOut={onStopRecording}
          delayLongPress={300}
        >
          <Ionicons name="mic" size={24} color="#075E54" />
        </TouchableOpacity>
      )}
    </KeyboardAvoidingView>
  );
}));

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: 'white',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 120,
    backgroundColor: 'white',
    marginRight: 10,
  },
  attachmentButton: {
    marginRight: 10,
  },
  sendButton: {
    padding: 8,
  },
  recordButton: {
    padding: 8,
  },
  sendMediaButton: {
    backgroundColor: '#075E54',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  cancelEditButton: {
    padding: 8,
  },
});

export default InputArea;