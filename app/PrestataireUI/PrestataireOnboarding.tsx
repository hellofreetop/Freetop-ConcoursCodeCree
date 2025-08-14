import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Alert, 
  TextInput,
  ScrollView,
  ActivityIndicator,
  StatusBar,
  FlatList
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

const PrestataireOnboarding = ({ navigation, route }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    profession: '',
    photo: null,
    reference_account: route.params?.reference_account || null
  });
  const [loading, setLoading] = useState(false);
  const [showProfessionSelection, setShowProfessionSelection] = useState(false);
  const [professions, setProfessions] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredProfessions, setFilteredProfessions] = useState([]);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (currentUserId && !formData.reference_account) {
        setFormData(prev => ({ ...prev, reference_account: currentUserId }));
      }
    };

    const fetchProfessions = async () => {
      const { data, error } = await supabase
        .from('metiers_artisans')
        .select('nom_metier')
        .order('nom_metier', { ascending: true });

      if (!error && data) {
        const professionNames = data.map(item => item.nom_metier);
        setProfessions(professionNames);
        setFilteredProfessions(professionNames);
      }
    };

    fetchCurrentUser();
    fetchProfessions();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProfessions(professions);
    } else {
      const filtered = professions.filter(profession =>
        profession.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredProfessions(filtered);
    }
  }, [searchQuery, professions]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData({ ...formData, photo: result.assets[0].uri });
    }
  };

  const uploadPhoto = async () => {
    if (!formData.photo) return null;
    
    const photoName = `professionnel_${Date.now()}.jpg`;
    const photoFile = {
      uri: formData.photo,
      type: 'image/jpeg',
      name: photoName
    };

    const { error } = await supabase.storage
      .from('profile-photos')
      .upload(photoName, photoFile, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) throw error;
    return supabase.storage.from('profile-photos').getPublicUrl(photoName).data.publicUrl;
  };

  const handleNextStep = () => {
    if (!formData.profession || !formData.fullName || !formData.address) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    setCurrentStep(2);
  };

  const handleSubmit = async () => {
    if (!formData.photo) {
      Alert.alert('Photo requise', 'Veuillez ajouter une photo professionnelle');
      return;
    }

    setLoading(true);
    
    try {
      const photoUrl = await uploadPhoto();
      
      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .insert({
          type_compte: 'Prestataire',
          full_name: formData.fullName,
          address: formData.address,
          profession: formData.profession,
          photo_url: photoUrl,
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
          online_mark: true,
          last_login: new Date().toISOString(),
          reference_account: formData.reference_account
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await AsyncStorage.clear();

      await AsyncStorage.multiSet([
        ['userId', insertedProfile.id],
        ['userName', insertedProfile.full_name || ''],
        ['userEmail', insertedProfile.email || ''],
        ['userPhoto', insertedProfile.photo_url || ''],
        ['accountType', 'Prestataire']
      ]);

      navigation.replace('ClientHome');

    } catch (error) {
      console.error('Erreur création compte:', error);
      Alert.alert(
        'Erreur', 
        error.message || "Erreur lors de la création du compte"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectProfession = (profession) => {
    setFormData({ ...formData, profession });
    setShowProfessionSelection(false);
  };

  const ProfessionSelectionScreen = () => (
    <View style={styles.professionSelectionContainer}>
      <View style={styles.professionHeader}>
        <TouchableOpacity onPress={() => setShowProfessionSelection(false)}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.professionTitle}>Choisir un métier</Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher un métier..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity 
              style={styles.clearButton}
              onPress={() => setSearchQuery('')}
            >
              <Ionicons name="close" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={filteredProfessions}
        keyExtractor={(item) => item}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.professionItem}
            onPress={() => handleSelectProfession(item)}
          >
            <Text style={styles.professionText}>{item}</Text>
          </TouchableOpacity>
        )}
        ListHeaderComponent={
          searchQuery.length === 0 && (
            <Text style={styles.suggestionTitle}>Suggestions</Text>
          )
        }
        contentContainerStyle={styles.professionList}
      />
    </View>
  );

  if (showProfessionSelection) {
    return <ProfessionSelectionScreen />;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Image 
          source={require('../../assets/adaptive-icon.png')} 
          style={styles.logo}
        />
        <Text style={styles.title}>
          {currentStep === 1 ? 'Informations professionnelles' : 'Photo de profil'}
        </Text>
        <Text style={styles.stepIndicator}>Étape {currentStep}/2</Text>
      </View>

      <ScrollView contentContainerStyle={styles.contentContainer}>
        {currentStep === 1 ? (
          <>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Métier *</Text>
              <TouchableOpacity 
                style={styles.professionSelector}
                onPress={() => setShowProfessionSelection(true)}
              >
                <View style={styles.professionIconContainer}>
                  <Ionicons name="briefcase" size={20} color="#000" />
                </View>
                <Text style={styles.professionText}>
                  {formData.profession || 'Ajouter un métier'}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Nom complet *</Text>
              <TextInput
                style={styles.input}
                placeholder="Votre nom complet"
                value={formData.fullName}
                onChangeText={(text) => setFormData({ ...formData, fullName: text })}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Adresse *</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Cadjehoun, Cotonou"
                value={formData.address}
                onChangeText={(text) => setFormData({ ...formData, address: text })}
              />
            </View>
          </>
        ) : (
          <View style={styles.photoStepContainer}>
            <Text style={styles.photoDescription}>
              Ajoutez une photo professionnelle pour inspirer confiance à vos clients
            </Text>
            
            <TouchableOpacity 
              style={styles.photoCircle}
              onPress={pickImage}
            >
              {formData.photo ? (
                <Image 
                  source={{ uri: formData.photo }} 
                  style={styles.photoImage}
                />
              ) : (
                <>
                  <Ionicons name="camera" size={32} color="#075E54" />
                  <Text style={styles.photoAddText}>Ajouter une photo</Text>
                </>
              )}
            </TouchableOpacity>

            {formData.photo && (
              <TouchableOpacity 
                style={styles.retakeButton}
                onPress={pickImage}
              >
                <Text style={styles.retakeButtonText}>Changer de photo</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {currentStep === 1 ? (
          <TouchableOpacity
            style={[
              styles.nextButton,
              (!formData.profession || !formData.fullName || !formData.address) && styles.nextButtonDisabled
            ]}
            onPress={handleNextStep}
            disabled={!formData.profession || !formData.fullName || !formData.address}
          >
            <Text style={styles.nextButtonText}>Suivant</Text>
            <Ionicons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setCurrentStep(1)}
            >
              <Ionicons name="arrow-back" size={20} color="#075E54" />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.nextButton,
                !formData.photo && styles.nextButtonDisabled
              ]}
              onPress={handleSubmit}
              disabled={!formData.photo || loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <Text style={styles.nextButtonText}>Terminer</Text>
                  <Ionicons name="checkmark" size={20} color="#FFF" />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    paddingTop: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center'
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    color: '#333',
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 4
  },
  stepIndicator: {
    fontSize: 14,
    color: '#075E54',
    fontFamily: 'Poppins-Medium'
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    flexGrow: 1
  },
  formGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontFamily: 'Poppins-Medium',
  },
  professionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 5,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  professionIconContainer: {
    backgroundColor: '#F5F5F5',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  professionText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Trebuchet MS',
    flex: 1
  },
  input: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    fontSize: 16,
    color: '#333',
    fontFamily: 'Trebuchet MS',
  },
  photoStepContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  photoDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 20
  },
  photoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#075E54',
    position: 'relative',
    overflow: 'hidden'
  },
  photoImage: {
    width: '100%',
    height: '100%'
  },
  photoAddText: {
    marginTop: 12,
    color: '#075E54',
    fontFamily: 'Poppins-Medium'
  },
  retakeButton: {
    marginTop: 24
  },
  retakeButtonText: {
    color: '#075E54',
    fontFamily: 'Poppins-Medium',
    textDecorationLine: 'underline'
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12
  },
  backButtonText: {
    color: '#075E54',
    marginLeft: 8,
    fontFamily: 'Poppins-Medium'
  },
  nextButton: {
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    marginLeft: 16
  },
  nextButtonDisabled: {
    opacity: 0.6
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginRight: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  // Styles pour la sélection des métiers
  professionSelectionContainer: {
    flex: 1,
    backgroundColor: '#FFF'
  },
  professionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  professionTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 16
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 48
  },
  searchInput: {
    flex: 1,
    height: '100%',
    fontFamily: 'Trebuchet MS',
    fontSize: 16
  },
  clearButton: {
    padding: 8
  },
  professionList: {
    paddingHorizontal: 16
  },
  suggestionTitle: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Poppins-Medium',
    marginBottom: 12,
    marginTop: 8
  },
  professionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  professionText: {
    fontSize: 16,
    fontFamily: 'Trebuchet MS'
  }
});

export default PrestataireOnboarding;