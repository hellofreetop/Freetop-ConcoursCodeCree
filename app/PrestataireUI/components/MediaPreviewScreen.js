import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  FlatList, 
  TouchableOpacity, 
  TextInput,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const MediaPreviewScreen = ({ visible, images, onCancel, onConfirm }) => {
  const [captions, setCaptions] = useState({});

  if (!visible) return null;

  const handleCaptionChange = (index, text) => {
    setCaptions(prev => ({
      ...prev,
      [index]: text
    }));
  };

  const handleSubmit = () => {
    const imagesWithCaptions = images.map((image, index) => ({
      uri: image.uri,
      caption: captions[index] || ''
    }));
    onConfirm(imagesWithCaptions);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel}>
          <Ionicons name="arrow-back" size={30} color="#075E54" />
        </TouchableOpacity>
        <Text style={styles.headerText}></Text>
        <TouchableOpacity onPress={handleSubmit}>
          <Ionicons name="send" size={30} color="#075E54" />
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item, index }) => (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: item.uri }}
              style={styles.image}
              resizeMode="contain"
            />
            <TextInput
              style={styles.captionInput}
              placeholder="Ajouter une légende..."
              placeholderTextColor="#A0AEC0"
              value={captions[index] || ''}
              onChangeText={(text) => handleCaptionChange(index, text)}
              multiline
            />
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 50,
  },
  headerText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageContainer: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 100,
  },
  image: {
    width: '100%',
    height: '70%',
  },
  captionInput: {
    width: '90%',
    backgroundColor: 'rgba(16, 16, 16, 0.1)',
    color: 'white',
    borderRadius: 10,
    padding: 15,
    marginTop: 20,
  },
});

export default MediaPreviewScreen;