import React, { memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const AttachmentMenu = memo(({
  visible,
  onPickImage,
  onTakePhoto,
  onClose
}) => {
  if (!visible) return null;

  return (
    <View style={styles.attachmentMenu}>
      <TouchableOpacity 
        style={styles.attachmentOption}
        onPress={() => {
          onPickImage();
          onClose();
        }}
      >
        <Ionicons name="image" size={24} color="#075E54" />
        <Text style={styles.attachmentOptionText}>Galerie</Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.attachmentOption}
        onPress={() => {
          onTakePhoto();
          onClose();
        }}
      >
        <Ionicons name="camera" size={24} color="#075E54" />
        <Text style={styles.attachmentOptionText}>Appareil photo</Text>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  attachmentMenu: {
    position: 'absolute',
    bottom: 60,
    left: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  attachmentOption: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  attachmentOptionText: {
    fontSize: 12,
    color: '#075E54',
    marginTop: 5,
  },
});

export default AttachmentMenu;