import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  StatusBar,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PrestataireListScreen = ({ navigation }) => {
  const [prestataires, setPrestataires] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        setCurrentUserId(userId);

        // Récupérer tous les prestataires
        const { data: prestatairesData, error: prestatairesError } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url, profession')
          .eq('type_compte', 'Prestataire');

        // Récupérer les favoris de l'utilisateur
        const { data: favoritesData, error: favoritesError } = await supabase
          .from('user_favorites')
          .select('favorite_user_id')
          .eq('user_id', userId);

        if (!prestatairesError && !favoritesError) {
          setPrestataires(prestatairesData || []);
          setFavorites(favoritesData.map(fav => fav.favorite_user_id) || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleFavorite = async (prestataireId) => {
    try {
      const isFavorite = favorites.includes(prestataireId);

      if (isFavorite) {
        // Supprimer des favoris
        const { error } = await supabase
          .from('user_favorites')
          .delete()
          .eq('user_id', currentUserId)
          .eq('favorite_user_id', prestataireId);

        if (!error) {
          setFavorites(favorites.filter(id => id !== prestataireId));
        }
      } else {
        // Ajouter aux favoris
        const { error } = await supabase
          .from('user_favorites')
          .insert([
            {
              user_id: currentUserId,
              favorite_user_id: prestataireId,
              created_at: new Date().toISOString()
            }
          ]);

        if (!error) {
          setFavorites([...favorites, prestataireId]);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const renderPrestataireItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.prestataireItem}
      onPress={() => navigation.navigate('PrestataireProfile', { userId: item.id })}
    >
      <Image
        source={item.photo_url ? { uri: item.photo_url } : require('../../assets/default-avatar.png')}
        style={styles.avatar}
      />
      <View style={styles.infoContainer}>
        <Text style={styles.name}>{item.full_name || 'Prestataire'}</Text>
        <Text style={styles.profession}>{item.profession || 'Métier non spécifié'}</Text>
      </View>
      <TouchableOpacity 
        style={styles.favoriteButton}
        onPress={() => toggleFavorite(item.id)}
      >
        <Ionicons 
          name={favorites.includes(item.id) ? "heart" : "heart-outline"} 
          size={24} 
          color={favorites.includes(item.id) ? "#FF3B30" : "#ADB5BD"} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.title}>Tous les prestataires</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Liste */}
      {loading ? (
        <ActivityIndicator size="large" color="#075E54" style={styles.loader} />
      ) : (
        <FlatList
          data={prestataires}
          renderItem={renderPrestataireItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Aucun prestataire trouvé</Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000'
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  listContainer: {
    padding: 16
  },
  prestataireItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12
  },
  infoContainer: {
    flex: 1
  },
  name: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333333',
    marginBottom: 4
  },
  profession: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666666'
  },
  favoriteButton: {
    padding: 8
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#666666',
    textAlign: 'center',
    marginTop: 24
  }
});

export default PrestataireListScreen;