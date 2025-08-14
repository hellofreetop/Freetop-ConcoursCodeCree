import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  StatusBar, 
  Dimensions,
  SafeAreaView,
  Animated,
  PanResponder
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');
const IMAGE_SIZE = width / 3 - 2;
const APP_BAR_HEIGHT = height * 0.1; // 10% de la hauteur
const IMAGE_CONTENT_HEIGHT = height * 0.9; // 90% restant

const CollectionDetailScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { collection, onGoBack } = route.params;
  const [selectedImageIndex, setSelectedImageIndex] = useState(null);
  const [images, setImages] = useState([]);
  const pan = useRef(new Animated.ValueXY()).current;

  React.useEffect(() => {
    const imageUrls = [
      collection.image1_url,
      collection.image2_url,
      collection.image3_url,
      collection.image4_url,
      collection.image5_url,
    ].filter(url => url);
    setImages(imageUrls);
  }, [collection]);

  const handleEdit = () => {
    navigation.navigate('AddCollection', { 
      collectionToEdit: collection,
      onGoBack: onGoBack 
    });
  };

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderRelease: (e, gestureState) => {
      if (gestureState.dx > 50) {
        handleSwipe('right');
      } else if (gestureState.dx < -50) {
        handleSwipe('left');
      }
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false
      }).start();
    },
  });

  const handleSwipe = (direction) => {
    if (direction === 'left' && selectedImageIndex < images.length - 1) {
      setSelectedImageIndex(selectedImageIndex + 1);
    } else if (direction === 'right' && selectedImageIndex > 0) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const renderItem = ({ item, index }) => (
    <TouchableOpacity 
      onPress={() => setSelectedImageIndex(index)}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item }} 
        style={styles.gridImage} 
      />
      <View style={styles.imageOverlay} />
    </TouchableOpacity>
  );

  if (selectedImageIndex !== null) {
    return (
      <ImageDetailView 
        images={images}
        selectedIndex={selectedImageIndex}
        description={collection.description}
        onClose={() => setSelectedImageIndex(null)}
        onSwipeLeft={() => handleSwipe('left')}
        onSwipeRight={() => handleSwipe('right')}
        appBarHeight={APP_BAR_HEIGHT}
        imageContentHeight={IMAGE_CONTENT_HEIGHT}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* App Bar - Fixe en haut */}
      <View style={[styles.appBar, { height: APP_BAR_HEIGHT }]}>
        <TouchableOpacity 
          onPress={() => {
            onGoBack?.();
            navigation.goBack();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#2D3748" />
        </TouchableOpacity>
        
        <Text style={styles.title} numberOfLines={1}>
          {collection.description || 'Ma Collection'}
        </Text>
        
        <TouchableOpacity 
          onPress={handleEdit}
          style={styles.editButton}
        >
          <Ionicons name="create-outline" size={22} color="#075E54" />
        </TouchableOpacity>
      </View>

      {/* Content - Commence juste en dessous de l'app bar */}
      <View style={[styles.contentContainer, { top: APP_BAR_HEIGHT, height: IMAGE_CONTENT_HEIGHT }]}>
        <FlatList
          data={images}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={3}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </View>
  );
};

const ImageDetailView = ({ 
  images, 
  selectedIndex, 
  description, 
  onClose, 
  onSwipeLeft, 
  onSwipeRight,
  appBarHeight,
  imageContentHeight
}) => {
  const [currentIndex, setCurrentIndex] = useState(selectedIndex);
  const pan = useRef(new Animated.ValueXY()).current;

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: Animated.event(
      [null, { dx: pan.x }],
      { useNativeDriver: false }
    ),
    onPanResponderRelease: (e, gestureState) => {
      if (gestureState.dx > 50) {
        if (currentIndex > 0) {
          setCurrentIndex(currentIndex - 1);
          onSwipeRight?.();
        }
      } else if (gestureState.dx < -50) {
        if (currentIndex < images.length - 1) {
          setCurrentIndex(currentIndex + 1);
          onSwipeLeft?.();
        }
      }
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false
      }).start();
    },
  });

  return (
    <View style={styles.fullscreenContainer}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* App Bar - Fixe en haut */}
      <View style={[styles.detailAppBar, { height: appBarHeight }]}>
        <TouchableOpacity 
          onPress={onClose}
          style={styles.detailBackButton}
        >
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        <Text style={styles.detailTitle} numberOfLines={1}>
          {currentIndex + 1} / {images.length}
        </Text>
        
        <View style={{ width: 40 }} />
      </View>

      {/* Image Content - Commence juste en dessous de l'app bar */}
      <Animated.View 
        style={[
          styles.imageContentContainer, 
          { 
            top: appBarHeight,
            height: imageContentHeight,
            transform: [{ translateX: pan.x }]
          }
        ]}
        {...panResponder.panHandlers}
      >
        <Image 
          source={{ uri: images[currentIndex] }} 
          style={[styles.fullscreenImage, { height: '100%' }]}
          resizeMode="contain"
        />
      </Animated.View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  appBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
    zIndex: 10,
  },
  detailAppBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  backButton: {
    padding: 8,
  },
  detailBackButton: {
    padding: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#2D3748',
    maxWidth: '60%',
    textAlign: 'center',
  },
  detailTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  imageContentContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridContent: {
    paddingTop: 8,
    paddingHorizontal: 1,
  },
  columnWrapper: {
    marginBottom: 2,
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    margin: 1,
    backgroundColor: '#F8FAFC',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  fullscreenImage: {
    width: '100%',
  },
  detailFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  detailDescription: {
    fontFamily: 'Poppins-Medium',
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.9,
  },
  navArrow: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  leftArrow: {
    left: 20,
  },
  rightArrow: {
    right: 20,
  },
});

export default CollectionDetailScreen;