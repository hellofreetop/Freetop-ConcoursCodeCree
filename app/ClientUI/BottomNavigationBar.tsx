import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Image, 
  Animated, 
  Easing,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import * as Font from 'expo-font';

// Importez vos écrans
import HomeScreen from './ClientHome';
import SearchScreen from './MessagerieClient';
import ClientProfile from './ProfileClient';
import PrestataireProfile from '../PrestataireUI/ProfilePrestataire';
import MarketplaceScreen from '../Marketplace/MarketplaceScreen';

const { width } = Dimensions.get('window');
const Tab = createBottomTabNavigator();

// Charger les polices
async function loadFonts() {
  await Font.loadAsync({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
  });
}

function ProfileAvatar({ navigation }) {
  const [photoUrl, setPhotoUrl] = useState(null);
  const [userId, setUserId] = useState(null);
  const [accountType, setAccountType] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      const id = await AsyncStorage.getItem('userId');
      if (!id) return;
      setUserId(id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('photo_url, type_compte')
        .eq('id', id)
        .single();
        
      if (!error && data) {
        setPhotoUrl(data.photo_url);
        setAccountType(data.type_compte);
      }
    };
    fetchProfile();
  }, []);

  return (
    <TouchableOpacity
      style={styles.avatarTab}
      onPress={() => navigation.navigate('Profil', { 
        userId,
        profileType: accountType 
      })}
    >
      {photoUrl ? (
        <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
      ) : (
        <Image source={require('../../assets/default-avatar.png')} style={styles.avatarImage} />
      )}
    </TouchableOpacity>
  );
}

const AddMenu = ({ visible, onClose, navigation }) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const [accountType, setAccountType] = useState('');

  useEffect(() => {
    const fetchAccountType = async () => {
      const type = await AsyncStorage.getItem('accountType');
      setAccountType(type);
    };
    fetchAccountType();
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: visible ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: visible ? 1 : 0.8,
        friction: 6,
        useNativeDriver: true,
      })
    ]).start();
  }, [visible]);

  if (!visible && opacityAnim.__getValue() === 0) return null;

  const handleCreateOpportunity = () => {
    onClose();
    navigation.navigate('CreateOpportunity');
  };

  const handleCreateCollection = () => {
    onClose();
    navigation.navigate('AddCollection');
  };

  const handleCreateSpecialCollection = () => {
    onClose();
    navigation.navigate('AddSpecialCollection');
  };

  return (
    <>
      <Animated.View 
        style={[
          styles.overlay,
          { opacity: opacityAnim }
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity 
          style={StyleSheet.absoluteFill} 
          activeOpacity={1}
          onPress={onClose}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.addMenu,
          { 
            opacity: opacityAnim,
            transform: [{ scale: scaleAnim }]
          }
        ]}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        {accountType === 'Client' && (
          <TouchableOpacity 
            style={styles.menuItem}
            onPress={handleCreateOpportunity}
          >
            <View style={styles.menuIcon}>
              <MaterialIcons name="post-add" size={24} color="#075E54" />
            </View>
            <Text style={styles.menuText}>Nouvelle opportunité</Text>
          </TouchableOpacity>
        )}
        
        {accountType === 'Prestataire' && (
          <>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleCreateCollection}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="albums" size={24} color="#075E54" />
              </View>
              <Text style={styles.menuText}>Nouvelle collection</Text>
            </TouchableOpacity>
            
            <View style={styles.separator} />
            
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={handleCreateSpecialCollection}
            >
              <View style={styles.menuIcon}>
                <Ionicons name="sparkles" size={24} color="#075E54" />
              </View>
              <Text style={styles.menuText}>Collection spéciale</Text>
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </>
  );
};

