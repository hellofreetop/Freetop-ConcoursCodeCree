import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, onSnapshot, orderBy, or, getDocs, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const MessagerieClient = ({ navigation }) => {
  const [discussions, setDiscussions] = useState([]);
  const [filteredDiscussions, setFilteredDiscussions] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState(null);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [userFullName, setUserFullName] = useState('');

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (!id) throw new Error('User ID not found');
        setUserId(id);

        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', id)
          .single();
        if (!error && data?.full_name) setUserFullName(data.full_name);
      } catch (err) {
        console.error("Failed to get user ID:", err);
        setError("Failed to load user data");
        setLoading(false);
      }
    };

    fetchUserId();
  }, []);

  useEffect(() => {
    if (!userId) return;

    const fetchFavorites = async () => {
      try {
        const { data, error } = await supabase
          .from('user_favorites')
          .select('favorite_user_id')
          .eq('user_id', userId);

        if (error) throw error;

        if (data && data.length > 0) {
          const favoriteIds = data.map(item => item.favorite_user_id);
          const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, full_name, photo_url, online_mark')
            .in('id', favoriteIds);

          if (profileError) throw profileError;

          setFavorites(profiles || []);
        }
      } catch (err) {
        console.error("Error fetching favorites:", err);
      }
    };

    fetchFavorites();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'discussions'),
        where('participants', 'array-contains', userId),
        orderBy('created_at', 'desc')
      );

      const unsubscribe = onSnapshot(q, 
        async (snapshot) => {
          try {
            const discussionsData = await Promise.all(
              snapshot.docs.map(async doc => {
                const data = doc.data();
                const otherUserId = data.participants.find(id => id !== userId);
                
                try {
                  // Récupérer les messages non lus envoyés par l'autre utilisateur
                  const messagesQuery = query(
                    collection(db, 'discussions', doc.id, 'messages'),
                    where('sender_id', '==', otherUserId),
                    where('is_read', '==', false)
                  );
                  
                  const messagesSnapshot = await getDocs(messagesQuery);
                  const unreadCount = messagesSnapshot.size;

                  const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('id, full_name, photo_url, online_mark')
                    .eq('id', otherUserId)
                    .single();

                  if (profileError) throw profileError;

                  return {
                    id: doc.id,
                    lastMessage: data.last_message,
                    unread: unreadCount, // Utiliser le vrai compte de messages non lus
                    otherUser: {
                      id: otherUserId,
                      name: profile?.full_name || 'Inconnu',
                      avatar: profile?.photo_url,
                      online: profile?.online_mark === true
                    },
                    participants: data.participants,
                    participants_info: data.participants_info || {}
                  };
                } catch (error) {
                  console.error("Error fetching profile or messages:", error);
                  return null;
                }
              })
            );

            const validDiscussions = discussionsData
              .filter(d => d !== null)
              .sort((a, b) => {
                const dateA = a.lastMessage?.sent_at?.toDate?.() || 0;
                const dateB = b.lastMessage?.sent_at?.toDate?.() || 0;
                return dateB - dateA;
              });

            setDiscussions(validDiscussions);
            setFilteredDiscussions(validDiscussions);
            setLoading(false);
          } catch (err) {
            console.error("Error processing discussions:", err);
            setError("Impossible de charger les discussions");
            setLoading(false);
          }
        },
        (err) => {
          console.error("Snapshot error:", err);
          setError("Erreur de chargement des discussions");
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error("Query setup error:", err);
      setError("Erreur de configuration");
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (showUnreadOnly) {
      setFilteredDiscussions(discussions.filter(d => d.unread > 0));
    } else {
      setFilteredDiscussions(discussions);
    }
  }, [showUnreadOnly, discussions]);

  const renderAvatar = (user, size = 60) => {
    if (user.avatar) {
      return (
        <Image
          source={{ uri: user.avatar }}
          style={[styles.avatar, { width: size, height: size }]}
        />
      );
    } else {
      return (
       <Image
          source={require('../../assets/default-avatar.png')}
          style={[styles.avatar, { width: size, height: size }]}
        />
      );
    }
  };

  const renderDiscussion = ({ item }) => {
    const lastMessageTime = item.lastMessage?.sent_at?.toDate
      ? item.lastMessage.sent_at.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.discussionItem}
        onPress={() => navigation.navigate('Chat', { 
          discussionId: item.id, 
          otherUser: item.otherUser 
        })}
      >
        <View style={styles.avatarContainer}>
          {renderAvatar(item.otherUser)}
          {item.otherUser.online && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.discussionContent}>
          <View style={styles.discussionHeader}>
            <Text style={styles.discussionName} numberOfLines={1}>
              {item.otherUser.name}
            </Text>
            <Text style={styles.discussionTime}>
              {lastMessageTime}
            </Text>
          </View>
          
          <Text 
            style={[
              styles.discussionMessage,
              item.unread > 0 && styles.unreadMessage
            ]}
            numberOfLines={1}
          >
            {item.lastMessage?.content || 'Aucun message'}
          </Text>
        </View>
        
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadCount}>
              {item.unread > 9 ? '9+' : item.unread}
            </Text>
          </View>
        )}
        
        {item.unread > 0 && <View style={styles.unreadLine} />}
      </TouchableOpacity>
    );
  };

  const toggleUnreadFilter = () => {
    setShowUnreadOnly(!showUnreadOnly);
  };

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => {
            setLoading(true);
            setError(null);
          }}
        >
          <Text style={styles.retryText}>Réessayer</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messagerie</Text>
          {userFullName ? (
            <Text style={styles.headerSubtitle}>{userFullName}</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleUnreadFilter} style={styles.filterButton}>
            <Ionicons 
              name={showUnreadOnly ? "filter" : "filter-outline"} 
              size={24} 
              color="#075E54" 
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Favoris')}>
            <Ionicons name="add" size={28} color="#075E54" />
          </TouchableOpacity>
           <TouchableOpacity onPress={() => navigation.navigate('MessagerieMarketplace')}>
            <Ionicons name="storefront" size={24} color="#075E54" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={filteredDiscussions}
        renderItem={renderDiscussion}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles" size={60} color="#CBD5E0" />
            <Text style={styles.emptyText}>
              {showUnreadOnly ? 'Aucun message non lu' : 'Aucune discussion'}
            </Text>
          </View>
        }
      />
    </View>
  );
};

