import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
  Alert,
  Keyboard
} from 'react-native';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import MasonryList from '@react-native-seoul/masonry-list'; 
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Toast from 'react-native-toast-message';

const SearchScreen = () => {
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [allCollections, setAllCollections] = useState([]);

  useEffect(() => {
    if (searchQuery.length > 2) {
      handleSearch();
    } else {
      setSearchResults([]);
      fetchAllCollections();
    }
  }, [searchQuery]);

  const fetchAllCollections = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('collections')
        .select('id_collection, image1_url, image2_url, image3_url, image4_url, image5_url');

      if (error) throw error;

      // Récupère toutes les images de toutes les collections et mélange
      let images = [];
      data.forEach(col => {
        [col.image1_url, col.image2_url, col.image3_url, col.image4_url, col.image5_url].forEach((img, idx) => {
          if (img) {
            images.push({
              id: `${col.id_collection}_${idx}`,
              url: img,
              collectionId: col.id_collection,
              height: 180 + Math.floor(Math.random() * 100),
            });
          }
        });
      });
      // Mélange aléatoire
      images = images.sort(() => Math.random() - 0.5);
      setAllCollections(images);
    } catch (error) {
      console.error('Erreur récupération collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          photo_url,
          profession,
          phone,
          type_compte,
          user_reviews:user_reviews!user_reviews_reviewed_id_fkey (
            rating
          )
        `)
        .or(`full_name.ilike.%${searchQuery}%,profession.ilike.%${searchQuery}%`)
        .eq('type_compte', 'Prestataire')
        .limit(10);

      if (error) throw error;

      const results = data.map(profile => {
        const ratings = profile.user_reviews.map(review => review.rating);
        const averageRating = ratings.length > 0 
          ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
          : 0;
        
        return {
          id: profile.id,
          name: profile.full_name,
          profession: profile.profession,
          photo_url: profile.photo_url,
          phone: profile.phone,
          rating: parseFloat(averageRating),
          type: 'prestataire'
        };
      });

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la recherche');
    } finally {
      setLoading(false);
    }
  };

  const handleMessage = async (userId, userData) => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Vous devez être connecté pour envoyer un message'
        });
        return;
      }

      // Créer un array trié des participants pour assurer la cohérence
      const participants = [currentUserId, userId].sort();

      // Vérifier si une discussion existe déjà
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
        // Créer une nouvelle discussion
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
              name: userData.name,
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
          name: userData.name,
          avatar: userData.photo_url,
          online: false
        }
      });

    } catch (error) {
      console.error('Error starting chat:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de démarrer la conversation'
      });
    }
  };

  const handleCall = (phoneNumber) => {
    // Fermer le clavier avant l'alerte
    Keyboard.dismiss();
    
    if (!phoneNumber) {
      Alert.alert('Information', 'Ce prestataire n\'a pas de numéro de téléphone enregistré');
      return;
    }

    Alert.alert(
      'Appeler',
      `Voulez-vous appeler ${phoneNumber} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Appeler', onPress: () => Linking.openURL(`tel:${phoneNumber}`) }
      ]
    );
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <View style={styles.starsContainer}>
        {[...Array(fullStars)].map((_, i) => (
          <MaterialIcons key={`full-${i}`} name="star" size={16} color="#F6AD55" />
        ))}
        {hasHalfStar && (
          <MaterialIcons key="half" name="star-half" size={16} color="#F6AD55" />
        )}
        {[...Array(emptyStars)].map((_, i) => (
          <MaterialIcons key={`empty-${i}`} name="star-border" size={16} color="#F6AD55" />
        ))}
        <Text style={styles.ratingText}>{rating}</Text>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => {
        Keyboard.dismiss();
        navigation.navigate('ProfileView', { userId: item.id });
      }}
      activeOpacity={0.7}
    >
      <View style={styles.profileInfo}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="white" />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.nameText}>{item.name}</Text>
          <Text style={styles.professionText}>{item.profession}</Text>
          {renderStars(item.rating)}
        </View>
      </View>
      
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleMessage(item.id, item)}
          activeOpacity={0.6}
        >
          <Feather name="message-square" size={20} color="#075E54" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleCall(item.phone)}
          activeOpacity={0.6}
        >
          <Feather name="phone" size={20} color="#4299E1" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  // Nouveau rendu pour la grille Pinterest (sans description, navigation vers UserCollectionDetail)
  const renderPinterestItem = ({ item }) => (
    <TouchableOpacity
      style={{ margin: 4, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f8f8f8' }}
      onPress={() => navigation.navigate('UserCollectionDetail', { collectionId: item.collectionId })}
      activeOpacity={0.85}
    >
      <Image
        source={{ uri: item.url }}
        style={{ width: '100%', height: item.height, borderRadius: 12 }}
        resizeMode="cover"
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      {/* Barre de recherche */}
      <View style={styles.searchContainer}>
        <TouchableOpacity 
          onPress={() => {
            Keyboard.dismiss();
            navigation.goBack();
          }}
          activeOpacity={0.6}
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un prestataire..."
          placeholderTextColor="#A0AEC0"
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoFocus
          returnKeyType="search"
          onSubmitEditing={handleSearch}
          blurOnSubmit={false}
        />
        
        {loading ? (
          <ActivityIndicator size="small" color="#075E54" />
        ) : (
          <TouchableOpacity 
            onPress={handleSearch}
            activeOpacity={0.6}
          >
            <Ionicons name="search" size={24} color="#075E54" />
          </TouchableOpacity>
        )}
      </View>

      {/* Résultats */}
      {searchQuery.length === 0 ? (
        loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#075E54" />
        ) : (
          <MasonryList
            data={allCollections}
            keyExtractor={item => item.id}
            numColumns={2}
            showsVerticalScrollIndicator={false}
            renderItem={renderPinterestItem}
            contentContainerStyle={{ padding: 6, paddingBottom: 20 }}
            refreshing={loading}
            onRefresh={fetchAllCollections}
          />
        )
      ) : (
        <TouchableOpacity
          activeOpacity={1}
          style={{ flex: 1 }}
          onPress={() => Keyboard.dismiss()}
        >
          <FlatList
            data={searchResults}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            contentContainerStyle={styles.resultsContainer}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Ionicons name="search" size={60} color="#E2E8F0" />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'Aucun prestataire trouvé' : 'Recherchez par nom ou profession'}
                </Text>
              </View>
            }
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginHorizontal: 12,
    fontSize: 16,
    color: '#2D3748',
    fontFamily: 'Trebuchet MS',
  },
  resultsContainer: {
    paddingBottom: 20,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  nameText: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#2D3748',
    marginBottom: 2,
  },
  professionText: {
    fontSize: 14,
    fontFamily: 'Trebuchet MS',
    color: '#718096',
    marginBottom: 4,
  },
  starsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 14,
    color: '#718096',
    marginLeft: 5,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  actionButton: {
    marginLeft: 15,
    padding: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#718096',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
  },
});

export default SearchScreen;