const BottomTabNavigator = () => {
  const [addVisible, setAddVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [marketplaceBadge, setMarketplaceBadge] = useState(false);
  const [accountType, setAccountType] = useState('');
  const [fontsLoaded, setFontsLoaded] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
  }, []);

  useEffect(() => {
    const fetchAccountType = async () => {
      const type = await AsyncStorage.getItem('accountType');
      setAccountType(type);
    };
    fetchAccountType();
  }, []);

  useEffect(() => {
    const fetchUnreadMessages = async () => {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const q = query(
        collection(db, 'discussions'),
        where('participants', 'array-contains', userId)
      );

      const unsubscribe = onSnapshot(q, async (snapshot) => {
        let totalUnread = 0;
        
        await Promise.all(
          snapshot.docs.map(async (doc) => {
            const data = doc.data();
            const otherUserId = data.participants.find(id => id !== userId);
            
            const messagesQuery = query(
              collection(db, 'discussions', doc.id, 'messages'),
              where('sender_id', '==', otherUserId),
              where('is_read', '==', false)
            );
            
            const messagesSnapshot = await getDocs(messagesQuery);
            totalUnread += messagesSnapshot.size;
          })
        );
        
        setUnreadCount(totalUnread);
      });

      return () => unsubscribe();
    };

    fetchUnreadMessages();

    // Simuler un badge pour marketplace (à remplacer par votre logique réelle)
    setMarketplaceBadge(true);
  }, []);

  const renderMessengerIcon = ({ focused, color, size }) => {
    return (
      <View style={styles.iconContainer}>
        <Ionicons 
          name={focused ? 'chatbubbles' : 'chatbubbles-outline'} 
          size={size} 
          color={color} 
        />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </Text>
          </View>
        )}
      </View>
    );
  };

  const renderMarketplaceIcon = ({ focused, color, size }) => {
    return (
      <View style={styles.iconContainer}>
        <Ionicons 
          name={focused ? 'storefront' : 'storefront-outline'} 
          size={size} 
          color={color} 
        />
        {marketplaceBadge && (
          <View style={[styles.badge, { width: 12, height: 12 }]}>
          </View>
        )}
      </View>
    );
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            if (route.name === 'Créer') {
              return (
                <Feather 
                  name={focused ? 'plus-square' : 'plus-square'} 
                  size={28} 
                  color={focused ? '#075E54' : '#888'} 
                />
              );
            }
            if (route.name === 'Profil') {
              return <ProfileAvatar navigation={navigation} />;
            }
            if (route.name === 'Messagerie') {
              return renderMessengerIcon({ focused, color, size });
            }
            if (route.name === 'Marketplace') {
              return renderMarketplaceIcon({ focused, color, size });
            }
            return <Ionicons 
              name={focused ? 'home' : 'home-outline'} 
              size={size} 
              color={color} 
            />;
          },
          tabBarLabel: ({ focused, color }) => {
            let label;
            if (route.name === 'Accueil') label = 'Accueil';
            else if (route.name === 'Messagerie') label = 'Messagerie';
            else if (route.name === 'Marketplace') label = 'Marketplace';
            else if (route.name === 'Profil') label = 'Profil';
            else if (route.name === 'Créer') label = 'Créer';
            
            return (
              <Text 
                style={[
                  styles.tabLabel,
                  { 
                    color: focused ? '#075E54' : '#888',
                    fontFamily: focused ? 'Poppins-SemiBold' : 'Poppins-Regular'
                  }
                ]}
              >
                {label}
              </Text>
            );
          },
          tabBarActiveTintColor: '#075E54',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            height: Platform.OS === 'ios' ? 85 : 55,
            paddingBottom: Platform.OS === 'ios' ? 15 : 10,
            borderTopWidth: 0,
            backgroundColor: '#fff',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 8,
          },
          headerShown: false,
        })}
      >
        <Tab.Screen name="Accueil" component={HomeScreen} />
        <Tab.Screen name="Messagerie" component={SearchScreen} />
        <Tab.Screen
          name="Créer"
          component={View}
          listeners={{
            tabPress: e => {
              e.preventDefault();
              setAddVisible(true);
            },
          }}
        />
        <Tab.Screen name="Marketplace" component={MarketplaceScreen} />
        <Tab.Screen 
          name="Profil" 
          component={accountType === 'Client' ? ClientProfile : PrestataireProfile}
        />
      </Tab.Navigator>

      <AddMenu
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        navigation={navigation}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  tabLabel: {
    fontSize: 10,
    marginBottom: Platform.OS === 'ios' ? 0 : 5,
  },
  avatarTab: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  avatarImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    zIndex: 98,
  },
  addMenu: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: width * 0.1,
    right: width * 0.1,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 99,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 20,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 135, 81, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuText: {
    fontSize: 16,
    color: '#262626',
    fontFamily: 'Poppins-Regular',
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 16,
    marginVertical: 4,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    right: -5,
    top: -3,
    backgroundColor: '#FF3B30',
    borderRadius: 9,
    width: 17,
    height: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});

export default BottomTabNavigator;