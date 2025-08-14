import React, { useState, useEffect } from 'react';
import { View,
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  ScrollView, 
  StatusBar, 
  ActivityIndicator,
  FlatList,
  Dimensions,
  Animated,
  PanResponder
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewProductScreen from '../Marketplace/ViewProductScreen';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH / 2 - 25;

const UserCollectionDetail = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { collectionId } = route.params;
  
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState([]);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [permissionResponse, requestPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    fetchCollection();
  }, [collectionId]);

  const fetchCollection = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('id_collection', collectionId)
        .single();

      if (error) throw error;
      
      setCollection(data);
      
      const imageUrls = [
        data.image1_url,
        data.image2_url,
        data.image3_url,
        data.image4_url,
        data.image5_url,
      ].filter(url => url);

      setImages(imageUrls);
    } catch (error) {
      console.error('Error fetching collection:', error);
      Alert.alert('Erreur', 'Impossible de charger la collection');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      if (Platform.OS === 'android' && !permissionResponse?.granted) {
        await requestPermission();
      }

      const currentImage = images[currentImageIndex];
      const fileUri = FileSystem.documentDirectory + `freetop_${Date.now()}.jpg`;
      const { uri } = await FileSystem.downloadAsync(currentImage, fileUri);

      if (Platform.OS === 'ios') {
        Sharing.shareAsync(uri);
      } else {
        const asset = await MediaLibrary.createAssetAsync(uri);
        await MediaLibrary.createAlbumAsync('Freetop', asset, false);
        Alert.alert('Succès', 'Image sauvegardée dans votre galerie!');
      }
    } catch (error) {
      console.error('Error downloading image:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'image');
    }
  };

  const handleShare = async () => {
    try {
      const currentImage = images[currentImageIndex];
      const result = await Share.share({
        url: currentImage,
        message: 'Découvrez cette réalisation sur Freetop!',
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          console.log('Shared with activity type:', result.activityType);
        } else {
          console.log('Shared successfully');
        }
      } else if (result.action === Share.dismissedAction) {
        console.log('Share dismissed');
      }
    } catch (error) {
      console.error('Error sharing image:', error);
      Alert.alert('Erreur', 'Impossible de partager l\'image');
    }
  };

  const openImageViewer = (index) => {
    setCurrentImageIndex(index);
    setShowImageViewer(true);
  };

  const renderImageItem = ({ item, index }) => (
    <TouchableOpacity 
      onPress={() => openImageViewer(index)}
      style={[
        styles.gridItem,
        index % 2 === 0 ? { marginRight: 8 } : { marginLeft: 8 }
      ]}
    >
      <Image source={{ uri: item }} style={styles.gridImage} />
      <View
        colors={['transparent', 'rgba(0,0,0,0.3)']}
        style={styles.imageOverlay}
      />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  if (showImageViewer) {
    return (
      <ImageViewer 
        images={images}
        initialIndex={currentImageIndex}
        onClose={() => setShowImageViewer(false)}
        onDownload={handleDownload}
        onShare={handleShare}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Premium AppBar */}
      <View
        style={styles.appBar}
      >
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        
        <Text style={styles.title} numberOfLines={1}>
          {collection.description || 'Galerie Freetop'}
        </Text>
        
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        
        {/* Image Grid */}
        <FlatList
          data={images}
          renderItem={renderImageItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          scrollEnabled={false}
          contentContainerStyle={styles.gridContainer}
        />
      </ScrollView>
    </View>
  );
};

const ImageViewer = ({ images, initialIndex, onClose, onDownload, onShare }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const pan = useState(new Animated.ValueXY())[0];
  const [opacity] = useState(new Animated.Value(1));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (e, gestureState) => {
      if (gestureState.dx > 100 && currentIndex > 0) {
        // Swipe right - go to previous image
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex(currentIndex - 1);
          pan.setValue({ x: 0, y: 0 });
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
      } else if (gestureState.dx < -100 && currentIndex < images.length - 1) {
        // Swipe left - go to next image
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          setCurrentIndex(currentIndex + 1);
          pan.setValue({ x: 0, y: 0 });
          Animated.timing(opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start();
        });
      } else {
        // Reset position
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          friction: 5,
          useNativeDriver: false,
        }).start();
      }
    },
  });

  return (
    <View style={styles.imageViewerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="black" />
      
      {/* AppBar for Image Viewer */}
      <View
        colors={['rgba(0,0,0,0.8)', 'transparent']}
        style={styles.viewerAppBar}
      >
        <TouchableOpacity 
          onPress={onClose}
          style={styles.viewerBackButton}
        >
          <Ionicons name="close" size={28} color="white" />
        </TouchableOpacity>
        
        <Text style={styles.viewerTitle}>
          {currentIndex + 1} / {images.length}
        </Text>
        
        <View style={styles.viewerActions}>
          <TouchableOpacity 
            onPress={onDownload}
            style={styles.viewerActionButton}
          >
            <Feather name="download" size={24} color="white" />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onShare}
            style={styles.viewerActionButton}
          >
            <Feather name="share-2" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Content with Swipe Gestures */}
      <Animated.View
        style={[
          styles.imageContent,
          { opacity: opacity },
          { transform: [{ translateX: pan.x }] }
        ]}
        {...panResponder.panHandlers}
      >
        <Image 
          source={{ uri: images[currentIndex] }} 
          style={styles.fullScreenImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Dots Indicator */}
      <View style={styles.dotsContainer}>
        {images.map((_, index) => (
          <View 
            key={index}
            style={[
              styles.dot,
              index === currentIndex ? styles.activeDot : null
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: 'black',
    maxWidth: '60%',
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  descriptionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  description: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    fontFamily: 'Trebuchet MS',
  },
  gridContainer: {
    paddingTop: 8,
  },
  gridItem: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    height: '30%',
  },
  // Image Viewer Styles
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  viewerAppBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 1,
  },
  viewerBackButton: {
    padding: 8,
  },
  viewerTitle: {
    color: 'white',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  viewerActions: {
    flexDirection: 'row',
  },
  viewerActionButton: {
    padding: 8,
    marginLeft: 16,
  },
  imageContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT - 180,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 4,
  },
  activeDot: {
    backgroundColor: 'white',
    width: 12,
  },
});

export default UserCollectionDetail;