import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  StatusBar
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MessagerieMarketplace = ({ navigation }) => {
  const [discussions, setDiscussions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };

    fetchUserId();
  }, []);

  useEffect(() => {
    if (userId && isFocused) {
      fetchDiscussions();
    }
  }, [userId, isFocused]);

  const fetchDiscussions = async () => {
    try {
      setLoading(true);
      const discussionsRef = collection(db, 'discussionsMarketplace');
      const q = query(
        discussionsRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTime', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const discussionsData = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        discussionsData.push({ 
          id: doc.id, 
          ...data,
          // Ajout des informations supplémentaires nécessaires pour le chat
          price: data.productPrice || 0,
          address: data.creatorAddress || ''
        });
      });

      setDiscussions(discussionsData);
    } catch (error) {
      console.error('Error fetching discussions:', error);
      Alert.alert('Erreur', "Impossible de charger les discussions");
    } finally {
      setLoading(false);
    }
  };

  const renderDiscussion = ({ item }) => {
    const isUnread = item.unreadCount > 0 && item.lastMessageSender !== userId;
    
    return (
      <TouchableOpacity 
        style={styles.discussionItem}
        onPress={() => navigation.navigate('ChatMarketplace', { 
          discussionId: item.id,
          product: {
            id: item.productId,
            title: item.productTitle,
            image: item.productImage,
            price: item.price,
            creator: {
              id: item.creatorId,
              name: item.creatorName,
              address: item.address,
              photo: item.creatorPhoto
            }
          }
        })}
      >
        <View style={styles.imageContainer}>
          <Image 
            source={{ uri: item.productImage}} 
            style={styles.productImage}
          />
        </View>
        
        <View style={styles.textContainer}>
          <Text style={[styles.productTitle, { fontFamily: 'Poppins-SemiBold' }]}>
            {item.productTitle}
          </Text>
          <Text 
            style={[
              styles.lastMessage,
              { fontFamily: 'Poppins-Regular' },
              isUnread && styles.unreadMessage
            ]}
            numberOfLines={1}
          >
            {item.lastMessage}
          </Text>
        </View>
        
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { fontFamily: 'Poppins-Regular' }]}>
            {formatTime(item.lastMessageTime?.toDate())}
          </Text>
          {isUnread && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const formatTime = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Hier';
    } else {
      return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    }
  };

  if (loading) {
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
        backgroundColor="#075E54"
      />
      
      {/* AppBar */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <Text style={[styles.appBarTitle, { fontFamily: 'Poppins-SemiBold' }]}>
          Marketplace
        </Text>
        
        <View style={styles.rightIconPlaceholder} />
      </View>

      <FlatList
        data={discussions}
        renderItem={renderDiscussion}
        keyExtractor={item => item.id}
        contentContainerStyle={[styles.listContent, { paddingTop: 10 }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="message-square" size={48} color="#ccc" />
            <Text style={[styles.emptyText, { fontFamily: 'Poppins-Medium' }]}>
              Aucune discussion
            </Text>
          </View>
        }
      />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    top: -20,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  appBarTitle: {
    fontSize: 18,
    color: '#333',
  },
  rightIconPlaceholder: {
    width: 40,
  },
  listContent: {
    paddingBottom: 20,
  },
  discussionItem: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    marginRight: 15,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  productTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 5,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
  },
  unreadMessage: {
    color: '#075E54',
    fontWeight: 'bold',
  },
  timeContainer: {
    alignItems: 'flex-end',
  },
  timeText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 5,
  },
  unreadBadge: {
    backgroundColor: '#075E54',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
  },
});

export default MessagerieMarketplace;