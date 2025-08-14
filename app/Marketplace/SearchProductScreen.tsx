import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions 
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as Font from 'expo-font';

const { width } = Dimensions.get('window');

// Charger les polices personnalisées
async function loadFonts() {
  await Font.loadAsync({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
}

const SearchProductScreen = ({ navigation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    if (query.length > 2) {
      searchProducts();
    } else {
      setResults([]);
    }
  }, [query]);

  const searchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          title,
          product_images(url),
          profiles(full_name)
        `)
        .ilike('title', `%${query}%`)
        .limit(10);

      if (error) throw error;
      setResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.product_images[0]?.url || 'default-product.png' }} 
          style={styles.resultImage}
        />
        {item.product_images.length > 1 && (
          <View style={styles.moreImagesBadge}>
            <Text style={styles.moreImagesText}>+{item.product_images.length - 1}</Text>
          </View>
        )}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.resultCreator}>Par {item.profiles.full_name}</Text>
      </View>
    </TouchableOpacity>
  );

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header with Back Button and Search Bar */}
      <View style={styles.headerContainer}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <View style={styles.searchContainer}>
          <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher des produits..."
            placeholderTextColor="#999"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
        </View>
      ) : results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderResult}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsContainer}
        />
      ) : query.length > 2 ? (
        <View style={styles.noResultsContainer}>
          <Feather name="search" size={40} color="#ccc" />
          <Text style={styles.noResultsText}>Aucun résultat trouvé</Text>
        </View>
      ) : (
        <View style={styles.noResultsContainer}>
          <Feather name="search" size={40} color="#ccc" />
          <Text style={styles.noResultsText}>Commencez à taper pour rechercher</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    paddingHorizontal: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Poppins-Regular',
    paddingVertical: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultsContainer: {
    paddingHorizontal: 15,
  },
  resultItem: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    marginRight: 15,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  moreImagesBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreImagesText: {
    color: '#fff',
    fontSize: 10,
    fontFamily: 'Poppins-Bold',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  resultTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 5,
  },
  resultCreator: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Poppins-Regular',
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noResultsText: {
    marginTop: 15,
    fontSize: 16,
    color: '#999',
    fontFamily: 'Poppins-Medium',
  },
});

export default SearchProductScreen;