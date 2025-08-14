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
  Linking,
  Dimensions,
  Alert,
  Animated
} from 'react-native';
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
import { Ionicons, Feather, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PROFILE_SIZE = 100;
const COVER_HEIGHT = 200;

const ProfileView = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [collections, setCollections] = useState([]);
  const [collectionsLoading, setCollectionsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('informations');
  const [ratingStats, setRatingStats] = useState({ average: 0, count: 0 });
  const scrollY = useRef(new Animated.Value(0)).current;

  const fetchUserData = async () => {
    try {
      setRefreshing(true);
      const currentUserId = await AsyncStorage.getItem('userId');
      
      // 1. Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        throw new Error('Le profil demandé n\'existe pas');
      }

      // 2. Check if favorite
      if (currentUserId) {
        const { data: favorites, error: favError } = await supabase
          .from('user_favorites')
          .select('*')
          .eq('user_id', currentUserId)
          .eq('favorite_user_id', userId);

        setIsFavorite(favorites && favorites.length > 0);
      }

      // 3. Fetch rating stats
      const { data: ratings, error: ratingError } = await supabase
        .from('user_reviews')
        .select('rating')
        .eq('reviewed_id', userId);

      if (!ratingError) {
        const average = ratings.length > 0 
          ? ratings.reduce((sum, review) => sum + review.rating, 0) / ratings.length
          : 0;
        setRatingStats({
          average: Math.round(average * 10) / 10,
          count: ratings.length
        });
      }

      setUserData(profileData);
      fetchUserCollections(profileData.id);

    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      Alert.alert('Erreur', 'Impossible de charger ce profil');
      navigation.goBack();
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUserCollections = async (userId) => {
    try {
      setCollectionsLoading(true);
      const { data, error } = await supabase
        .from('collections')
        .select('id_collection, description, image1_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(9);

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Erreur lors du chargement des collections:', error);
    } finally {
      setCollectionsLoading(false);
    }
  };

  const toggleFavorite = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      if (isFavorite) {
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', currentUserId)
          .eq('favorite_user_id', userId);

        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: currentUserId,
            favorite_user_id: userId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        setIsFavorite(true);
      }
    } catch (error) {
      console.error('Erreur favori:', error);
      Alert.alert('Erreur', error.message || 'Action impossible');
    }
  };

  const handleMessage = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      const participants = [currentUserId, userId].sort();

      const discussionsRef = collection(db, 'discussions');
      const discussionQuery = query(
        discussionsRef,
        where('participants', '==', participants)
      );

      const querySnapshot = await getDocs(discussionQuery);
      let discussionId;

      if (!querySnapshot.empty) {
        discussionId = querySnapshot.docs[0].id;
      } else {
        const userName = await AsyncStorage.getItem('userName');
        const userAvatar = await AsyncStorage.getItem('userAvatar');

        const discussionRef = doc(collection(db, 'discussions'));
        discussionId = discussionRef.id;

        await setDoc(discussionRef, {
          participants,
          created_at: serverTimestamp(),
          last_message: null,
          participants_info: {
            [currentUserId]: {
              name: userName || 'Utilisateur',
              avatar: userAvatar,
            },
            [userId]: {
              name: userData.full_name,
              avatar: userData.photo_url,
            }
          },
          unread: {
            [currentUserId]: 0,
            [userId]: 0
          },
        });
      }

      navigation.navigate('Chat', {
        discussionId,
        otherUser: {
          id: userId,
          name: userData.full_name,
          avatar: userData.photo_url,
          online: false
        }
      });

    } catch (error) {
      console.error('Erreur création discussion:', error);
      Alert.alert('Erreur', 'Impossible de démarrer la conversation');
    }
  };

  const handleCall = () => {
    if (userData?.phone) {
      Linking.openURL(`tel:${userData.phone}`);
    } else {
      Alert.alert('Information', 'Numéro de téléphone non disponible');
    }
  };

  useEffect(() => {
    fetchUserData();
  }, [userId]);

  const onRefresh = () => {
    fetchUserData();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { year: 'numeric', month: 'long' };
    return `Depuis ${date.toLocaleDateString('fr-FR', options)}`;
  };

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header fixe */}
      <View style={styles.fixedHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {userData?.full_name}
        </Text>
      </View>

      <ScrollView
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } }}],
          { useNativeDriver: false }
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#075E54']}
          />
        }
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {/* Cover photo */}
        <View style={styles.coverContainer}>
          <Image 
            source={require('../../assets/cover.jpg')} 
            style={styles.coverImage}
            resizeMode="cover"
          />
          <View style={styles.overlay} />
          
          {/* Photo de profil */}
          <View style={styles.profileImageContainer}>
            <Image 
              source={userData?.photo_url ? { uri: userData.photo_url } : require('../../assets/default-avatar.png')} 
              style={styles.profileImage}
            />
          </View>
        </View>

        {/* Profile section */}
        <View style={styles.profileSection}>
          <View style={styles.profileContent}>
            <Text style={styles.fullName}>{userData?.full_name}</Text>
            <Text style={styles.description}>
              {userData?.description}
            </Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[styles.actionButton, styles.messageButton]}
                onPress={handleMessage}
              >
                <Feather name="message-square" size={18} color="white" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.callButton]}
                onPress={toggleFavorite}
              >
                <Feather
                  name={isFavorite ? "check-square" : "plus-square"}
                  size={20}
                  color={"#ffffff"}
                />

              </TouchableOpacity>

              {userData?.phone && (
                <TouchableOpacity
                  style={[styles.actionButton, styles.callButton]}
                  onPress={handleCall}
                >
                  <Feather name="phone" size={18} color="white" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'informations' && styles.activeTab]}
            onPress={() => setActiveTab('informations')}
          >
            <Text style={[styles.tabText, activeTab === 'informations' && styles.activeTabText]}>
              Informations
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'collections' && styles.activeTab]}
            onPress={() => setActiveTab('collections')}
          >
            <Text style={[styles.tabText, activeTab === 'collections' && styles.activeTabText]}>
              Collections
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab content */}
        <View style={styles.tabContent}>
          {activeTab === 'informations' ? (
            <>
              <View style={styles.section}>
                <View style={styles.detailItem}>
                  <Ionicons name="briefcase" size={20} color="#65676B" style={styles.detailIcon} />
                  <View>
                    <Text style={styles.detailValue}>{userData?.profession || 'Non renseignée'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="location" size={20} color="#65676B" style={styles.detailIcon} />
                  <View>
                    <Text style={styles.detailValue}>{userData?.address || 'Non renseignée'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="call" size={20} color="#65676B" style={styles.detailIcon} />
                  <View>
                    <Text style={styles.detailValue}>{userData?.phone || 'Non renseigné'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="mail" size={20} color="#65676B" style={styles.detailIcon} />
                  <View>
                    <Text style={styles.detailValue}>{userData?.email || 'Non renseigné'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={20} color="#65676B" style={styles.detailIcon} />
                  <View>
                    <Text style={styles.detailLabel}>Membre {userData?.created_at ? formatDate(userData.created_at) : 'Date inconnue'}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.section}>
                <TouchableOpacity 
                  style={styles.reviewItem}
                  onPress={() => navigation.navigate('UserReviews', { userId: userData.id })}
                >
                  <View style={styles.ratingContainer}>
                    <MaterialIcons name="star" size={20} color="#F6AD55" />
                    <Text style={styles.ratingText}>{ratingStats.average}</Text>
                    <Text style={styles.reviewCount}>({ratingStats.count} avis)</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#65676B" />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              {collectionsLoading ? (
                <ActivityIndicator size="small" color="#075E54" style={styles.loadingIndicator} />
              ) : collections.length > 0 ? (
                <FlatList
                  data={collections}
                  renderItem={renderMediaItem}
                  keyExtractor={(item) => item.id_collection}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.mediaGrid}
                />
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="images-outline" size={50} color="#CCD0D5" />
                  <Text style={styles.emptyStateText}>Aucune collection créée</Text>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  fixedHeader: {
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'black',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: 'Poppins-SemiBold',
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  coverContainer: {
    height: 100,
    width: '100%',
    position: 'relative',
    marginBottom: PROFILE_SIZE / 2,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  profileImageContainer: {
    position: 'absolute',
    bottom: -PROFILE_SIZE / 2,
    left: 20,
    width: PROFILE_SIZE,
    height: PROFILE_SIZE,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#fff',
   
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 15,
  },
  profileSection: {
    backgroundColor: '#FFFFFF',
    paddingBottom: 20,
    marginBottom: 10,
  },
  profileContent: {
    paddingHorizontal: 20,
    paddingTop: PROFILE_SIZE / 7 + 10,
  },
  fullName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#050505',
    marginBottom: 5,
    fontFamily: 'Poppins-Bold',
  },
  description: {
    fontSize: 15,
    color: '#050505',
    lineHeight: 22,
    marginBottom: 15,
    fontFamily: 'Inter-Regular',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 15,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    marginRight: 8,
    flex: 1,
  },
  messageButton: {
    backgroundColor: '#075E54',
  },
  followButton: {
    backgroundColor: '#E7F3FF',
    borderWidth: 1,
    borderColor: '#D8DADF',
  },
  callButton: {
    backgroundColor: '#075E54',
    width: 40,
    flex: 0,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 5,
    fontFamily: 'Inter-SemiBold',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#DADDE1',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#075E54',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#65676B',
    fontFamily: 'Inter-Medium',
  },
  activeTabText: {
    color: '#075E54',
    fontFamily: 'Inter-SemiBold',
  },
  tabContent: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 10,
  },
  section: {
    marginBottom: 20,
  },
  detailItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEDF0',
  },
  detailIcon: {
    marginRight: 15,
    width: 24,
  },
  detailLabel: {
    fontSize: 13,
    color: '#65676B',
    marginBottom: 3,
    fontFamily: 'Inter-Regular',
  },
  detailValue: {
    fontSize: 15,
    color: '#050505',
    fontFamily: 'Inter-Medium',
  },
  reviewItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#050505',
    marginLeft: 5,
    fontFamily: 'Trebuchet-MS-Bold',
  },
  reviewCount: {
    fontSize: 14,
    color: '#65676B',
    marginLeft: 5,
    fontFamily: 'Inter-Regular',
  },
  mediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
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
  loadingIndicator: {
    marginVertical: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#65676B',
    marginTop: 10,
    fontFamily: 'Inter-Regular',
  },
});

export default ProfileView;