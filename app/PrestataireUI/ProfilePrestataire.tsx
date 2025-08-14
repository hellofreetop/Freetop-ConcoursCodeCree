import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  StatusBar, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl, 
  ActivityIndicator,
  FlatList,
  Dimensions,Modal
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import cover from '../../assets/cover.jpg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PrestataireProfile = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState({
    collections: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [totalFavorites, setTotalFavorites] = useState(0);
  const [showReviewsPage, setShowReviewsPage] = useState(false);
  const [userReviews, setUserReviews] = useState([]);
  const scrollViewRef = useRef();

  const fetchUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error('Aucun userId trouvé dans le storage');
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          collections:collections!user_id (
            id_collection,
            description,
            image1_url,
            created_at
          )
        `)
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const { data: reviewsData, error: reviewsError } = await supabase
        .from('user_reviews')
        .select('rating')
        .eq('reviewed_id', userId);

      if (reviewsError) throw reviewsError;

      const { count: favoritesCount, error: favoritesError } = await supabase
        .from('user_favorites')
        .select('*', { count: 'exact' })
        .eq('favorite_user_id', userId);

      if (favoritesError) throw favoritesError;

      const ratings = reviewsData.map(review => review.rating);
      const avgRating = ratings.length > 0 
        ? (ratings.reduce((a, b) => a + b, 0) / ratings.length) 
        : 0;

      setUserData({
        ...profileData,
        collections: profileData.collections || []
      });
      setAverageRating(avgRating);
      setTotalReviews(ratings.length);
      setTotalFavorites(favoritesCount || 0);
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du profil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserReviews = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:profiles!user_reviews_reviewer_id_fkey (id, full_name, photo_url)
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleMenuProfile = () => {
    navigation.navigate('ProfileMenu', { userData: userData });
  };

  const handleDeleteCollection = async () => {
    try {
      const { error } = await supabase
        .from('collections')
        .delete()
        .eq('id_collection', selectedCollection.id_collection);
      
      if (error) throw error;
      
      setUserData(prev => ({
        ...prev,
        collections: prev.collections.filter(col => col.id_collection !== selectedCollection.id_collection)
      }));
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Erreur suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer cette collection');
    }
  };

  const handleEditCollection = (collection) => {
    navigation.navigate('EditCollection', { 
      collection,
      onSave: (updatedCol) => {
        setUserData(prev => ({
          ...prev,
          collections: prev.collections.map(col => 
            col.id_collection === updatedCol.id_collection ? updatedCol : col
          )
        }));
      }
    });
  };

  const openDeleteConfirmation = (collection) => {
    setSelectedCollection(collection);
    setShowDeleteModal(true);
  };

  const handleViewReviews = async () => {
    await fetchUserReviews();
    setShowReviewsPage(true);
  };

  const renderRatingStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <View style={styles.starsWrapper}>
        {[...Array(fullStars)].map((_, i) => (
          <MaterialIcons key={`full-${i}`} name="star" size={16} color="#F6AD55" />
        ))}
        {hasHalfStar && (
          <MaterialIcons key="half" name="star-half" size={16} color="#F6AD55" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <MaterialIcons key={`empty-${i}`} name="star-border" size={16} color="#F6AD55" />
        ))}
      </View>
    );
  };

  const renderProfileRating = () => {
    return (
      <View style={styles.ratingContainer}>
        <TouchableOpacity 
          style={styles.ratingItem}
          onPress={handleViewReviews}
        >
          {renderRatingStars(averageRating)}
          <Text style={styles.ratingText}>{totalReviews} avis</Text>
        </TouchableOpacity>
        <View style={styles.ratingItem}>
          <Ionicons name="heart" size={16} color="#E53E3E" />
          <Text style={styles.ratingText}>{totalFavorites} favoris</Text>
        </View>
      </View>
    );
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        {item.reviewer.photo_url ? (
          <Image source={{ uri: item.reviewer.photo_url }} style={styles.reviewerAvatar} />
        ) : (
          <View style={[styles.reviewerAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="white" />
          </View>
        )}
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.reviewer.full_name}</Text>
          {renderRatingStars(item.rating)}
        </View>
        <Text style={styles.reviewDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
      {item.comment && (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      )}
    </View>
  );

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity
      style={styles.mediaItem}
      onPress={() => navigation.navigate('UserCollectionDetail', {
        collectionId: item.id_collection
      })}
    >
      <Image
        source={{ uri: item.image1_url }}
        style={styles.mediaImage}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  const ReviewsPage = () => (
    <View style={styles.reviewsPageContainer}>
      <View style={styles.reviewsPageHeader}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => setShowReviewsPage(false)}
        >
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        <Text style={styles.reviewsPageTitle}>Avis Reçus</Text>
        <View style={{ width: 24 }} />
      </View>

      {userReviews.length > 0 ? (
        <FlatList
          data={userReviews}
          renderItem={renderReviewItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.reviewsList}
        />
      ) : (
        <View style={styles.noReviewsContainer}>
          <Ionicons name="star-outline" size={60} color="#E2E8F0" />
          <Text style={styles.noReviewsText}>Aucun avis pour le moment</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  if (showReviewsPage) {
    return <ReviewsPage />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <Text style={styles.headerName} numberOfLines={1}>
          {userData?.full_name || 'Profil'}
        </Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleViewReviews}
          >
            <Ionicons name="star-outline" size={20} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleMenuProfile}
          >
            <Ionicons name="menu" size={20} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('SettingsClient')}
          >
            <Ionicons name="settings-outline" size={20} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#075E54']}
            progressViewOffset={100}
          />
        }
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        <View style={styles.coverContainer}>
          <Image 
            source={cover} 
            style={styles.coverImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.65)']}
            style={styles.coverGradient}
          />
          
          <View style={styles.profileImageContainer}>
            {userData?.photo_url ? (
              <Image 
                source={{ uri: userData.photo_url }} 
                style={styles.profileImage} 
              />
            ) : (
               <Image
                 source={require('../../assets/default-avatar.png')}
                 style={[styles.profileImage]}
               />
            )}
          </View>

          <View style={styles.ratingOverlay}>
            {renderProfileRating()}
          </View>
        </View>
        
        <View style={styles.profileInfoContainer}>
          <Text style={styles.fullName}>{userData?.full_name || 'Nom Complet'}</Text>
          <Text style={styles.description}>{userData?.description || 'Ajouter une description'}</Text>
        </View>
        
        <View style={styles.tabsContainer}>
          <View style={styles.tabsInnerContainer}>
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'about' && styles.activeTab,
                activeTab === 'about' && styles.activeTabLeft
              ]}
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>À propos</Text>
              {activeTab === 'about' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'collections' && styles.activeTab,
                activeTab === 'collections' && styles.activeTabRight
              ]}
              onPress={() => setActiveTab('collections')}
            >
              <Text style={[styles.tabText, activeTab === 'collections' && styles.activeTabText]}>Collections</Text>
              {activeTab === 'collections' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.tabContent}>
          {activeTab === 'about' ? (
            <AboutTab userData={userData} />
          ) : (
            <CollectionsTab 
              collections={userData.collections || []}
              renderMediaItem={renderMediaItem}
            />
          )}
        </View>
      </ScrollView>

      <Modal
        transparent={true}
        animationType="fade"
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.modalText}>
              Êtes-vous sûr de vouloir supprimer cette collection ?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteCollection}
              >
                <Ionicons name="trash-outline" size={18} color="#FFF" />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const AboutTab = ({ userData }) => {
  return (
    <View style={styles.aboutContainer}>
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Ionicons name="information-circle" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.profession || 'Non renseignée'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="home" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.address || 'Non renseignée'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="call" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.phone || 'Non renseigné'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="mail" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.email || 'Non renseigné'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const CollectionsTab = ({ collections, renderMediaItem }) => {
  if (collections.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="images-outline" size={50} color="#CCD0D5" />
        <Text style={styles.emptyStateText}>Aucune collection créée</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={collections}
      renderItem={renderMediaItem}
      keyExtractor={(item) => item.id_collection}
      numColumns={3}
      scrollEnabled={false}
      contentContainerStyle={styles.mediaGrid}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 10,
    backgroundColor: '#ffffff',
    position: 'relative',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 5,
  },
  headerName: {
    flex: 1,
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
    marginHorizontal: 10,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  coverContainer: {
    height: 100,
    width: '100%',
    position: 'relative',
    marginBottom: 80,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  profileImageContainer: {
    position: 'absolute',
    bottom: -40,
    left: 20,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 15,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  profileImagePlaceholder: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingOverlay: {
    position: 'absolute',
    bottom: -37,
    right: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
  },
  ratingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  starsWrapper: {
    flexDirection: 'row',
  },
  ratingText: {
    fontSize: 14,
    color: '#4A5568',
    fontFamily: 'Poppins-SemiBold',
  },
  profileInfoContainer: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: -30,
  },
  fullName: {
    fontSize: 22,
    color: '#1A202C',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    color: '#0000008b',
    marginBottom: 5,
    fontFamily: 'Poppins-Regular',
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsInnerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 5,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#ffffff',
  },
  activeTabLeft: {
    borderTopLeftRadius: 8,
  },
  activeTabRight: {
    borderTopRightRadius: 8,
  },
  tabText: {
    fontSize: 16,
    color: '#718096',
    fontFamily: 'Poppins-Medium',
  },
  activeTabText: {
    color: '#075E54',
    fontFamily: 'Poppins-SemiBold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '100%',
    backgroundColor: '#075E54',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabContent: {
    flex: 1,
    paddingBottom: 30,
  },
  aboutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  infoSection: {
    marginTop: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 15,
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
    fontFamily: 'Poppins-Medium',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#2D3748',
    fontFamily: 'Poppins-Regular',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 40,
  },
  emptyStateText: {
    textAlign: 'center',
    color: '#2D3748',
    fontFamily: 'Poppins-Medium',
    marginTop: 15,
    fontSize: 16,
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  mediaItem: {
    width: (SCREEN_WIDTH - 60) / 3,
    height: (SCREEN_WIDTH - 60) / 3,
    marginBottom: 10,
    backgroundColor: '#EBEDF0',
    borderRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1A202C',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  deleteButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  reviewsPageContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  reviewsPageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    paddingTop: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  reviewsPageTitle: {
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
  },
  reviewsList: {
    padding: 20,
  },
  reviewItem: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 35,
    height: 35,
    borderRadius: 24,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#CBD5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    color: '#1A202C',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: '#A0AEC0',
    fontFamily: 'Poppins-Regular',
  },
  reviewComment: {
    fontSize: 15,
    color: '#4A5568',
    fontFamily: 'Poppins-Regular',
    lineHeight: 22,
    marginTop: 8,
    marginLeft: 60,
  },
  noReviewsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noReviewsText: {
    fontSize: 18,
    color: '#718096',
    fontFamily: 'Poppins-Medium',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default PrestataireProfile;