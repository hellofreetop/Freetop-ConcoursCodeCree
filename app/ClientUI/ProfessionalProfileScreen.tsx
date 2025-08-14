import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  StatusBar,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ProfessionalProfileScreen = ({ navigation, route }) => {
  const [profiles, setProfiles] = useState([]);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [accountType, setAccountType] = useState('Client');
  const [loading, setLoading] = useState(true);
  const { userData } = route.params || {};

  useEffect(() => {
    const fetchData = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        const type = await AsyncStorage.getItem('accountType');
        setCurrentUserId(userId);
        setAccountType(type || 'Client');

        // Récupérer le reference_account si c'est un prestataire
        let referenceAccount = userId;
        if (type === 'Prestataire') {
          const { data: mainProfile, error: profileError } = await supabase
            .from('profiles')
            .select('reference_account')
            .eq('id', userId)
            .single();

          if (!profileError && mainProfile?.reference_account) {
            referenceAccount = mainProfile.reference_account;
          }
        }

        // Récupérer tous les profils liés sauf le profil actuel
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, photo_url, type_compte, email')
          .or(`reference_account.eq.${referenceAccount},id.eq.${referenceAccount}`)
          .neq('id', userId); // Exclure le profil actuel

        if (!error) {
          setProfiles(data || []);
        }
      } catch (error) {
        console.error('Error fetching profiles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const profileCount = profiles.length;
  const isPrestataire = accountType === 'Prestataire';
  const maxProfilesReached = isPrestataire ? false : profileCount >= 5;
  const statusColor = maxProfilesReached ? '#4CAF50' : '#FF9800';

  const handleCreateProfile = async () => {
    const userId = await AsyncStorage.getItem('userId');
    navigation.navigate('PrestataireOnboarding', { 
      reference_account: userId 
    });
  };

  const switchProfile = async (profile) => {
    try {
      // 1. Mettre l'utilisateur actuel en offline
      await supabase
        .from('profiles')
        .update({ online_mark: false })
        .eq('id', currentUserId);

      // 2. Vider l'AsyncStorage
      await AsyncStorage.multiRemove([
        'userId',
        'userName',
        'userEmail',
        'userPhoto',
        'accountType'
      ]);

      // 3. Mettre à jour le nouveau profil
      await supabase
        .from('profiles')
        .update({ 
          online_mark: true,
          last_login: new Date().toISOString()
        })
        .eq('id', profile.id);

      // 4. Stocker les nouvelles informations
      await AsyncStorage.multiSet([
        ['userId', profile.id],
        ['userName', profile.full_name],
        ['userEmail', profile.email || ''],
        ['userPhoto', profile.photo_url || ''],
        ['accountType', profile.type_compte]
      ]);

      // 5. Redirection selon le type de compte
      const routeName = profile.type_compte === 'Client' ? 'ClientHome' : 'ClientHome';
      navigation.replace(routeName, { 
        profileData: {
          id: profile.id,
          fullName: profile.full_name,
          email: profile.email,
          photoUrl: profile.photo_url,
          typeCompte: profile.type_compte
        }
      });

    } catch (error) {
      console.error('Error switching profile:', error);
      Alert.alert('Erreur', 'Impossible de changer de profil');
    }
  };

  const renderProfileItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.profileItem}
      onPress={() => switchProfile(item)}
    >
      <Image 
        source={item.photo_url ? { uri: item.photo_url } : require('../../assets/default-avatar.png')}
        style={styles.profileAvatar}
      />
      <View style={styles.profileInfo}>
        <Text style={styles.profileName}>{item.full_name || 'Utilisateur'}</Text>
        <Text style={styles.profileType}>{item.type_compte || 'Type inconnu'}</Text>
      </View>
      <TouchableOpacity 
        style={styles.syncButton}
        onPress={() => switchProfile(item)}
      >
        <Ionicons name="sync" size={20} color="#075E54" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* App Bar */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.appBarTitle}>Profils professionnels</Text>
        <View style={styles.avatarPlaceholder} />
      </View>

      {/* Boutons horizontaux */}
      <View style={styles.tabsOuterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContainer}
        >
          {!isPrestataire && (
            <TouchableOpacity 
              style={[styles.tabButton, maxProfilesReached && styles.disabledButton]}
              disabled={maxProfilesReached}
              onPress={handleCreateProfile}
            >
              <Ionicons name="add" size={18} color={maxProfilesReached ? "#888" : "#075E54"} />
              <Text style={[styles.tabText, maxProfilesReached && styles.disabledText]}>Créer</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.tabButton} onPress={() => navigation.navigate('PrestataireListScreen')}>
            <Feather name="compass" size={18} color="#075E54" />
            <Text style={styles.tabText}>Explorer</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.tabButton} onPress={() => navigation.navigate('Favoris')}>
            <Ionicons name="heart" size={18} color="#075E54" />
            <Text style={styles.tabText}>Favoris</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Contenu principal */}
      <View style={styles.mainContent}>
        <Text style={styles.sectionTitle}>Vos profils {!isPrestataire && `(${profileCount}/5)`}</Text>
        
        {loading ? (
          <ActivityIndicator size="small" color="#075E54" style={styles.loadingIndicator} />
        ) : profiles.length > 0 ? (
          <FlatList
            data={profiles}
            renderItem={renderProfileItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.profilesList}
          />
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase" size={48} color="#ADB5BD" />
            <Text style={styles.emptyText}>Aucun autre profil disponible</Text>
            <Text style={styles.emptySubText}>
              {isPrestataire ? 'Gérés par votre compte principal' : 'Créez des profils supplémentaires'}
            </Text>
            
            {!isPrestataire && (
              <TouchableOpacity 
                style={styles.createButton}
                onPress={handleCreateProfile}
              >
                <Text style={styles.createButtonText}>+ Créer un profil</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Statut - caché pour les prestataires */}
        {!isPrestataire && (
          <View style={[styles.statusContainer, maxProfilesReached && styles.statusFull]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={styles.statusText}>
              {maxProfilesReached 
                ? 'Limite atteinte (5 profils)'
                : `${5 - profileCount} création${profileCount !== 4 ? 's' : ''} restante${profileCount !== 4 ? 's' : ''}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  backButton: {
    padding: 4
  },
  appBarTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000'
  },
  avatarPlaceholder: {
    width: 24
  },
  tabsOuterContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0'
  },
  tabsContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    height: 48
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    height: 32
  },
  disabledButton: {
    opacity: 0.6
  },
  tabText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#333333',
    marginLeft: 6
  },
  disabledText: {
    color: '#888'
  },
  mainContent: {
    flex: 1,
    padding: 16
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
    marginBottom: 16
  },
  profilesList: {
    paddingBottom: 16
  },
  profileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 15,
    fontFamily: 'Poppins-Medium',
    color: '#333333'
  },
  profileType: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#888'
  },
  syncButton: {
    padding: 8
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#666666',
    marginTop: 16,
    textAlign: 'center',
    maxWidth: '80%'
  },
  emptySubText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#ADB5BD',
    marginTop: 8,
    textAlign: 'center',
    maxWidth: '80%'
  },
  createButton: {
    backgroundColor: '#075E54',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 24
  },
  createButtonText: {
    color: '#FFF',
    fontFamily: 'Poppins-Medium',
    fontSize: 15
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FAFAFA',
    borderRadius: 8
  },
  statusFull: {
    backgroundColor: '#F0F7F1'
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666666'
  },
  loadingIndicator: {
    marginVertical: 20
  }
});

export default ProfessionalProfileScreen;