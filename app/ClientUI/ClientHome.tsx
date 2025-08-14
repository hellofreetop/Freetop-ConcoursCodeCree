import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  StatusBar, 
  TouchableOpacity, 
  FlatList,
  Dimensions,
  Linking,
  Animated,
  Share,
  Modal,
  TextInput
} from 'react-native';
import { 
  Ionicons, 
  Feather, 
  MaterialCommunityIcons, 
  FontAwesome,
  MaterialIcons 
} from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
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
import NotificationSetup from './NotificationSetup';
const { width } = Dimensions.get('window');
const CARD_WIDTH = width;
const CARD_HEIGHT = 480;

const ClientHome = () => {
  const navigation = useNavigation();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndices, setCurrentIndices] = useState({});
  const [likedCollections, setLikedCollections] = useState({});
  const [favorites, setFavorites] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [currentCollection, setCurrentCollection] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [ratings, setRatings] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');
  const scrollX = new Animated.Value(0);
  const viewedCollectionsRef = useRef({}); // Ajout pour éviter les vues multiples

  useEffect(() => {
    const fetchUserId = async () => {
      const userId = await AsyncStorage.getItem('userId');
      setCurrentUserId(userId);
      return userId;
    };

    const initData = async () => {
      const userId = await fetchUserId();
      await fetchRandomCollections();
      if (userId) {
        await fetchUserLikes(userId);
        await fetchUserFavorites(userId);
      }
    };

    initData();
  }, []);

  const fetchRandomCollections = async () => {
    try {
      const { data, error } = await supabase
        .from('collections')
        .select(`
          id_collection,
          description,
          image1_url,
          image2_url,
          image3_url,
          image4_url,
          image5_url,
          user_id,
          view_count,
          creator:profiles!user_id(id, full_name, photo_url, profession, phone),
          likes:collection_likes(count),
          comments:collection_comments(count)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      
      const shuffledCollections = data.sort(() => 0.5 - Math.random());
      setCollections(shuffledCollections);
      
      const indices = {};
      shuffledCollections.forEach(item => {
        indices[item.id_collection] = 0;
      });
      setCurrentIndices(indices);

      // Fetch ratings for creators
      fetchRatingsForCreators(shuffledCollections.map(c => c.creator.id));
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const incrementViewCount = async (collectionId) => {
    if (viewedCollectionsRef.current[collectionId]) return;
    viewedCollectionsRef.current[collectionId] = true;

    try {
      // Ajoute l'utilisateur à la table des vues uniques (ex: collection_views)
      const { error } = await supabase
        .from('collection_views')
        .insert({
          collection_id: collectionId,
          user_id: currentUserId,
          viewed_at: new Date().toISOString()
        });

      // Ne rien faire si error est vide (Supabase retourne {} si pas d'erreur)
      if (error && error.code && error.code !== '23505') throw error;

      // Mets à jour le nombre de vues uniques (utilisateurs distincts)
      const { count, error: countError } = await supabase
        .from('collection_views')
        .select('user_id', { count: 'exact', head: true })
        .eq('collection_id', collectionId);

      if (countError) throw countError;

      setCollections(prev => prev.map(item => {
        if (item.id_collection === collectionId) {
          return {
            ...item,
            view_count: count || 1
          };
        }
        return item;
      }));
    } catch (error) {
      console.error('Error incrementing view count:', error);
    }
  };

  const fetchRatingsForCreators = async (userIds) => {
    try {
      const { data, error } = await supabase
        .from('user_reviews')
        .select('reviewed_id, rating')
        .in('reviewed_id', userIds);

      if (error) throw error;

      // Calculer la moyenne côté JS
      const ratingsData = {};
      userIds.forEach(userId => {
        const userReviews = data.filter(item => item.reviewed_id === userId);
        if (userReviews.length > 0) {
          const avg = userReviews.reduce((sum, r) => sum + (r.rating || 0), 0) / userReviews.length;
          ratingsData[userId] = avg.toFixed(1);
        } else {
          ratingsData[userId] = '0.0';
        }
      });
      setRatings(ratingsData);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  };

  const fetchUserLikes = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('collection_likes')
        .select('collection_id')
        .eq('user_id', userId);

      if (error) throw error;

      const likes = {};
      data.forEach(like => {
        likes[like.collection_id] = true;
      });
      setLikedCollections(likes);
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const fetchUserFavorites = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_favorites')
        .select('favorite_user_id')
        .eq('user_id', userId);

      if (error) throw error;

      const favs = {};
      data.forEach(fav => {
        favs[fav.favorite_user_id] = true;
      });
      setFavorites(favs);
    } catch (error) {
      console.error('Error fetching favorites:', error);
    }
  };

  const fetchCollectionComments = async (collectionId) => {
    try {
      const { data, error } = await supabase
        .from('collection_comments')
        .select(`
          id,
          content,
          created_at,
          user:profiles!user_id(id, full_name, photo_url)
        `)
        .eq('collection_id', collectionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleLike = async (collectionId) => {
    try {
      if (!currentUserId) {
        Alert.alert('Connectez-vous', 'Vous devez être connecté pour liker');
        return;
      }

      const isLiked = likedCollections[collectionId];
      let newLikes = { ...likedCollections };

      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('collection_likes')
          .delete()
          .eq('user_id', currentUserId)
          .eq('collection_id', collectionId);

        if (error) throw error;
        delete newLikes[collectionId];
      } else {
        // Like
        const { error } = await supabase
          .from('collection_likes')
          .insert({
            user_id: currentUserId,
            collection_id: collectionId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        newLikes[collectionId] = true;
      }

      setLikedCollections(newLikes);
      
      // Update local collections data
      setCollections(prev => prev.map(item => {
        if (item.id_collection === collectionId) {
          const newCount = isLiked ? (item.likes[0]?.count - 1) : (item.likes[0]?.count + 1);
          return {
            ...item,
            likes: [{ count: newCount >= 0 ? newCount : 0 }]
          };
        }
        return item;
      }));

    } catch (error) {
      console.error('Error liking collection:', error);
    }
  };

  const handleToggleFavorite = async (userId) => {
    try {
      if (!currentUserId) {
        Alert.alert('Connectez-vous', 'Vous devez être connecté pour gérer les favoris');
        return;
      }

      const isFavorite = favorites[userId];
      let newFavorites = { ...favorites };

      if (isFavorite) {
        // Remove favorite
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', currentUserId)
          .eq('favorite_user_id', userId);

        if (error) throw error;
        delete newFavorites[userId];
      } else {
        // Add favorite
        const { error } = await supabase
          .from('user_favorites')
          .insert({
            user_id: currentUserId,
            favorite_user_id: userId,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        newFavorites[userId] = true;
      }

      setFavorites(newFavorites);

    } catch (error) {
      console.error('Error toggling favorite:', error);
      Alert.alert('Erreur', 'Impossible de modifier les favoris');
    }
  };

  const handleAddComment = async () => {
    try {
      if (!currentUserId || !currentCollection) return;
      if (!newComment.trim()) {
        Alert.alert('Erreur', 'Le commentaire ne peut pas être vide');
        return;
      }

      const { error } = await supabase
        .from('collection_comments')
        .insert({
          user_id: currentUserId,
          collection_id: currentCollection.id_collection,
          content: newComment.trim(),
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Refresh comments
      await fetchCollectionComments(currentCollection.id_collection);
      setNewComment('');

      // Update comment count
      setCollections(prev => prev.map(item => {
        if (item.id_collection === currentCollection.id_collection) {
          const newCount = (item.comments[0]?.count || 0) + 1;
          return {
            ...item,
            comments: [{ count: newCount }]
          };
        }
        return item;
      }));

    } catch (error) {
      console.error('Error adding comment:', error);
      Alert.alert('Erreur', 'Impossible d\'ajouter le commentaire');
    }
  };

  const handleViewComments = async (collection) => {
    setCurrentCollection(collection);
    await fetchCollectionComments(collection.id_collection);
    setShowComments(true);
  };

  const getCollectionImages = (collection) => {
    return [
      collection.image1_url,
      collection.image2_url,
      collection.image3_url,
      collection.image4_url,
      collection.image5_url
    ].filter(url => url);
  };

  const handleImageIndexChange = (collectionId, index) => {
    setCurrentIndices(prev => ({
      ...prev,
      [collectionId]: index
    }));
  };

  const handleShare = async (collection) => {
    try {
      const images = getCollectionImages(collection);
      const firstImage = images[0] || '';
      
      await Share.share({
        message: `Découvrez cette collection sur Freetop: ${collection.description}\n\nTéléchargez l'application Freetop pour voir plus de contenus comme celui-ci!`,
        title: 'Collection Freetop',
        url: firstImage
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleCall = (phoneNumber) => {
    Linking.openURL(`tel:${phoneNumber}`);
  };

  const renderCollection = ({ item }) => {
    const images = getCollectionImages(item);
    const hasPhone = !!item.creator.phone;
    const currentIndex = currentIndices[item.id_collection] || 0;
    const isLiked = likedCollections[item.id_collection];
    const likeCount = item.likes[0]?.count || 0;
    const commentCount = item.comments[0]?.count || 0;
    const isFavorite = favorites[item.creator.id];
    const creatorRating = ratings[item.creator.id] || '0.0';

    return (
      <View style={styles.collectionContainer}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <TouchableOpacity 
            style={styles.userInfoContainer}
            onPress={() => navigation.navigate('ProfileView', { userId: item.creator.id })}
          >
            {item.creator.photo_url ? (
              <Image 
                source={{ uri: item.creator.photo_url }} 
                style={styles.avatar} 
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.creator.full_name?.charAt(0).toUpperCase() || 'U'}
                </Text>
              </View>
            )}
            
            <View style={styles.userInfo}>
              <Text style={styles.username}>{item.creator.full_name || 'Créateur'}</Text>
              <View style={styles.professionContainer}>
                <Text style={styles.profession}>{item.creator.profession || 'Professionnel'}</Text>
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={14} color="#F6AD55" />
                  <Text style={styles.ratingText}>{creatorRating}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.headerActions}>
            {currentUserId && currentUserId !== item.creator.id && (
              <TouchableOpacity
                onPress={() => handleToggleFavorite(item.creator.id)}
                style={styles.favoriteButton}
              >
                <Ionicons
                  name={isFavorite ? "heart" : "heart-outline"}
                  size={24}
                  color={isFavorite ? "#E53E3E" : "#262626"}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Image Carousel */}
        {images.length > 0 && (
          <View style={styles.imageCarousel}>
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              renderItem={({ item: imageUrl }) => (
                <Image 
                  source={{ uri: imageUrl }} 
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              )}
              keyExtractor={(item, index) => index.toString()}
              onMomentumScrollEnd={(e) => {
                const newIndex = Math.round(
                  e.nativeEvent.contentOffset.x / CARD_WIDTH
                );
                handleImageIndexChange(item.id_collection, newIndex);
              }}
            />

            {/* Pagination Dots */}
            {images.length > 1 && (
              <View style={styles.paginationContainer}>
                {images.map((_, index) => (
                  <View 
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentIndex && styles.activeDot
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actionsContainer}>
          <View style={styles.leftActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleLike(item.id_collection)}
            >
              <MaterialCommunityIcons 
                name={isLiked ? "thumb-up" : "thumb-up-outline"} 
                size={24} 
                color={isLiked ? "#075E54" : "#262626"} 
              />
              <Text style={styles.actionCount}>{likeCount}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleViewComments(item)}
            >
              <MaterialCommunityIcons 
                name="comment-outline" 
                size={24} 
                color="#262626" 
              />
              <Text style={styles.actionCount}>{commentCount}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleShare(item)}
            >
              <Feather name="send" size={24} color="#262626" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.viewCountContainer}>
            <Ionicons name="stats-chart" size={20} color="#8e8e8e" />
            <Text style={styles.viewCountText}>{item.view_count || 0}</Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.descriptionContainer}>
          <Text style={styles.descriptionText}>
            {item.description}
          </Text>
        </View>
      </View>
    );
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await supabase
        .from('collection_comments')
        .delete()
        .eq('id', commentId);

      // Refresh comments
      if (currentCollection) {
        await fetchCollectionComments(currentCollection.id_collection);
      }
    } catch (error) {
      console.error('Erreur suppression commentaire:', error);
    }
  };

  const handleEditComment = (comment) => {
    setEditingCommentId(comment.id);
    setEditingCommentText(comment.content);
  };

  const handleSaveEditComment = async () => {
    try {
      await supabase
        .from('collection_comments')
        .update({ content: editingCommentText })
        .eq('id', editingCommentId);

      setEditingCommentId(null);
      setEditingCommentText('');
      // Refresh comments
      if (currentCollection) {
        await fetchCollectionComments(currentCollection.id_collection);
      }
    } catch (error) {
      console.error('Erreur modification commentaire:', error);
    }
  };

  return (
    
    <View style={styles.container}>
      {/* AppBar */}
      <View style={styles.appBar}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        
        <View style={styles.iconsContainer}>
          <TouchableOpacity 
            onPress={() => navigation.navigate('SearchScreen')}
            style={styles.iconButton}
          >
            <Feather name="search" size={24} color="#262626" />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('Favoris')}
            style={styles.iconButton}
          >
            <Feather name="heart" size={24} color="#262626" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collections List */}
      <FlatList
        data={collections}
        renderItem={renderCollection}
        keyExtractor={(item) => item.id_collection}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
             <Ionicons name="newspaper-outline" size={60} color="#dbdbdb" />
              <Text style={styles.emptyText}>Aucune actualité disponible.
                Soyez le premier à créer une opportunité, une collection ou un article .</Text>
            </View>
          )
        }
        refreshing={loading}
        onRefresh={fetchRandomCollections}
        onViewableItemsChanged={({ viewableItems }) => {
          viewableItems.forEach(({ item }) => {
            incrementViewCount(item.id_collection);
          });
        }}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      />

      {/* Comments Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowComments(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => setShowComments(false)}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#075E54" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Commentaires</Text>
            <View style={{ width: 24 }} />
          </View>

          <FlatList
            data={comments}
            renderItem={({ item }) => {
              const isOwnComment = item.user?.id === currentUserId;
              return (
                <View style={styles.commentContainer}>
                  <View style={styles.commentHeader}>
                    {item.user.photo_url ? (
                      <Image 
                        source={{ uri: item.user.photo_url }} 
                        style={styles.commentAvatar} 
                      />
                    ) : (
                      <View style={styles.commentAvatarPlaceholder}>
                        <Text style={styles.commentAvatarText}>
                          {item.user.full_name?.charAt(0).toUpperCase() || 'U'}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.commentUsername}>{item.user.full_name}</Text>
                    {isOwnComment && (
                      <View style={styles.commentActions}>
                        <TouchableOpacity onPress={() => handleEditComment(item)} style={styles.commentActionBtn}>
                          <Ionicons name="create-outline" size={18} color="#075E54" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteComment(item.id)} style={styles.commentActionBtn}>
                          <Ionicons name="trash-outline" size={18} color="#E53E3E" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {editingCommentId === item.id ? (
                    <View style={styles.editCommentRow}>
                      <TextInput
                        style={styles.editCommentInput}
                        value={editingCommentText}
                        onChangeText={setEditingCommentText}
                        autoFocus
                        multiline
                      />
                      <TouchableOpacity onPress={handleSaveEditComment} style={styles.saveEditBtn}>
                        <Ionicons name="checkmark" size={22} color="#075E54" />
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => setEditingCommentId(null)} style={styles.cancelEditBtn}>
                        <Ionicons name="close" size={22} color="#888" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.commentText}>{item.content}</Text>
                      <Text style={styles.commentDate}>
                        {new Date(item.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </>
                  )}
                </View>
              );
            }}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={
              <Text style={styles.noCommentsText}>Aucun commentaire</Text>
            }
          />

          <View style={styles.commentInputContainer}>
            <TextInput
              style={styles.commentInput}
              placeholder="Ajouter un commentaire..."
              value={newComment}
              onChangeText={setNewComment}
              multiline
            />
            <TouchableOpacity 
              onPress={handleAddComment}
              disabled={!newComment.trim()}
              style={styles.commentButton}
            >
              <Ionicons 
                name="send" 
                size={24} 
                color={newComment.trim() ? "#075E54" : "#ccc"} 
              />
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
    backgroundColor: 'white',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'white',
  },
  logo: {
    marginLeft: -20,
    width: 130,
    height: 30,
  },
  iconsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 20,
  },
  content: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#8e8e8e',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Poppins-Regular',
  },
  collectionContainer: {
    marginBottom: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#dbdbdb',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontWeight: '600',
    color: '#262626',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
  },
  professionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profession: {
    fontSize: 12,
    color: '#8e8e8e',
    fontFamily: 'Trebuchet MS',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  paginationContainer: {
    position: 'absolute',
    bottom: 15,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 3,
  },
  activeDot: {
    backgroundColor: '#075E54',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    marginRight: 16,
    padding: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionCount: {
    fontSize: 12,
    color: '#262626',
    marginLeft: 4,
    fontFamily: 'Trebuchet MS',
  },
  viewCountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewCountText: {
    fontSize: 15,
    color: '#8e8e8e',
    marginLeft: 4,
    fontFamily: 'Trebuchet MS',
  },
  descriptionContainer: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  descriptionText: {
    color: '#262626',
    fontFamily: 'Trebuchet MS',
    fontSize: 14,
    lineHeight: 20,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#262626',
  },
  commentsList: {
    padding: 16,
    paddingBottom: 80,
  },
  commentContainer: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  commentAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  commentAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: 'Poppins-Bold',
  },
  commentUsername: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#262626',
  },
  commentText: {
    fontSize: 14,
    fontFamily: 'Trebuchet MS',
    color: '#262626',
    marginBottom: 4,
    lineHeight: 20,
  },
  commentDate: {
    fontSize: 12,
    fontFamily: 'Trebuchet MS',
    color: '#8e8e8e',
  },
  noCommentsText: {
    textAlign: 'center',
    color: '#8e8e8e',
    fontFamily: 'Trebuchet MS',
    marginTop: 20,
  },
  commentInputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontFamily: 'Trebuchet MS',
  },
  commentButton: {
    marginLeft: 8,
    padding: 8,
  },
  commentActions: {
    flexDirection: 'row',
    marginLeft: 8,
  },
  commentActionBtn: {
    marginLeft: 6,
    padding: 2,
  },
  editCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  editCommentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontFamily: 'Trebuchet MS',
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  saveEditBtn: {
    marginLeft: 8,
    padding: 4,
  },
  cancelEditBtn: {
    marginLeft: 2,
    padding: 4,
  },
  imageCarousel: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#fafafa',
    position: 'relative',
  },
  mainImage: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
});

export default ClientHome;