// Les styles restent les mêmes que dans votre code original
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  headerTitle: {
    fontSize: 24,
    color: '#2D3748',
    fontFamily: 'Poppins-Bold',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#075E54',
    fontFamily: 'Poppins-SemiBold',
    marginTop: 2,
    marginLeft: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  filterButton: {
    marginRight: 10,
  },
  favoritesContainer: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  favoriteItem: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 70,
  },
  favoriteName: {
    fontSize: 12,
    color: '#4A5568',
    marginTop: 5,
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    fontFamily: 'Poppins-SemiBold',
  },
  retryButton: {
    backgroundColor: '#075E54',
    padding: 15,
    borderRadius: 8,
  },
  retryText: {
    color: 'white',
    fontWeight: 'bold',
    fontFamily: 'Poppins-SemiBold',
  },
  listContent: {
    paddingBottom: 20,
  },
  discussionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    borderRadius: 30,
  },
  avatarPlaceholder: {
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A5568',
    fontFamily: 'Poppins-Bold',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#075E54',
    borderWidth: 2,
    borderColor: 'white',
  },
  discussionContent: {
    flex: 1,
  },
  discussionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  discussionName: {
    fontSize: 16,
    color: '#2D3748',
    maxWidth: width * 0.5,
    fontFamily: 'Poppins-SemiBold',
  },
  discussionTime: {
    fontSize: 12,
    color: '#A0AEC0',
    fontFamily: 'Trebuchet MS',
  },
  discussionMessage: {
    fontSize: 14,
    color: '#718096',
    maxWidth: width * 0.7,
    fontFamily: 'Trebuchet MS',
  },
  unreadMessage: {
    fontWeight: 'bold',
    color: '#2D3748',
    fontFamily: 'Poppins-SemiBold',
  },
  unreadBadge: {
    backgroundColor: '#075E54',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  unreadCount: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: 'Poppins-SemiBold',
  },
  unreadLine: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: '#075E54',
    borderTopLeftRadius: 5,
    borderBottomLeftRadius: 5,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#A0AEC0',
    marginTop: 15,
    fontFamily: 'Trebuchet MS',
  },
});

export default MessagerieClient;