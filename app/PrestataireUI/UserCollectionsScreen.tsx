import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  TouchableOpacity, 
  FlatList, 
  StatusBar, 
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const UserCollectionsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;
  
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchCollections();
  }, [userId]);

  const fetchCollections = async () => {
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
          created_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCollections(data || []);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCollections();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.collectionItem}
      onPress={() => navigation.navigate('CollectionDetail', { collection: item })}
      activeOpacity={0.8}
    >
      <Image 
        source={{ uri: item.image1_url }} 
        style={styles.collectionImage}
        resizeMode="cover"
      />
      <View style={styles.collectionInfo}>
        <Text style={styles.collectionDescription} numberOfLines={2}>
          {item.description || 'Collection sans description'}
        </Text>
        <View style={styles.imageCountBadge}>
          <Ionicons name="images" size={14} color="white" />
          <Text style={styles.imageCountText}>
            {[item.image1_url, item.image2_url, item.image3_url, item.image4_url, item.image5_url]
              .filter(Boolean).length}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Premium AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#2D3748" />
        </TouchableOpacity>
        
        <Text style={styles.title}>Mes Collections</Text>
        
        <View style={styles.rightPlaceholder} />
      </View>

      {/* Collections Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
        </View>
      ) : (
        <FlatList
          data={collections}
          renderItem={renderItem}
          keyExtractor={(item) => item.id_collection.toString()}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#075E54"
              colors={['#075E54']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="folder-open" size={48} color="#CBD5E0" />
              <Text style={styles.emptyText}>Aucune collection créée</Text>
              <Text style={styles.emptySubtext}>
                Commencez par créer votre première collection
              </Text>
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
    backgroundColor: '#FFFFFF',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 20,
    color: '#2D3748',
    letterSpacing: 0.5,
  },
  rightPlaceholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  collectionItem: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    margin: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  collectionImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#F8FAFC',
  },
  collectionInfo: {
    padding: 12,
    position: 'relative',
  },
  collectionDescription: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4A5568',
    lineHeight: 20,
    paddingRight: 30, // Space for badge
  },
  imageCountBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 135, 81, 0.9)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  imageCountText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#718096',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: 'Trebuchet MS',
    fontSize: 14,
    color: '#A0AEC0',
    marginTop: 8,
    textAlign: 'center',
  },
});

export default UserCollectionsScreen;