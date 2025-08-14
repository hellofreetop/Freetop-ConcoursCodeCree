import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  StatusBar, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Toast from 'react-native-toast-message';

const Favoris = () => {
  const navigation = useNavigation();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Ajouter cet état

  // Ajouter cette fonction
  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchFavorites().finally(() => setRefreshing(false));
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchFavorites();
    });

    return unsubscribe;
  }, [navigation]);

  const fetchFavorites = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from('user_favorites')
        .select(`
          favorite_user_id,
          profiles: favorite_user_id (
            id,
            full_name,
            profession,
            photo_url
          )
        `)
        .eq('user_id', currentUserId);

      if (error) throw error;

      if (data) {
        const formattedFavorites = data.map(item => ({
          id: item.favorite_user_id,
          ...item.profiles
        }));
        setFavorites(formattedFavorites);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
    } finally {
      setLoading(false);
    }
  };

  // Remplacer les Alerts par des Toasts
  const handleMessage = async (user) => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) {
        Toast.show({
          type: 'error',
          text1: 'Erreur',
          text2: 'Vous devez être connecté'
        });
        return;
      }

      // Créer un array trié des participants pour assurer la cohérence
      const participants = [currentUserId, user.id].sort();

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
            [user.id]: {
              name: user.full_name,
              avatar: user.photo_url,
            }
          },
          unread: {
            [currentUserId]: 0,
            [user.id]: 0
          },
        });
      }

      navigation.navigate('Chat', {
        discussionId,
        otherUser: {
          id: user.id,
          name: user.full_name,
          avatar: user.photo_url,
          online: false
        }
      });

    } catch (error) {
      console.error('Erreur lors du démarrage de la conversation:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: 'Impossible de démarrer la conversation'
      });
    }
  };

 const handleCall = async (user) => {
  try {
    // Vérifier d'abord si le numéro est déjà dans les données de l'utilisateur
    if (user.phone) {
      Linking.openURL(`tel:${user.phone}`);
      return;
    }

    // Si le numéro n'est pas dans les données locales, le récupérer depuis Supabase
    const { data, error } = await supabase
      .from('profiles')
      .select('phone')
      .eq('id', user.id)
      .single();

    if (error) throw error;

    if (data?.phone) {
      Linking.openURL(`tel:${data.phone}`);
    } else {
      Alert.alert(
        'Numéro indisponible', 
        "Cet utilisateur n'a pas de numéro de téléphone enregistré",
        [{ text: 'OK' }]
      );
    }
  } catch (error) {
    console.error('Error fetching phone number:', error);
    Alert.alert(
      'Erreur', 
      "Impossible d'obtenir le numéro de téléphone",
      [{ text: 'OK' }]
    );
  }
};

  const renderItem = ({ item }) => (
    <View style={styles.favoriteItem}>
      <View style={styles.userInfo}>
        {item.photo_url ? (
          <Image source={{ uri: item.photo_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={24} color="white" />
          </View>
        )}
        <View style={styles.textContainer}>
          <Text style={styles.name}>{item.full_name || 'Utilisateur'}</Text>
          <Text style={styles.profession}>{item.profession || 'Profession non renseignée'}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => handleMessage(item)}
        >
          <Feather name="message-square" size={20} color="#075E54" />
        </TouchableOpacity>
        <TouchableOpacity 
  style={styles.actionButton}
  onPress={() => handleCall(item)}  // Passer l'item complet (user) au lieu de juste item.phone
>
  <Feather name="phone" size={20} color="#4299E1" />
</TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      
      <View style={styles.header}>
         <TouchableOpacity 
                  onPress={() => navigation.goBack()}
                 
                >
                  <Ionicons name="arrow-back" size={24} color="#2D3748" />
                </TouchableOpacity>
        <Text style={styles.title}>Favoris</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
        </View>
      ) : (
        <FlatList
          data={favorites}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="heart-dislike-outline" size={50} color="#CBD5E0" />
              <Text style={styles.emptyText}>Aucun favoris enregistré</Text>
              <Text style={styles.emptySubText}>Les profils que vous ajoutez en favoris apparaîtront ici</Text>
            </View>
          }
        />
      )}

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  header: {
    flexDirection: 'row',
    paddingTop: 20,
    paddingBottom: 5,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 20,
    marginLeft: 10,
    color: '#2D3748',
    fontFamily: 'Inter-Bold',
  },
  listContent: {
    paddingBottom: 80,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A5568',
    marginTop: 15,
    textAlign: 'center',
    fontFamily: 'Inter-SemiBold',
  },
  emptySubText: {
    fontSize: 14,
    color: '#718096',
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
  },
  favoriteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  avatarPlaceholder: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 3,
    fontFamily: 'Inter-SemiBold',
  },
  profession: {
    fontSize: 14,
    color: '#718096',
    fontFamily: 'Inter-Regular',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  actionButton: {
    padding: 10,
    marginLeft: 5,
  },
});

export default Favoris;