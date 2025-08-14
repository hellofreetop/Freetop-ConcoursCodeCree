import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  ScrollView, 
  TouchableOpacity, 
  Dimensions, 
  ActivityIndicator,
  Modal,
  TextInput,
  StatusBar,
  Alert,
  PanResponder,
  Linking,
  Platform
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Font from 'expo-font';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc,
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

const { height, width } = Dimensions.get('window');

async function loadFonts() {
  await Font.loadAsync({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
}

const ViewProductScreen = ({ route, navigation }) => {
  const { productId } = route.params;
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewCounted, setViewCounted] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [userRating, setUserRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [userId, setUserId] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
    checkUser();
    fetchProduct();
  }, []);

  const checkUser = async () => {
    const id = await AsyncStorage.getItem('userId');
    setUserId(id);
  };

  const panResponder = React.useMemo(() => 
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dx > 50) {
          handlePrevImage();
        } else if (gestureState.dx < -50) {
          handleNextImage();
        }
      },
    }), [product]
  );

  const fetchProduct = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images(url, is_primary),
          product_reviews(rating, comment, created_at, profiles(full_name)),
          profiles(full_name, photo_url, phone, address)
        `)
        .eq('id', productId)
        .single();

      if (error) throw error;

      setProduct({
        ...data,
        avgRating: calculateAverageRating(data.product_reviews),
        reviewCount: data.product_reviews.length,
        images: data.product_images
      });

      if (!viewCounted) {
        await supabase
          .from('products')
          .update({ views: data.views + 1 })
          .eq('id', productId);
        setViewCounted(true);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageRating = (reviews) => {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const handleNextImage = () => {
    setCurrentImageIndex(prev => 
      prev === product.images.length - 1 ? 0 : prev + 1
    );
  };

  const handlePrevImage = () => {
    setCurrentImageIndex(prev => 
      prev === 0 ? product.images.length - 1 : prev - 1
    );
  };

  const handleCall = () => {
    if (!product.profiles.phone) return;
    
    const phoneNumber = `tel:${product.profiles.phone}`;
    Linking.openURL(phoneNumber).catch(err => {
      console.error('Error opening phone app:', err);
      Alert.alert('Erreur', "Impossible d'ouvrir l'application téléphone");
    });
  };

  const handleMessage = async () => {
    if (!userId) {
      Alert.alert('Connexion requise', 'Vous devez être connecté pour envoyer un message');
      return;
    }

    if (userId === product.creator_id) {
      Alert.alert('Action impossible', 'Vous ne pouvez pas vous envoyer un message à vous-même');
      return;
    }

    try {
      // Vérifier si une discussion existe déjà
      const discussionsRef = collection(db, 'discussionsMarketplace');
      const q = query(
        discussionsRef,
        where('productId', '==', productId),
        where('participants', 'array-contains', userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Discussion existante - naviguer vers le chat
        const discussion = querySnapshot.docs[0].data();
        navigation.navigate('ChatMarketplace', { 
          discussionId: querySnapshot.docs[0].id,
          product: {
            id: productId,
            title: product.title,
            image: product.images[0]?.url,
            price: product.price,
            creator: {
              id: product.creator_id,
              name: product.profiles.full_name,
              address: product.profiles.address
            }
          }
        });
      } else {
        // Créer une nouvelle discussion
        const newDiscussionRef = doc(collection(db, 'discussionsMarketplace'));
        
        await setDoc(newDiscussionRef, {
          id: newDiscussionRef.id,
          productId,
          productTitle: product.title,
          productImage: product.images[0]?.url,
          creatorId: product.creator_id,
          creatorName: product.profiles.full_name,
          creatorPhoto: product.profiles.photo_url,
          participants: [userId, product.creator_id],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          unreadCount: 0,
          createdAt: serverTimestamp()
        });

        navigation.navigate('ChatMarketplace', { 
          discussionId: newDiscussionRef.id,
          product: {
            id: productId,
            title: product.title,
            image: product.images[0]?.url,
            price: product.price,
            creator: {
              id: product.creator_id,
              name: product.profiles.full_name,
              address: product.profiles.address
            }
          }
        });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      Alert.alert('Erreur', "Une erreur s'est produite lors de la création de la discussion");
    }
  };

  const submitReview = async () => {
    try {
      if (!userId) {
        Alert.alert('Connexion requise', 'Vous devez être connecté pour noter un produit');
        return;
      }

      const { error } = await supabase
        .from('product_reviews')
        .insert({
          product_id: productId,
          user_id: userId,
          rating: userRating,
          comment: reviewComment
        });

      if (error) throw error;

      Alert.alert('Merci!', 'Votre avis a été enregistré');
      setRatingModalVisible(false);
      fetchProduct();
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Erreur', "Une erreur s'est produite lors de l'envoi de votre avis");
    }
  };

  if (!fontsLoaded || loading || !product) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        translucent={true} 
        backgroundColor="#075E54"
      />
      
      {/* AppBar Transparente */}
      <View style={[styles.appBar, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.ratingAppBarButton}
          onPress={() => setRatingModalVisible(true)}
        >
          <Feather name="star" size={24} color="#FFD700" />
        </TouchableOpacity>
      </View>

      {/* Images Section */}
      <View 
        style={[styles.imagesContainer, { height: height * 0.35 }]}
        {...panResponder.panHandlers}
      >
        <Image 
          source={{ uri: product.images[currentImageIndex]?.url }} 
          style={styles.primaryImage}
          resizeMode="cover"
        />

        {product.images.length > 1 && (
          <View style={styles.imageIndicators}>
            {product.images.map((_, index) => (
              <View 
                key={index}
                style={[
                  styles.imageIndicator,
                  index === currentImageIndex && styles.activeImageIndicator
                ]}
              />
            ))}
          </View>
        )}
      </View>

      {/* Details Section */}
      <View style={[styles.detailsContainer, { height: height * 0.65 }]}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Price Row */}
          <View style={styles.priceRow}>
            <Text style={[styles.price, { fontFamily: 'Poppins-Bold' }]}>
              {product.price.toFixed(2)} Fcfa
            </Text>
            {product.discount > 0 && (
              <Text style={[styles.originalPrice, { fontFamily: 'Poppins-Medium' }]}>
                {(product.price + product.discount).toFixed(2)} Fcfa
              </Text>
            )}
            <Text style={[styles.views, { fontFamily: 'Poppins-Regular' }]}>
              {product.views} vues
            </Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { fontFamily: 'Poppins-Bold' }]}>
            {product.title}
          </Text>

          {/* Rating */}
          <View style={styles.ratingRow}>
            <View style={styles.starsContainer}>
              {[...Array(5)].map((_, i) => (
                <Ionicons 
                  key={i} 
                  name="star" 
                  size={20} 
                  color={i < Math.floor(product.avgRating) ? '#FFD700' : '#ddd'} 
                />
              ))}
            </View>
            <Text style={[styles.ratingText, { fontFamily: 'Poppins-Medium' }]}>
              {product.avgRating.toFixed(1)} ({product.reviewCount} avis)
            </Text>
          </View>

          {/* Description */}
          <Text style={[styles.description, { fontFamily: 'Poppins-Regular' }]}>
            {product.description}
          </Text>

          {/* Creator Info */}
          <View style={styles.creatorRow}>
            <View style={styles.creatorInfo}>
              <Image 
                source={{ uri: product.profiles.photo_url || require('../../assets/default-avatar.png') }} 
                style={styles.creatorAvatar} 
              />
              <Text style={[styles.creatorName, { fontFamily: 'Poppins-SemiBold' }]}>
                {product.profiles.full_name}
              </Text>
            </View>
            <View style={styles.creatorDetails}>
              <Text style={[styles.creatorAddress, { fontFamily: 'Poppins-Regular' }]}>
                {product.profiles.address}
              </Text>
              <Text style={[styles.creatorDate, { fontFamily: 'Poppins-Regular' }]}>
                {formatDate(product.created_at)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.actionsRow, { 
          bottom: insets.bottom + 20,
          paddingHorizontal: 20 
        }]}>
          <TouchableOpacity 
            style={styles.messageButton}
            onPress={handleMessage}
          >
            <Feather name="message-square" size={20} color="#fff" />
            <Text style={[styles.messageButtonText, { fontFamily: 'Poppins-Bold' }]}>
              Message
            </Text>
          </TouchableOpacity>
          
          {product.profiles.phone && (
            <TouchableOpacity 
              style={styles.callButton}
              onPress={handleCall}
            >
              <Feather name="phone" size={20} color="#075E54" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Rating Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={ratingModalVisible}
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { 
            paddingBottom: insets.bottom,
            maxHeight: height * 0.6 
          }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { fontFamily: 'Poppins-Bold' }]}>
                Noter ce produit
              </Text>
              <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                <Feather name="x" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.ratingStarsContainer}>
              {[...Array(5)].map((_, i) => (
                <TouchableOpacity 
                  key={i} 
                  onPress={() => setUserRating(i + 1)}
                >
                  <Ionicons 
                    name="star" 
                    size={32} 
                    color={i < userRating ? '#FFD700' : '#ddd'} 
                    style={styles.modalStar}
                  />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.reviewInput, { fontFamily: 'Poppins-Regular' }]}
              placeholder="Décrivez votre expérience avec ce produit..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={4}
              value={reviewComment}
              onChangeText={setReviewComment}
            />

            <TouchableOpacity 
              style={[
                styles.submitButton,
                userRating === 0 && styles.submitButtonDisabled
              ]}
              onPress={submitReview}
              disabled={userRating === 0}
            >
              <Text style={[styles.submitButtonText, { fontFamily: 'Poppins-Bold' }]}>
                Envoyer l'avis
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBar: {
    position: 'absolute',
    top: -40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingAppBarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ratingAppBarText: {
    color: '#fff',
    marginLeft: 5,
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  imagesContainer: {
    width: '100%',
    position: 'relative',
  },
  primaryImage: {
    width: '100%',
    height: '100%',
  },
  imageIndicators: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 4,
  },
  activeImageIndicator: {
    backgroundColor: '#000',
    width: 12,
  },
  detailsContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: 0,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  price: {
    fontSize: 24,
    color: '#075E54',
    marginRight: 10,
  },
  originalPrice: {
    fontSize: 18,
    color: '#999',
    textDecorationLine: 'line-through',
    marginRight: 'auto',
  },
  views: {
    fontSize: 14,
    color: '#666',
  },
  title: {
    fontSize: 20,
    marginBottom: 15,
    color: '#333',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: 10,
  },
  ratingText: {
    fontSize: 16,
    color: '#666',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 25,
  },
  creatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  creatorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
  },
  creatorName: {
    fontSize: 16,
    color: '#333',
  },
  creatorDetails: {
    alignItems: 'flex-end',
  },
  creatorAddress: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  creatorDate: {
    fontSize: 12,
    color: '#999',
  },
  actionsRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  messageButton: {
    flexDirection: 'row',
    backgroundColor: '#075E54',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    marginRight: 10,
    marginBottom: 50,
  },
  messageButtonText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    fontFamily: 'Poppins-Bold',
  },
  callButton: {
    width: 60,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#075E54',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
  },
  ratingStarsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalStar: {
    marginHorizontal: 5,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 15,
    minHeight: 100,
    marginBottom: 20,
    textAlignVertical: 'top',
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#075E54',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginBottom: 20,

  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
  },
});

export default ViewProductScreen;