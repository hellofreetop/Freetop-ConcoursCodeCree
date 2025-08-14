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
  RefreshControl
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as Font from 'expo-font';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 30) / 2;

// Charger les polices personnalisées
async function loadFonts() {
  await Font.loadAsync({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
}

const MarketplaceScreen = ({ navigation }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const [userType, setUserType] = useState(null);
  const [userId, setUserId] = useState(null);

  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
    checkUserType();
    fetchProducts();
  }, []);

  const checkUserType = async () => {
    try {
      const storedUserId = await AsyncStorage.getItem('userId');
      if (!storedUserId) return;

      setUserId(storedUserId);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('type_compte')
        .eq('id', storedUserId)
        .single();

      if (!error && data) {
        setUserType(data.type_compte);
      }
    } catch (error) {
      console.error('Error checking user type:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await checkUserType();
    await fetchProducts();
    setRefreshing(false);
  };

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_images(url, is_primary),
          product_reviews(rating),
          profiles(full_name, photo_url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const productsWithRandomHeights = data.map(product => ({
        ...product,
        avgRating: calculateAverageRating(product.product_reviews),
        reviewCount: product.product_reviews.length,
        primaryImage: product.product_images.find(img => img.is_primary)?.url || product.product_images[0]?.url,
      }));

      setProducts(productsWithRandomHeights);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageRating = (reviews) => {
    if (!reviews || reviews.length === 0) return 0;
    const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
    return sum / reviews.length;
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons 
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={14} 
          color={i <= rating ? '#FFD700' : '#ddd'} 
          style={styles.starIcon}
        />
      );
    }
    return stars;
  };

  const renderProduct = ({ item }) => (
    <TouchableOpacity 
      style={styles.productCard}
      onPress={() => navigation.navigate('ViewProduct', { productId: item.id })}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: item.primaryImage }} 
          style={styles.productImage}
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.3)']}
          style={styles.imageOverlay}
        />
        
        {item.discount > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>
              -{Math.round((item.discount / item.price) * 100)}%
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.productDetails}>
        <Text style={styles.productTitle} numberOfLines={2}>{item.title}</Text>
        
        <View style={styles.priceContainer}>
          {item.discount > 0 ? (
            <>
              <Text style={styles.discountedPrice}>{(item.price - item.discount).toFixed(2)} Fcfa</Text>
              <Text style={styles.originalPrice}>{item.price.toFixed(2)} Fcfa</Text>
            </>
          ) : (
            <Text style={styles.price}>{item.price.toFixed(2)} Fcfa</Text>
          )}
        </View>
        
        <View style={styles.footerContainer}>
          <View style={styles.ratingContainer}>
            {renderStars(item.avgRating)}
            <Text style={styles.ratingText}>({item.reviewCount})</Text>
          </View>
          
          <View style={styles.creatorContainer}>
            <Image 
              source={{ uri: item.profiles.photo_url }} 
              style={styles.creatorAvatar} 
            />
          </View>
        </View>
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
      {/* AppBar */}
      <View style={styles.appBar}>
        <Image 
          source={require('../../assets/freetopstore.png')} 
          style={styles.logo} 
        />
        <View style={styles.appBarIcons}>
          {/*<TouchableOpacity onPress={() => navigation.navigate('Promo')}>
            <Feather name="tag" size={24} color="#333" />
          </TouchableOpacity>*/}
          
          {userType === 'Prestataire' && (
            <TouchableOpacity 
              onPress={() => navigation.navigate('AddProduct')}
              style={styles.iconSpacing}
            >
              <Feather name="plus-square" size={24} color="#333" />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity onPress={() => navigation.navigate('MessagerieMarketplace')}>
            <Feather name="message-square" size={24} color="#333" style={styles.iconSpacing} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Barre de recherche */}
      <TouchableOpacity 
        style={styles.searchBar}
        onPress={() => navigation.navigate('SearchProduct')}
      >
        <Feather name="search" size={20} color="#999" />
        <Text style={styles.searchPlaceholder}>Rechercher des produits...</Text>
      </TouchableOpacity>

      {/* Grille de produits */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
        </View>
      ) : (
        <FlatList
          data={products}
          renderItem={renderProduct}
          keyExtractor={item => item.id}
          numColumns={2}
          contentContainerStyle={styles.productsContainer}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#075E54']}
              tintColor="#075E54"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  logo: {
    width: 120,
    height: 30,
    resizeMode: 'contain',
  },
  appBarIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconSpacing: {
    marginHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 10,
    margin: 15,
  },
  searchPlaceholder: {
    color: '#999',
    marginLeft: 10,
    fontFamily: 'Poppins-Medium',
  },
  productsContainer: {
    padding: 10,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  discountBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: '#FF4757',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Poppins-Bold',
  },
  productDetails: {
    padding: 12,
  },
  productTitle: {
    fontSize: 14,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    height: 40,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  price: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#075E54',
  },
  discountedPrice: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#FF4757',
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    marginLeft: 6,
    textDecorationLine: 'line-through',
    fontFamily: 'Poppins-Regular',
  },
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starIcon: {
    marginRight: 2,
  },
  ratingText: {
    fontSize: 11,
    marginLeft: 5,
    color: '#666',
    fontFamily: 'Poppins-Medium',
  },
  creatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '50%',
  },
  creatorAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#eee',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default MarketplaceScreen;