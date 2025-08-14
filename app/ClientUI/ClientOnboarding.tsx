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
  Animated,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';

const ClientOnboarding = ({ navigation, route }) => {
  const userId = route.params?.userId;
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    fullName: '',
    address: '',
    photo: null,
    accessKey: Array(6).fill('')
  });
  const [loading, setLoading] = useState(false);
  const [showKeyInfo, setShowKeyInfo] = useState(false);
  const [showInfoBanner, setShowInfoBanner] = useState(false);
  const scrollViewRef = useRef();
  const accessKeyRef = useRef();
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkFirstVisit = async () => {
      const hasVisited = await AsyncStorage.getItem('hasVisitedClientOnboarding');
      if (!hasVisited) {
        setShowInfoBanner(true);
        animateBanner();
        await AsyncStorage.setItem('hasVisitedClientOnboarding', 'true');
      }
    };

    checkFirstVisit();
    checkExistingProfile();
  }, []);

  const animateBanner = () => {
    // Slide up
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start();

    // Auto hide after 8 seconds
    setTimeout(() => {
      hideBanner();
    }, 15000);
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true
    }).start(() => setShowInfoBanner(false));
  };

  const checkExistingProfile = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      setFormData({
        fullName: data.full_name || '',
        address: data.address || '',
        photo: data.photo_url || null,
        accessKey: data.access_key ? data.access_key.split('') : Array(6).fill('')
      });
    }
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
          type_compte: 'Client',
          full_name: formData.fullName,
          address: formData.address,
          photo_url: photoUrl,
          access_key: formData.accessKey.join(''),
          onboarding_completed: true,
          updated_at: new Date().toISOString(),
          online_mark: true,
          last_login: new Date().toISOString()
        }, {
          onConflict: 'id'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await AsyncStorage.multiSet([
        ['userId', insertedProfile.id],
        ['accountType', 'Client'],
        ['accessKey', formData.accessKey.join('')]
      ]);

      navigation.replace('ClientHome');

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

  const nextStep = () => {
    if (step === 1 && (!formData.fullName || !formData.address)) {
      Alert.alert('Champs requis', 'Veuillez remplir tous les champs obligatoires');
      return;
    }
    setStep(step + 1);
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  const prevStep = () => {
    setStep(step - 1);
    scrollViewRef.current?.scrollTo({ x: 0, y: 0, animated: true });
  };

  // Étape 1 - Informations de base
  const renderStep1 = () => (
    <>
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
            source={require('../../assets/Freetop.png')} 
            style={styles.accessKeyLogo} 
          />
          <Text style={styles.accessKeyLabel}>Freetop Access Key</Text>
        </View>
      </View>
    </>
  );

  // Étape 2 - Photo de profil
  const renderStep2 = () => (
    <View style={styles.photoUploadContainer}>
      <Text style={styles.photoDescription}>
        Ajoutez une photo pour personnaliser votre profil
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
          <Ionicons name="person-outline" size={48} color="#075E54" />
        )}
      </TouchableOpacity>
    </View>
  );

  // Bannière d'information
  const renderInfoBanner = () => {
    const translateY = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [200, 0]
    });

    return (
      <Animated.View style={[styles.infoBanner, { transform: [{ translateY }] }]}>
        <View style={styles.infoBannerContent}>
          <Ionicons name="information-circle" size={24} color="#075E54" />
          <View style={styles.infoBannerTextContainer}>
            <Text style={styles.infoBannerTitle}>Nouveauté sur Freetop</Text>
            <Text style={styles.infoBannerText}>
              Tous les nouveaux comptes sont des comptes clients. Vous pourrez créer 
              un profil professionnel lié à ce compte plus tard si vous le souhaitez.
            </Text>
          </View>
          <TouchableOpacity onPress={hideBanner} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <Image 
          source={require('../../assets/adaptive-icon.png')} 
          style={styles.logo}
        />
        <Text style={styles.title}>Création de compte Client</Text>
        
        <View style={styles.stepIndicator}>
          {[1, 2].map((i) => (
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
              {i < 2 && <View style={styles.stepLine} />}
            </React.Fragment>
          ))}
        </View>
      </View>

      <ScrollView 
        ref={scrollViewRef}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? renderStep1() : renderStep2()}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.buttonContainer}>
          {step > 1 && (
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
              (step === 1 && (!formData.fullName || !formData.address)) || loading
                ? styles.nextButtonDisabled 
                : null
            ]}
            onPress={step === 2 ? handleSubmit : nextStep}
            disabled={(step === 1 && (!formData.fullName || !formData.address)) || loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {step === 2 ? 'Terminer' : 'Continuer'}
                </Text>
                <Ionicons 
                  name={step === 2 ? 'checkmark' : 'chevron-forward'} 
                  size={20} 
                  color="#FFF" 
                />
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Bannière d'information */}
      {showInfoBanner && renderInfoBanner()}

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
              Conservez-la précieusement et ne la partagez avec personne.
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
    backgroundColor: '#FFFFFF',
  },
  logo: {
    width: 88,
    height: 88,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    color: '#333',
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
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
  contentContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
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
    flex: 1,
    justifyContent: 'center',
  },
  photoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
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
    marginBottom: 24,
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
    backgroundColor: '#ffffff',
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
  // Styles pour la bannière d'information
  infoBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderLeftWidth: 4,
    borderLeftColor: '#075E54',
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoBannerTextContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    fontFamily: 'Trebuchet MS',
    color: '#666',
    lineHeight: 20,
  },
  closeButton: {
    padding: 4,
  },
});

export default ClientOnboarding;