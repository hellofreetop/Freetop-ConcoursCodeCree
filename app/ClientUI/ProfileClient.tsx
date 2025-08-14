import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  StatusBar, 
  TouchableOpacity, 
  ScrollView, 
  RefreshControl, 
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import cover from '../../assets/cover.jpg';

const { width } = Dimensions.get('window');

const ClientProfile = () => {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState({
    opportunities: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('about');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const scrollViewRef = useRef();

  const fetchUserData = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        console.error('Aucun userId trouvé dans le storage');
        return;
      }

      // Charger le profil utilisateur avec ses opportunités ET les données utilisateur associées à chaque opportunité
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          opportunities:opportunities!user_id (
            *,
            user:profiles!opportunities_user_id_fkey (
              id,
              full_name,
              photo_url
            )
          )
        `)
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      setUserData({
        ...profileData,
        opportunities: profileData.opportunities || []
      });
    } catch (error) {
      console.error('Erreur lors du chargement du profil:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du profil');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchUserData();
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleMenuProfile = () => {
    navigation.navigate('ProfileMenu', { userData: userData });
  };

  const handleDeleteOpportunity = async () => {
    try {
      const { error } = await supabase
        .from('opportunities')
        .delete()
        .eq('id', selectedOpportunity.id);
      
      if (error) throw error;
      
      setUserData(prev => ({
        ...prev,
        opportunities: prev.opportunities.filter(opp => opp.id !== selectedOpportunity.id)
      }));
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Erreur suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer cette opportunité');
    }
  };

  const handleEditOpportunity = (opportunity) => {
    navigation.navigate('CreateOpportunity', { 
      opportunity,
      onSave: (updatedOpp) => {
        setUserData(prev => ({
          ...prev,
          opportunities: prev.opportunities.map(opp => 
            opp.id === updatedOpp.id ? updatedOpp : opp
          )
        }));
      }
    });
  };

  const openDeleteConfirmation = (opportunity) => {
    setSelectedOpportunity(opportunity);
    setShowDeleteModal(true);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      
      {/* Header fixe */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <Text style={styles.headerName} numberOfLines={1}>
          {userData?.full_name || 'Profil'}
        </Text>
        
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={handleMenuProfile}
          >
            <Ionicons name="menu" size={20} color="#000000" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton} 
            onPress={() => navigation.navigate('SettingsClient')}
          >
            <Ionicons name="settings-outline" size={20} color="#000000" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView
        ref={scrollViewRef}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#075E54']}
            progressViewOffset={100}
          />
        }
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[2]}
      >
        {/* Photo de couverture */}
        <View style={styles.coverContainer}>
          <Image 
            source={cover} 
            style={styles.coverImage}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0, 0, 0, 0.65)']}
            style={styles.coverGradient}
          />
          
          {/* Photo de profil */}
          <View style={styles.profileImageContainer}>
            {userData?.photo_url ? (
              <Image 
                source={{ uri: userData.photo_url }} 
                style={styles.profileImage} 
              />
            ) : (
             <Image
                       source={require('../../assets/default-avatar.png')}
                       style={[styles.profileImage]}
                     />
            )}
          </View>
        </View>
        
        {/* Nom et profession sous la photo */}
        <View style={styles.profileInfoContainer}>
          <Text style={styles.fullName}>{userData?.full_name || 'Nom Complet'}</Text>
          <Text style={styles.description}>{userData?.description || 'Ajouter une description'}</Text>
        </View>
        
        {/* Onglets collants */}
        <View style={styles.tabsContainer}>
          <View style={styles.tabsInnerContainer}>
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'about' && styles.activeTab,
                activeTab === 'about' && styles.activeTabLeft
              ]}
              onPress={() => setActiveTab('about')}
            >
              <Text style={[styles.tabText, activeTab === 'about' && styles.activeTabText]}>À propos</Text>
              {activeTab === 'about' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.tab, 
                activeTab === 'opportunities' && styles.activeTab,
                activeTab === 'opportunities' && styles.activeTabRight
              ]}
              onPress={() => setActiveTab('opportunities')}
            >
              <Text style={[styles.tabText, activeTab === 'opportunities' && styles.activeTabText]}>Opportunités</Text>
              {activeTab === 'opportunities' && <View style={styles.activeTabIndicator} />}
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Contenu des onglets */}
        <View style={styles.tabContent}>
          {activeTab === 'about' ? (
            <AboutTab userData={userData} />
          ) : (
            <OpportunitiesTab 
              opportunities={userData.opportunities || []}
              onEdit={handleEditOpportunity}
              onDelete={openDeleteConfirmation}
            />
          )}
        </View>
      </ScrollView>

      {/* Modal de confirmation de suppression */}
      <Modal
        transparent={true}
        animationType="fade"
        visible={showDeleteModal}
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Confirmer la suppression</Text>
            <Text style={styles.modalText}>
              Êtes-vous sûr de vouloir supprimer l'opportunité "{selectedOpportunity?.title}" ?
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowDeleteModal(false)}
              >
                <Text style={styles.cancelButtonText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.deleteButton]}
                onPress={handleDeleteOpportunity}
              >
                <Ionicons name="trash-outline" size={18} color="#FFF" />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Composant pour l'onglet À propos
const AboutTab = ({ userData }) => {
  return (
    <View style={styles.aboutContainer}>
      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Ionicons name="information-circle" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.profession || 'Non renseignée'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="home" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.address || 'Non renseignée'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="call" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.phone || 'Non renseigné'}</Text>
          </View>
        </View>
        
        <View style={styles.infoItem}>
          <Ionicons name="mail" size={18} color="#0000008b" style={styles.infoIcon} />
          <View>
            <Text style={styles.infoValue}>{userData?.email || 'Non renseigné'}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Composant pour l'onglet Opportunités
const OpportunitiesTab = ({ opportunities, onEdit, onDelete }) => {
  
  if (opportunities.length === 0) {
    return (
      <View style={styles.noOpportunities}>
        <Ionicons name="briefcase-outline" size={40} color="#CBD5E0" />
        <Text style={styles.noOpportunitiesText}>Aucune opportunité publiée</Text>
        <Text style={styles.noOpportunitiesSubText}>Publiez votre première opportunité</Text>
      </View>
    );
  }

  return (
    <View style={styles.opportunitiesContainer}>
      {opportunities.map(opp => (
        <View key={opp.id} style={styles.opportunityCard}>
          <View style={styles.oppHeader}>
            <View style={styles.oppUserInfo}>
              {opp.user?.photo_url ? (
                <Image 
                  source={{ uri: opp.user.photo_url }} 
                  style={styles.oppAvatar} 
                />
              ) : (
                <View style={[styles.oppAvatar, styles.oppAvatarPlaceholder]}>
                  <Ionicons name="person" size={20} color="white" />
                </View>
              )}
              <View>
                <Text style={styles.oppUserName}>{opp.user?.full_name || userData?.full_name || 'Anonyme'}</Text>
                <Text style={styles.oppTime}>Publié le {new Date(opp.created_at).toLocaleDateString()}</Text>
              </View>
            </View>
            
            <View style={styles.oppActions}>
              <TouchableOpacity 
                style={styles.oppActionButton}
                onPress={() => onEdit(opp)}
              >
                <Ionicons name="create-outline" size={20} color="#075E54" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.oppActionButton}
                onPress={() => onDelete(opp)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.oppTitle}>{opp.title}</Text>
          <Text style={styles.oppDesc}>
            {opp.description}
          </Text>
          
          <View style={styles.oppMetaContainer}>
            <View style={styles.oppMetaItem}>
              <Ionicons name="cash-outline" size={16} color="#075E54" />
              <Text style={styles.oppMetaText}>
                Budget: {opp.price_min}Fcfa - {opp.price_max}Fcfa
              </Text>
            </View>
            
            <View style={styles.oppMetaItem}>
              <Ionicons name="briefcase-outline" size={16} color="#075E54" />
              <Text style={styles.oppMetaText}>
                {opp.professions?.join(', ')}
              </Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    padding: 15,
    paddingTop: 10,
    backgroundColor: '#ffffff',
    position: 'relative',
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 5,
  },
  headerName: {
    flex: 1,
    fontSize: 18,
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
    marginHorizontal: 10,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  editButton: {
    padding: 8,
  },
  coverContainer: {
    height: 100,
    width: '100%',
    position: 'relative',
    marginBottom: 80,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '50%',
  },
  profileImageContainer: {
    position: 'absolute',
    bottom: -40,
    left: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  profileImagePlaceholder: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfoContainer: {
    paddingHorizontal: 20,
    alignItems: 'flex-start',
    marginBottom: 20,
    marginTop: -30,
  },
  fullName: {
    fontSize: 22,
    color: '#1A202C',
    fontFamily: 'Poppins-Bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 16,
    color: '#0000008b',
    marginBottom: 5,
    fontFamily: 'Poppins-Regular',
  },
  tabsContainer: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsInnerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginHorizontal: 20,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    position: 'relative',
  },
  activeTab: {
    backgroundColor: '#ffffff',
  },
  activeTabLeft: {
    borderTopLeftRadius: 8,
  },
  activeTabRight: {
    borderTopRightRadius: 8,
  },
  tabText: {
    fontSize: 16,
    color: '#718096',
    fontFamily: 'Poppins-Medium',
  },
  activeTabText: {
    color: '#075E54',
    fontFamily: 'Poppins-SemiBold',
  },
  activeTabIndicator: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    width: '100%',
    backgroundColor: '#075E54',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  tabContent: {
    flex: 1,
    paddingBottom: 30,
  },
  aboutContainer: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  infoSection: {
    marginTop: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIcon: {
    marginRight: 15,
  },
  infoValue: {
    fontSize: 16,
    color: '#2D3748',
    fontFamily: 'Poppins-Regular',
  },
  opportunitiesContainer: {
    paddingBottom: 30,
  },
  noOpportunities: {
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 40,
  },
  noOpportunitiesText: {
    textAlign: 'center',
    color: '#2D3748',
    fontFamily: 'Poppins-Medium',
    marginTop: 15,
    fontSize: 16,
  },
  noOpportunitiesSubText: {
    textAlign: 'center',
    color: '#718096',
    fontFamily: 'Poppins-Regular',
    marginTop: 5,
    fontSize: 14,
  },
  opportunityCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    padding: 16,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  oppHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  oppUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oppAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  oppAvatarPlaceholder: {
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
  },
  oppUserName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 15,
    color: '#2D3748',
  },
  oppTime: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    color: '#718096',
    marginTop: 2,
  },
  oppActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  oppActionButton: {
    padding: 8,
    marginLeft: 10,
  },
  oppTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#1A202C',
    marginBottom: 8,
  },
  oppDesc: {
    fontFamily: 'Poppins-Regular',
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    marginBottom: 12,
  },
  oppMetaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  oppMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
    marginBottom: 8,
  },
  oppMetaText: {
    fontFamily: 'Poppins-Regular',
    fontSize: 14,
    color: '#4A5568',
    marginLeft: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#1A202C',
    marginBottom: 15,
  },
  modalText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#4A5568',
    marginBottom: 25,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  cancelButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#4A5568',
  },
  deleteButtonText: {
    fontFamily: 'Poppins-Medium',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

export default ClientProfile;