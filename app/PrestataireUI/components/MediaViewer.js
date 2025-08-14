import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
  ScrollView,
  Animated,TextInput,Split
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

const MediaViewer = ({ visible, images, currentIndex = 0, onClose, onUpload }) => {
  const [currentIdx, setCurrentIdx] = useState(currentIndex);
  const [captions, setCaptions] = useState(Array(images.length).fill(''));
  const [showCaptionInput, setShowCaptionInput] = useState(false);

  if (!visible) return null;

  const handleCaptionChange = (text, index) => {
    const newCaptions = [...captions];
    newCaptions[index] = text;
    setCaptions(newCaptions);
  };

  const handleNext = () => {
    if (currentIdx < images.length - 1) {
      setCurrentIdx(currentIdx + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const handleUpload = () => {
    const imagesWithCaptions = images.map((img, idx) => ({
      uri: img.uri,
      caption: captions[idx]
    }));
    onUpload(imagesWithCaptions);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="black" barStyle="light-content" />
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerText}>
            {currentIdx + 1} / {images.length}
          </Text>
          <TouchableOpacity 
            onPress={handleUpload} 
            style={styles.sendButton}
            disabled={!images.length}
          >
            <MaterialCommunityIcons name="send" size={24} color="white" />
          </TouchableOpacity>
        </View>

        <ScrollView 
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const newIndex = Math.round(e.nativeEvent.contentOffset.x / width);
            setCurrentIdx(newIndex);
          }}
          contentOffset={{ x: currentIndex * width, y: 0 }}
        >
          {images.map((image, index) => (
            <View key={index} style={styles.imageContainer}>
              <Image
                source={{ uri: image.uri }}
                style={styles.image}
                resizeMode="contain"
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity 
            onPress={() => setShowCaptionInput(!showCaptionInput)}
            style={styles.captionToggle}
          >
            <MaterialCommunityIcons 
              name={showCaptionInput ? "chevron-down" : "chevron-up"} 
              size={28} 
              color="white" 
            />
          </TouchableOpacity>

          {showCaptionInput && (
            <TextInput
              style={styles.captionInput}
              value={captions[currentIdx]}
              onChangeText={(text) => handleCaptionChange(text, currentIdx)}
              placeholder="Ajouter une légende..."
              placeholderTextColor="#A0AEC0"
              multiline
            />
          )}

          <View style={styles.navigation}>
            <TouchableOpacity 
              onPress={handlePrev}
              disabled={currentIdx === 0}
              style={[styles.navButton, currentIdx === 0 && styles.disabledButton]}
            >
              <Ionicons name="chevron-back" size={28} color={currentIdx === 0 ? "#718096" : "white"} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handleNext}
              disabled={currentIdx === images.length - 1}
              style={[styles.navButton, currentIdx === images.length - 1 && styles.disabledButton]}
            >
              <Ionicons name="chevron-forward" size={28} color={currentIdx === images.length - 1 ? "#718096" : "white"} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
    zIndex: 1000,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  headerText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Roboto-Medium',
  },
  closeButton: {
    padding: 5,
  },
  sendButton: {
    padding: 5,
  },
  imageContainer: {
    width,
    height: height - 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 15,
  },
  captionToggle: {
    alignSelf: 'center',
    marginBottom: 10,
  },
  captionInput: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    padding: 15,
    color: 'white',
    marginBottom: 15,
    fontFamily: 'Roboto-Regular',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  navButton: {
    padding: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default MediaViewer;