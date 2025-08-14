import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  StatusBar, 
  Alert,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const CollectionsScreen = () => {
  const navigation = useNavigation();
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      setRefreshing(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('collections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
      Alert.alert('Erreur', 'Impossible de charger les collections');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const deleteCollection = async (id, folderName) => {
    try {
      Alert.alert(
        'Confirmation',
        'Voulez-vous vraiment supprimer cette collection ?',
        [
          {
            text: 'Annuler',
            style: 'cancel'
          },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              // Supprimer les images du storage
              const { error: storageError } = await supabase.storage
                .from('collections')
                .remove([folderName]);

              if (storageError) throw storageError;

              // Supprimer de la table
              const { error: dbError } = await supabase
                .from('collections')
                .delete()
                .eq('id_collection', id);

              if (dbError) throw dbError;

              fetchCollections();
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error deleting collection:', error);
      Toast.show({
        type: 'error',
        text1: 'Erreur Technique',
        text2: 'Impossible de supprimer la collection',
        position: 'top',
        visibilityTime: 10000,
      });
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.collectionCard}
      onPress={() => navigation.navigate('CollectionDetail', { 
        collection: item,
        onGoBack: fetchCollections 
      })}
      activeOpacity={0.9}
    >
      {item.image1_url ? (
        <Image 
          source={{ uri: item.image1_url }} 
          style={styles.collectionImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Ionicons name="images" size={32} color="#A0AEC0" />
        </View>
      )}
      
      <View style={styles.cardContent}>
        <Text style={styles.collectionName} numberOfLines={1}>
          {item.nom_collection || 'Freetop Collection'}
        </Text>
        <Text style={styles.collectionDate}>
          {new Date(item.created_at).toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          })}
        </Text>
        
        {item.description && (
          <Text style={styles.collectionDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => deleteCollection(item.id_collection, item.nom_dossier)}
      >
        <Ionicons name="trash-outline" size={20} color="#E53E3E" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header Premium */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Mes Collections</Text>
        
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => navigation.navigate('AddCollection', { onGoBack: fetchCollections })}
        >
          <Ionicons name="add" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Liste des collections */}
      <FlatList
        data={collections}
        renderItem={renderItem}
        keyExtractor={(item) => item.id_collection.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="folder-open" size={48} color="#CBD5E0" />
            <Text style={styles.emptyTitle}>Aucune collection</Text>
            <Text style={styles.emptyText}>
              Créez votre première collection pour organiser vos réalisations
            </Text>
          </View>
        }
        refreshing={refreshing}
        onRefresh={fetchCollections}
        showsVerticalScrollIndicator={false}
      />
      
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontSize: 20,
    color: '#1A202C',
    fontFamily: 'Poppins-SemiBold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#075E54',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  collectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  collectionImage: {
    width: '100%',
    height: 180,
  },
  imagePlaceholder: {
    width: '100%',
    height: 180,
    backgroundColor: '#F7FAFC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    padding: 20,
  },
  collectionName: {
    fontSize: 18,
    color: '#1A202C',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4,
  },
  collectionDate: {
    fontSize: 14,
    color: '#718096',
    fontFamily: 'Trebuchet MS',
    marginBottom: 12,
  },
  collectionDescription: {
    fontSize: 15,
    color: '#4A5568',
    fontFamily: 'Trebuchet MS',
    lineHeight: 22,
  },
  deleteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(229, 62, 62, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: '#2D3748',
    fontFamily: 'Poppins-SemiBold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#718096',
    fontFamily: 'Trebuchet MS',
    textAlign: 'center',
    lineHeight: 22,
  },
});

export default CollectionsScreen;