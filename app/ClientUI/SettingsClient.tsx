import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  Image, 
  Alert, 
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomNavigationBar from './BottomNavigationBar';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SettingsClient = () => {
  const navigation = useNavigation();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setUserData(data);
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const getInitial = () => {
    return userData?.full_name ? userData.full_name.charAt(0).toUpperCase() : 'C';
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Suppression du compte',
      'Êtes-vous sûr de vouloir supprimer définitivement votre compte ? Cette action est irréversible.',
      [
        {
          text: 'Annuler',
          style: 'cancel',
        },
        {
          text: 'Supprimer',
          onPress: confirmDeleteAccount,
          style: 'destructive',
        },
      ]
    );
  };

  const confirmDeleteAccount = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) throw new Error('User not found');

      // 1. Supprimer les discussions associées
      const { error: discussionsError } = await supabase
        .from('discussions')
        .delete()
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);

      if (discussionsError) throw discussionsError;

      // 2. Supprimer les messages associés
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);

      if (messagesError) throw messagesError;

      // 3. Supprimer la photo de profil
      if (userData?.photo_url) {
        const { error: photoError } = await supabase.storage
          .from('profile-photos')
          .remove([userId]);

        if (photoError) console.error('Error deleting profile photo:', photoError);
      }

      // 4. Supprimer les favoris associés
      const { error: favoritesError } = await supabase
        .from('user_favorites')
        .delete()
        .or(`user_id.eq.${userId},favorite_user_id.eq.${userId}`);

      if (favoritesError) throw favoritesError;

      // 5. Supprimer de la table profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      if (profileError) throw profileError;

      // 6. Vider le storage et rediriger
      await AsyncStorage.removeItem('userId');
      navigation.replace('Auth');
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la suppression du compte');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;

      // Mettre à jour le statut online_mark
      const { error } = await supabase
        .from('profiles')
        .update({ online_mark: false })
        .eq('id', userId);

      if (error) throw error;

      // Déconnecter l'utilisateur
      await AsyncStorage.removeItem('userId');
      navigation.replace('AccountSelection');
    } catch (error) {
      console.error('Error logging out:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la déconnexion');
    }
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile', { userData: userData });
  };

  return (
    <View style={styles.container}>
      <View style={styles.appBar}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        <Image source={userData?.photo_url ? { uri: userData.photo_url } : require('../../assets/default-avatar.png')} style={styles.profileImage} /> 
        <Text style={styles.profileName} numberOfLines={1}>
          {userData?.full_name || ''}
        </Text>
        <TouchableOpacity>
          <Ionicons name="checkmark" size={25} color="#075E54" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section Informations */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-circle" size={20} color="#075E54" />
            <Text style={styles.cardTitle}>Informations du compte</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Type de compte:</Text>
            <Text style={styles.infoValue}>{userData?.type_compte || ''}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Téléphone:</Text>
            <Text style={styles.infoValue}>{userData?.phone || ''}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Statut:</Text>
            <Text style={styles.infoValue}>
              {userData?.online_mark ? 'En ligne' : ''}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleEditProfile}
          >
            <Text style={styles.editButtonText}>Modifier le profil</Text>
          </TouchableOpacity>
        </View>

        {/* Carte Déconnexion */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="log-out" size={20} color="#718096" />
            <Text style={styles.cardTitle}>Se déconnecter</Text>
          </View>
          <Text style={styles.cardText}>
            Vous serez marqué comme hors ligne et pourrez vous reconnecter ultérieurement.
          </Text>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Text style={styles.buttonText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Carte Suppression de compte 
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="trash-bin" size={20} color="#E53E3E" />
            <Text style={styles.cardTitle}>Supprimer le compte</Text>
          </View>
          <Text style={styles.cardText}>
            Cette action supprimera définitivement votre compte, vos discussions et toutes vos données.
          </Text>
          <TouchableOpacity 
            style={styles.dangerButton}
            onPress={handleDeleteAccount}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Supprimer mon compte</Text>
            )}
          </TouchableOpacity>
        </View>*/}

         <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Image source={require('../../assets/adaptive-icon-black.png')} style={{ width: 50, height: 50 }} />
            <Text style={styles.cardTitle}>Freetop (version 1.0.0)</Text>
          </View>
          <Text style={styles.cardText}>
            Nom du développeur: Charbel Degbogbahoun
          </Text>
         <TouchableOpacity 
            style={styles.logoutButton}
            onPress={() => navigation.navigate('ReportIssue')}
          >
            <Text style={styles.buttonText}>
              Signaler un problème</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

    </View>
  );
};

// Les styles restent identiques à votre version précédente
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 80,
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 25,
    marginRight: 16,
  },
  profileInitial: {
    width: 40,
    height: 40,
    borderRadius: 25,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  initialText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  profileName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: '#2D3748',
    marginRight: 8,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
   
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2D3748',
    marginLeft: 8,
  },
  cardText: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 16,
    lineHeight: 20,
    fontFamily: 'Trebuchet MS',

  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  infoLabel: {
    fontSize: 14,
    color: '#718096',
    fontWeight: '600',
  },
  infoValue: {
    fontSize: 14,
    color: '#2D3748',
  },
  editButton: {
    marginTop: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#075E54',
    alignItems: 'center',
  },
  editButtonText: {
    color: '#075E54',
    fontWeight: '600',
  },
  logoutButton: {
    backgroundColor: '#718096',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#E53E3E',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});

export default SettingsClient;