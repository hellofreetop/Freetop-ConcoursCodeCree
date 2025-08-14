import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as LocalAuthentication from 'expo-local-authentication';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import 'react-native-gesture-handler';  
import Toast from 'react-native-toast-message';
import { View, Text, TouchableOpacity, Image, StyleSheet, ActivityIndicator, StatusBar, TextInput, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { supabase } from './lib/supabase';
import AccountTypeScreen from './app/AccountTypeScreen';
import AddCollectionScreen from './app/PrestataireUI/AddCollectionScreen';
import EditProfile from './app/PrestataireUI/EditProfile';
import ChatScreen from './app/PrestataireUI/ChatScreen';
import CollectionDetailScreen from './app/PrestataireUI/CollectionDetailScreen';
import CollectionsScreen  from './app/PrestataireUI/CollectionsScreen';
import Profile  from './app/PrestataireUI/ProfilePrestataire';
import SettingsClient from './app/ClientUI/SettingsClient';
import UserCollectionDetail from './app/PrestataireUI/UserCollectionDetail';
import UserCollectionsScreen from './app/PrestataireUI/UserCollectionsScreen';
import ClientHome from './app/ClientUI/ClientHome';
import CreateOpportunity from './app/ClientUI/CreateOpportunity' 
import ProfileView from './app/ClientUI/ProfileView';
import UserReviews from './app/ClientUI/UserReviews';
import MessagerieClient from './app/ClientUI/MessagerieClient';
import AccessKeyAuth from './app/AccessKeyAuth';
import SwitchAccountScreen from './app/SwitchAccountScreen';
import BottomTabNavigator from './app/ClientUI/BottomNavigationBar';
import PrestataireOnboarding from './app/PrestataireUI/PrestataireOnboarding';
import SelectClient from './app/PrestataireUI/SelectClient';
import AddAvailability from './app/PrestataireUI/AddAvailability';
import PrestataireCalendar from './app/PrestataireUI/PrestataireCalendar';
import DayView from './app/PrestataireUI/DayView';
import ClientReservation from './app/PrestataireUI/ClientReservation';
import PendingReservations from './app/PrestataireUI/PendingReservations';


import AddScreen from './app/ClientUI/AddScreen';
import Favoris from './app/ClientUI/Favoris';
import ReportIssueScreen from './app/ClientUI/ReportIssue';
import ClientOnboarding from './app/ClientUI/ClientOnboarding';
import SearchScreen from './app/ClientUI/SearchScreen';
import ProfileMenuScreen from './app/ClientUI/ProfileMenuScreen';
import ProfessionalProfileScreen from './app/ClientUI/ProfessionalProfileScreen';
import PrestataireListScreen from './app/ClientUI/PrestataireListScreen';
import MarketplaceScreen from './app/Marketplace/MarketplaceScreen';
import AddProductScreen from './app/Marketplace/AddProductScreen';
import ViewProductScreen from './app/Marketplace/ViewProductScreen';
import SearchProductScreen from './app/Marketplace/SearchProductScreen';
import MessagerieMarketplaceScreen from './app/Marketplace/MessagerieMarketplaceScreen';
import ChatMarketplaceScreen from './app/Marketplace/ChatMarketplaceScreen';

import { LinearGradient } from 'expo-linear-gradient';

import * as Notifications from 'expo-notifications';

const appIcon = require('./assets/Freetop.png');
const defaultAvatar = require('./assets/default-avatar.png');
const onboardingImage = require('./assets/onboarding-bg.webp');


function IntroductionScreen({ navigation }) {
  const { width, height } = Dimensions.get('window');
  const imageHeight = height * 0.6;
  
  return (
    <View style={styles.introContainer}>
      <StatusBar translucent backgroundColor="#F9F9F9" barStyle="dark-content" />
    
      <Image 
        source={onboardingImage} 
        style={[styles.introImage, { height: imageHeight }]}
        resizeMode="cover"
      />
      
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.2)', 'rgba(255,255,255,0.8)', 'white']}
        locations={[0, 0.5, 0.8, 1]}
        style={[styles.gradientOverlay, { top: imageHeight - 100 }]}
      />
      
      <View style={[styles.introContent, { marginTop: imageHeight - 40 }]}>
        <Text style={styles.introTitle}>Freetop, trouvez ou proposez des services</Text>
        
        <View style={styles.subtitleContainer}>
          <Text style={styles.introSubtitle}>
            Une plateforme pensée pour valoriser le savoir-faire local et créer des connexions durables entre talents et besoins
          </Text>
          <Ionicons 
            name="arrow-forward" 
            size={24} 
            color="#075E54" 
            style={{ transform: [{ rotate: '30deg' }], marginLeft: 10 }} 
          />
        </View>
        
        <TouchableOpacity 
          style={styles.startButton}
          onPress={() => navigation.replace('AccountSelection')}
        >
          <Text style={styles.startButtonText}>Commencer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function LoadingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  
  React.useEffect(() => {
    const checkUser = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        
        if (!userId) {
          return navigation.replace('Introduction');
        }

        // Vérifier si le profil existe dans Supabase
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('last_login, type_compte')
          .eq('id', userId)
          .single();

        if (error || !profile) {
          await AsyncStorage.removeItem('userId');
          return navigation.replace('Introduction');
        }

        // Mettre à jour la dernière connexion et le statut en ligne
        await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            online_mark: true 
          })
          .eq('id', userId);

        // Rediriger vers l'écran approprié en fonction du type de compte
          navigation.replace('ClientHome');
       
      } catch (error) {
        console.error('Erreur vérification:', error);
        navigation.replace('Introduction');
      }
    };

    checkUser();
  }, []);

  return (
    <View style={[
      styles.loadingContainer,
      Platform.OS === 'android' && { 
        paddingBottom: insets.bottom 
      }
    ]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <ActivityIndicator size="large" color="#075E54" />
    </View>
  );
}

