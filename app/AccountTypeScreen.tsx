import React, { useState, useRef, useEffect } from 'react';
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
  Modal,
  Pressable
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { Picker } from '@react-native-picker/picker';

const OnboardingScreen = ({ navigation, route }) => {
  const userId = route.params?.userId;
  const referenceAccount = route.params?.referenceAccount;
  const [step, setStep] = useState(referenceAccount ? 2 : 1);
  const [accountType, setAccountType] = useState(null);
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    profession: '',
    photo: null,
    accessKey: Array(6).fill(''),
    reference_account: referenceAccount || null
  });
  const [loading, setLoading] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const scrollViewRef = useRef();
  const accessKeyRef = useRef();

  const professions = [
    'Plombier', 'Menuisier', 'Électricien', 'Peintre',
    'Maçon', 'Carreleur',
    'Jardinier', 'Paysagiste', 'Couturier(trice)', 'Coiffeur(euse)',
  ];

  useEffect(() => {
    const fetchReferenceAccountType = async () => {
      if (referenceAccount) {
        const { data, error } = await supabase
          .from('profiles')
          .select('type_compte')
          .eq('id', referenceAccount)
          .single();

        if (data) {
          // Sélection automatique du type de compte opposé
          const oppositeType = data.type_compte === 'Client' ? 'Prestataire' : 'Client';
          setAccountType(oppositeType);
          setFormData(prev => ({ 
            ...prev, 
            profession: oppositeType === 'Client' ? 'Client' : '',
            reference_account: referenceAccount
          }));
        }
      }
    };

    const checkExistingProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        setProfileExists(true);
        setAccountType(data.type_compte);
        setFormData({
          fullName: data.full_name || '',
          address: data.address || '',
          profession: data.profession || '',
          photo: data.photo_url || null,
          accessKey: data.access_key ? data.access_key.split('') : Array(6).fill(''),
          reference_account: data.reference_account || null
        });
      }
    };

    if (referenceAccount) {
      fetchReferenceAccountType();
    } else {
      checkExistingProfile();
    }
  }, [userId, referenceAccount]);

  const handleAccountSelect = (type) => {
    setAccountType(type);
    setFormData(prev => ({ ...prev, profession: type === 'Client' ? 'Client' : '' }));
  };

  const validateStep2 = () => {
    if (accountType === 'Prestataire' && !formData.profession) {
      Alert.alert('Profession requise', 'Veuillez sélectionner votre métier');
      return false;
    }
    return true;
  };

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
    
    const photoName = `${userId}.jpg`;
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

  const handleSubmit = async () => {
    setLoading(true);
    
    try {
      const photoUrl = await uploadPhoto();
      
      const { data: insertedProfile, error: insertError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          type_compte: accountType,
          full_name: formData.fullName,
          address: formData.address,
          profession: formData.profession,
          photo_url: photoUrl,
          access_key: formData.accessKey.join(''),
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
          online_mark: true,
          last_login: new Date().toISOString(),
          reference_account: formData.reference_account
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (!insertedProfile?.id) {
        throw new Error("Aucun ID généré par Supabase");
      }

      await AsyncStorage.multiSet([
        ['userId', insertedProfile.id],
        ['accountType', accountType],
        ['accessKey', formData.accessKey.join('')]
      ]);

      navigation.replace(accountType === 'Client' ? 'ClientHome' : 'ClientHome');

    } catch (error) {
      console.error('Erreur création compte:', error);
      Alert.alert('Erreur', error.message || "Erreur lors de la création du compte");
    } finally {
      setLoading(false);
    }
  };

  const handleAccessKeyChange = (text, index) => {
    const newAccessKey = [...formData.accessKey];
    newAccessKey[index] = text.toUpperCase();
    setFormData({ ...formData, accessKey: newAccessKey });
  };

  const generateRandomKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const newKey = Array(6).fill('').map(() => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    );
    setFormData({ ...formData, accessKey: newKey });
  };

  const downloadAccessKey = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie pour sauvegarder la clé');
        return;
      }

      // Capture de la vue de la carte clé d'accès
      const uri = await captureRef(accessKeyRef, {
        format: 'png',
        quality: 1,
        result: 'data-uri'
      });

      const fileUri = FileSystem.documentDirectory + `freetop-access-key-${userId}.png`;
      await FileSystem.writeAsStringAsync(fileUri, uri.split(',')[1], {
        encoding: FileSystem.EncodingType.Base64,
      });

      const asset = await MediaLibrary.createAssetAsync(fileUri);
      await MediaLibrary.createAlbumAsync('Freetop', asset, false);

      Alert.alert('Succès', 'La clé d\'accès a été sauvegardée dans votre galerie');
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la clé d\'accès');
    }
  };

  const nextStep = () => {
    if (step === 2 && !validateStep2()) {
      return;
    } else if (step < 3) {
      setStep(step + 1);
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    if (step > 1 && !referenceAccount) {
      setStep(step - 1);
      scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Image 
          source={require('../assets/adaptive-icon.png')} 
          style={styles.logo}
        />
        
        {!referenceAccount && (
          <View style={styles.stepIndicator}>
            {[1, 2, 3].map((i) => (
              <React.Fragment key={i}>
                <View style={[
                  styles.stepDot,
                  i === step && styles.stepDotActive,
                  i < step && styles.stepDotCompleted,
                ]}>
                  {i < step && (
                    <Ionicons name="checkmark" size={14} color="#FFF" />
                  )}
                </View>
                {i < 3 && <View style={styles.stepLine} />}
              </React.Fragment>
            ))}
          </View>
        )}
        
        <Text style={styles.stepText}>
          {referenceAccount ? 'Finalisation du compte' : `Étape ${step} sur 3`}
        </Text>
        <Text style={styles.title}>
          {step === 1 ? 'Choisissez votre profil' : 
           step === 2 ? (accountType === 'Prestataire' ? 'Informations professionnelles' : 'Informations personnelles') : 
           'Photo de profil'}
        </Text>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 && (
          <View style={styles.stepContainer}>
            <View style={styles.accountTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.accountTypeCard,
                  accountType === 'Client' && styles.accountTypeSelected
                ]}
                onPress={() => handleAccountSelect('Client')}
              >
                <View style={styles.accountTypeIcon}>
                  <Ionicons name="person-outline" size={32} color="#075E54" />
                </View>
                <Text style={styles.accountTypeTitle}>Client</Text>
                <Text style={styles.accountTypeDescription}>
                  Je recherche des services professionnels
                </Text>
                {accountType === 'Client' && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={24} color="#075E54" />
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.accountTypeCard,
                  accountType === 'Prestataire' && styles.accountTypeSelected
                ]}
                onPress={() => handleAccountSelect('Prestataire')}
              >
                <View style={styles.accountTypeIcon}>
                  <Ionicons name="build-outline" size={32} color="#075E54" />
                </View>
                <Text style={styles.accountTypeTitle}>Professionnel</Text>
                <Text style={styles.accountTypeDescription}>
                  Je propose mes services aux clients
                </Text>
                {accountType === 'Prestataire' && (
                  <View style={styles.selectedIndicator}>
                    <Ionicons name="checkmark-circle" size={24} color="#075E54" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContainer}>
            <View style={styles.formGroup}>
              <View style={styles.keyHeader}>
                <View style={styles.keyLabelContainer}>
                  <Text style={styles.label}>Clé d'accès</Text>
                  <TouchableOpacity onPress={() => setShowKeyInfo(true)}>
                    <Ionicons name="information-circle-outline" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={generateRandomKey}>
                  <Text style={styles.generateKeyText}>Générer</Text>
                </TouchableOpacity>
              </View>
              
              <View ref={accessKeyRef} style={styles.accessKeyCard}>
                <View style={styles.accessKeyGrid}>
                  {formData.accessKey.map((char, index) => (
                    <View key={index} style={styles.accessKeyCell}>
                      <Text style={styles.accessKeyChar}>{char}</Text>
                    </View>
                  ))}
                </View>
                <Image 
                  source={require('../assets/adaptive-icon.png')} 
                  style={styles.accessKeyLogo} 
                />
                <Text style={styles.accessKeyLabel}>Freetop Access Key</Text>
              </View>
              
            </View>

            {accountType === 'Prestataire' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Métier *</Text>
                <View style={styles.pickerContainer}>
                  <Picker
                    selectedValue={formData.profession}
                    onValueChange={(itemValue) => setFormData({ ...formData, profession: itemValue })}
                    style={styles.picker}
                    dropdownIconColor="#666"
                  >
                    <Picker.Item label="Sélectionnez votre métier" value="" />
                    {professions.map((profession, index) => (
                      <Picker.Item key={index} label={profession} value={profession} />
                    ))}
                  </Picker>
                </View>
              </View>
            )}

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
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.photoDescription}>
              {accountType === 'Prestataire' 
                ? 'Ajoutez une photo professionnelle pour inspirer confiance'
                : 'Ajoutez une photo pour personnaliser votre profil'}
            </Text>
            
            <View style={styles.photoUploadContainer}>
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
                  <Ionicons name="person-outline" size={48} color="#075E54" />
                )}
               
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {step > 1 && !referenceAccount && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={prevStep}
              disabled={loading}
            >
              <Ionicons name="chevron-back" size={20} color="#666" />
              <Text style={styles.backButtonText}>Retour</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.nextButton,
              (step === 1 && !accountType) || 
              (step === 2 && accountType === 'Prestataire' && !formData.profession) ||
              loading
                ? styles.nextButtonDisabled 
                : null
            ]}
            onPress={nextStep}
            disabled={
              (step === 1 && !accountType) || 
              (step === 2 && accountType === 'Prestataire' && !formData.profession) ||
              loading
            }
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {step === 3 ? 'Terminer' : 'Continuer'}
                </Text>
                <Ionicons 
                  name={step === 3 ? 'checkmark' : 'chevron-forward'} 
                  size={20} 
                  color="#FFF" 
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal d'information sur la clé d'accès */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={showKeyInfo}
        onRequestClose={() => setShowKeyInfo(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>À propos de votre clé d'accès</Text>
              
            </View>
            <Text style={styles.modalText}>
              Cette clé unique à 6 caractères vous permettra de récupérer votre compte en cas de perte ou changement d'appareil.
            </Text>
            <Text style={styles.modalText}>
              Conservez-la précieusement et ne la partagez avec personne. Vous pouvez faire une capture d'écran.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowKeyInfo(false)}
            >
              <Text style={styles.modalButtonText}>J'ai compris</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 88,
    height: 88,
    marginTop: 20,
    alignSelf: 'center',
    marginBottom: 16,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EEE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: '#075E54',
  },
  stepDotCompleted: {
    backgroundColor: '#075E54',
  },
  stepLine: {
    width: 60,
    height: 2,
    backgroundColor: '#EEE',
    marginHorizontal: 4,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Poppins-Medium',
  },
  title: {
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  stepContainer: {
    flex: 1,
  },
  accountTypeContainer: {
    marginTop: 16,
  },
  accountTypeCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    position: 'relative',
  },
  accountTypeSelected: {
    borderColor: '#075E54',
    backgroundColor: '#F5FDF9',
  },
  accountTypeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F0F9F5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  accountTypeTitle: {
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  accountTypeDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
    lineHeight: 20,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  formGroup: {
    marginBottom: 24,
  },
  keyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  keyLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    color: '#333',
    marginBottom: 0,
    fontFamily: 'Poppins-Medium',
  },
  generateKeyText: {
    color: '#075E54',
    fontFamily: 'Poppins-Medium',
    textDecorationLine: 'underline',
  },
  accessKeyCard: {
    backgroundColor: '#F9F9F9',
    borderRadius: 16,
    padding: 20,
    marginTop: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  accessKeyGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  accessKeyCell: {
    width: 40,
    height: 50,
    backgroundColor: '#FFF',
    borderRadius: 8,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EEE',
  },
  accessKeyChar: {
    fontSize: 22,
    color: '#333',
    fontFamily: 'Poppins-Bold',
  },
  accessKeyLogo: {
    width: 50,
    height: 50,
    marginBottom: 12,
  },
  accessKeyLabel: {
    fontSize: 14,
    color: '#666',
    fontFamily: 'Poppins-Medium',
  },
  downloadButton: {
    flexDirection: 'row',
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 14,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  downloadButtonText: {
    color: '#FFF',
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 8,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#EEE',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFF',
  },
  picker: {
    width: '100%',
    height: 50,
    color: '#333',
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
  photoUploadContainer: {
    alignItems: 'center',
    marginTop: 32,
  },
  photoCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#075E54',
    position: 'relative',
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
 
  photoDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontFamily: 'Trebuchet MS',
    lineHeight: 24,
    paddingHorizontal: 24,
  },
  footer: {
    padding: 24,
    paddingBottom: 32,
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  backButtonText: {
    marginLeft: 8,
    color: '#666',
    fontFamily: 'Poppins-Medium',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 16,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    color: '#FFF',
    fontSize: 16,
    marginRight: 8,
    fontFamily: 'Poppins-SemiBold',
  },
  modalOverlay: {
    flex: 1,
    marginTop:0,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    color: '#333',
    fontFamily: 'Poppins-SemiBold',
    flex: 1,
  },
  modalText: {
    fontSize: 15,
    color: '#666',
    fontFamily: 'Trebuchet MS',
    marginBottom: 16,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  modalButtonText: {
    color: '#FFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
});

export default OnboardingScreen;