function AccountSelectionScreen({ navigation, route }) {
  const [profile, setProfile] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const userId = route.params?.userId || null;
  const insets = useSafeAreaInsets();

  React.useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, photo_url, email, type_compte')
          .eq('id', userId)
          .single();

        if (!error && data) {
          setProfile(data);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const handleAuth = async () => {
    try {
      const { success } = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authentification Freetop',
        cancelLabel: 'Annuler',
        fallbackLabel: 'Utiliser la clé d\'accès'
      });

      if (success && profile?.type_compte) {
        await supabase
          .from('profiles')
          .update({ 
            last_login: new Date().toISOString(),
            online_mark: true 
          })
          .eq('id', userId);

        navigation.replace('ClientHome');
      }
    } catch (error) {
      console.error('Erreur auth:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
              <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={[
      styles.selectionContainer,
      Platform.OS === 'android' && { 
        paddingBottom: insets.bottom 
      }
    ]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <Image source={appIcon} style={styles.logo} />
      </View>

      <View style={styles.profileSection}>
        <Image 
          source={profile?.photo_url ? { uri: profile.photo_url } : defaultAvatar}
          style={styles.avatar}
        />
        <Text style={styles.name}>{profile?.full_name || 'Utilisateur Freetop'}</Text>
        <Text style={styles.email}>{profile?.email || ''}</Text>
      </View>

      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuItem} onPress={handleAuth}>
          <Ionicons name="finger-print" size={24} color="#000" />
          <Text style={styles.menuText}>Freetop Authentification</Text>
        </TouchableOpacity>
        <View style={styles.separator} />

        <TouchableOpacity 
          style={styles.menuItem} 
          onPress={() => navigation.navigate('AccessKeyAuth')}
        >
          <Ionicons name="key-outline" size={24} color="#000" />
          <Text style={styles.menuText}>Connexion par clé d'accès</Text>
        </TouchableOpacity>
        <View style={styles.separator} />

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('SwitchAccount')}>
          <Ionicons name="sync" size={24} color="#000" />
          <Text style={styles.menuText}>Changer de compte</Text>
        </TouchableOpacity>
        <View style={styles.separator} />

        <TouchableOpacity style={styles.menuItem} onPress={() => navigation.navigate('ClientOnboarding')}>
          <Ionicons name="person-add-outline" size={24} color="#000" />
          <Text style={styles.menuText}>Ouvrir un compte</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const Stack = createNativeStackNavigator();

function CustomLoading() {
  return (
    <View style={styles.customLoadingContainer}>
      <ActivityIndicator size="large" color="#075E54" />
      <Text style={styles.customLoadingText}>Chargement...</Text>
    </View>
  );
}

export default function App() {
  const [isReady, setIsReady] = React.useState(false);
  const [initialRoute, setInitialRoute] = React.useState('Loading');

  let [fontsLoaded] = useFonts({
    'Poppins-Bold': require('./assets/fonts/Poppins-Bold.ttf'),
    'Poppins-SemiBold': require('./assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Medium': require('./assets/fonts/Poppins-Medium.ttf'),
    'Poppins-Regular': require('./assets/fonts/Poppins-Regular.ttf'),
  });

  React.useEffect(() => {
    const prepare = async () => {
      try {
        // Vérifier si l'utilisateur est déjà connecté
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setInitialRoute('Loading');
        } else {
          setInitialRoute('Introduction');
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsReady(true);
      }
    };

    prepare();
  }, []);

  if (!fontsLoaded || !isReady) {
    return <CustomLoading />;
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safeArea}>
        <NavigationContainer>
          <Stack.Navigator 
            initialRouteName={initialRoute}
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Introduction" component={IntroductionScreen} />
            <Stack.Screen name="Loading" component={LoadingScreen} />
            <Stack.Screen name="AccountSelection" component={AccountSelectionScreen} />
            <Stack.Screen name="SwitchAccount" component={SwitchAccountScreen} />
            <Stack.Screen name="AccountType" component={AccountTypeScreen} />
            <Stack.Screen name="AccessKeyAuth" component={AccessKeyAuth} />
            <Stack.Screen name="AddCollection" component={AddCollectionScreen} />
            <Stack.Screen name="EditProfile" component={EditProfile} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="SearchScreen" component={SearchScreen} />
            <Stack.Screen name="CreateOpportunity" component={CreateOpportunity} /> 
            <Stack.Screen name="CollectionDetail" component={CollectionDetailScreen} />
            <Stack.Screen name="Collections" component={CollectionsScreen} />
            <Stack.Screen name="Profile" component={Profile} />
            <Stack.Screen name="SettingsClient" component={SettingsClient} />
            <Stack.Screen name="UserCollectionDetail" component={UserCollectionDetail} />
            <Stack.Screen name="UserCollections" component={UserCollectionsScreen} />
            <Stack.Screen name="UserReviews" component={UserReviews} />
            <Stack.Screen name="Favoris" component={Favoris} />
            <Stack.Screen name="ProfileView" component={ProfileView} />
            <Stack.Screen name="MessagerieClient" component={MessagerieClient} />
            <Stack.Screen name="ReportIssue" component={ReportIssueScreen} />
            <Stack.Screen name="ClientOnboarding" component={ClientOnboarding} />
            <Stack.Screen name="ProfileMenu" component={ProfileMenuScreen} />
            <Stack.Screen name="ProfessionalProfile" component={ProfessionalProfileScreen} />
            <Stack.Screen name="PrestataireOnboarding" component={PrestataireOnboarding} />
            <Stack.Screen name="SelectClient" component={SelectClient} />
            <Stack.Screen name="AddAvailability" component={AddAvailability} />
            <Stack.Screen name="PrestataireCalendar" component={PrestataireCalendar} />
            <Stack.Screen name="DayView" component={DayView} />
                        <Stack.Screen name="PendingReservations" component={PendingReservations} />
                                    <Stack.Screen name="ClientReservation" component={ClientReservation} />



            <Stack.Screen name="PrestataireListScreen" component={PrestataireListScreen} />
            <Stack.Screen name="AddProduct" component={AddProductScreen} />
            <Stack.Screen name="MarketplaceMain" component={MarketplaceScreen} />
            <Stack.Screen name="ViewProduct" component={ViewProductScreen} />
            <Stack.Screen name="SearchProduct" component={SearchProductScreen} />
            <Stack.Screen name="MessagerieMarketplace" component={MessagerieMarketplaceScreen} />
            <Stack.Screen name="ChatMarketplace" component={ChatMarketplaceScreen} />
            <Stack.Screen name="ClientHome" component={BottomTabNavigator} />
            <Stack.Screen name="AddScreen" component={AddScreen} />            
          </Stack.Navigator>
          <Toast />
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  introContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  introImage: {
    width: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  gradientOverlay: {
    position: 'absolute',
    height: 100,
    width: '100%',
    left: 0,
    right: 0,
  },
  introContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  introTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 28,
    color: '#000',
    marginBottom: 16,
    textAlign: 'left',
    lineHeight: 34,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  introSubtitle: {
    fontFamily: 'Poppins-Regular',
    fontSize: 16,
    color: '#666',
    flex: 1,
    marginRight: 10,
    lineHeight: 24,
  },
  startButton: {
    backgroundColor: '#075E54',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 56,
  },
  startButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  selectionContainer: {
    flex: 1,
    backgroundColor: '#fff'
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 10,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 5,
  },
  name: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#000',
    marginBottom: 5,
  },
  email: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Poppins-Regular'
  },
  menuContainer: {
    marginTop: 10,
    paddingHorizontal: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12
  },
  menuText: {
    fontSize: 17,
    fontFamily: 'Poppins-Medium',
    color: '#000',
    marginLeft: 16,
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginLeft: 52
  },
  customLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  customLoadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#075E54',
    fontFamily: 'Poppins-SemiBold',
  },
});