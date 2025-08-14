import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  StatusBar,
  RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import AppLoading from 'expo-app-loading';
import Toast from 'react-native-toast-message';

const EditProfile = ({ navigation, route }) => {
  const { userData } = route.params;
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isProvider, setIsProvider] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    address: '',
    description: '',
    profession: '',
    photo_url: ''
  });
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});

  let [fontsLoaded] = useFonts({
    'Trebuchet MS': require('../../assets/fonts/Trebuchet MS.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });

  useEffect(() => {
    loadProfileData();
  }, []);

  const loadProfileData = async () => {
    try {
      setRefreshing(true);
      const userId = await AsyncStorage.getItem('userId');
      
      const { data: typeData } = await supabase
        .from('profiles')
        .select('type_compte')
        .eq('id', userId)
        .single();
      
      setIsProvider(typeData?.type_compte === 'Prestataire');

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileData) {
        setFormData({
          full_name: profileData.full_name || '',
          email: profileData.email || '',
          phone: profileData.phone || '',
          address: profileData.address || '',
          description: profileData.description || '',
          profession: profileData.profession || '',
          photo_url: profileData.photo_url || ''
        });
        setImage(profileData.photo_url);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Erreur', 'Impossible de charger les données du profil');
    } finally {
      setRefreshing(false);
    }
  };

  const handleChange = (name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^229\d{10}$/;

    if (!formData.full_name) newErrors.full_name = 'Le nom complet est requis';
    if (!formData.email) {
      newErrors.email = 'L\'email est requis';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }
    if (formData.phone && !phoneRegex.test(formData.phone)) {
      newErrors.phone = 'Format: 22901xxxxxxxx';
    }
    if (formData.description && formData.description.length > 100) {
      newErrors.description = 'Max 100 caractères';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission refusée', 'Nous avons besoin de la permission pour accéder à vos photos');
        return;
      }

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        setImage(result.assets[0].uri);
        await uploadImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une image');
    }
  };

  const uploadImage = async (uri) => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) throw new Error('User ID not found');

      const filename = uri.split('/').pop();
      const extension = filename.split('.').pop();
      const newFilename = `${userId}.${extension}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: newFilename,
        type: `image/${extension}`,
      });

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(newFilename, formData, {
          cacheControl: '3600',
          upsert: true,
          contentType: `image/${extension}`,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(newFilename);

      setFormData(prev => ({ ...prev, photo_url: publicUrl }));
      setImage(publicUrl);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Erreur', "Impossible de télécharger l'image");
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteImage = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      
      // Delete from storage
      const { error: deleteError } = await supabase.storage
        .from('profile-photos')
        .remove([`${userId}.jpg`, `${userId}.png`, `${userId}.jpeg`]);

      if (deleteError && deleteError.message !== 'The resource was not found') {
        throw deleteError;
      }

      // Update profile to remove photo_url
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: null })
        .eq('id', userId);

      if (updateError) throw updateError;

      setImage(null);
      setFormData(prev => ({ ...prev, photo_url: '' }));
    } catch (error) {
      console.error('Error deleting image:', error);
      Alert.alert('Erreur', "Impossible de supprimer l'image");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem('userId');
      
      const updates = {
        ...formData,
        updated_at: new Date().toISOString(),
        id: userId
      };

      const { error } = await supabase
        .from('profiles')
        .upsert(updates);

      if (error) throw error;

      Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Profil mis à jour avec succès',
        position: 'top',
        visibilityTime: 5000,
      });
      navigation.goBack();
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = () => {
    loadProfileData();
  };

  if (!fontsLoaded) {
    return <AppLoading />;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.innerContainer}>
          {/* Header Premium */}
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={28} color="#075E54" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Modifier le profil</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#075E54']}
                tintColor="#075E54"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            {/* Nouvelle section pour la photo de profil */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarContainer}>
                {image ? (
                  <Image source={{ uri: image }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={36} color="#A0AEC0" />
                  </View>
                )}
                <Text style={styles.avatarLabel}>Photo de profil</Text>
              </View>

              <View style={styles.avatarButtonsContainer}>
                <TouchableOpacity 
                  style={styles.avatarButton} 
                  onPress={pickImage}
                  disabled={loading}
                >
                  <Ionicons name="image" size={20} color="#A0AEC0" />
                  <Text style={styles.avatarButtonText}>Changer l'image</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.avatarButton, !image && styles.avatarButtonDisabled]} 
                  onPress={deleteImage}
                  disabled={!image || loading}
                >
                  <Ionicons name="trash" size={20} color={image ? "#E53E3E" : "#A0AEC0"} />
                  <Text style={[styles.avatarButtonText, !image && styles.avatarButtonTextDisabled]}>
                    Supprimer l'image
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {loading && <ActivityIndicator style={styles.avatarLoading} color="#075E54" />}

            {/* Formulaire premium */}
            <View style={styles.formSection}>
              <Text style={styles.sectionTitle}>Informations personnelles</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>Nom complet *</Text>
                <TextInput
                  style={[styles.input, errors.full_name && styles.inputError]}
                  value={formData.full_name}
                  onChangeText={(text) => handleChange('full_name', text)}
                  placeholder="Votre nom complet"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="next"
                />
                {errors.full_name && <Text style={styles.errorText}>{errors.full_name}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={formData.email}
                  onChangeText={(text) => handleChange('email', text)}
                  placeholder="exemple@email.com"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Téléphone</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  value={formData.phone}
                  onChangeText={(text) => handleChange('phone', text)}
                  placeholder="22901xxxxxxxx"
                  placeholderTextColor="#A0AEC0"
                  keyboardType="phone-pad"
                  maxLength={13}
                  returnKeyType="next"
                />
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Adresse</Text>
                <TextInput
                  style={styles.input}
                  value={formData.address}
                  onChangeText={(text) => handleChange('address', text)}
                  placeholder="Votre adresse complète"
                  placeholderTextColor="#A0AEC0"
                  returnKeyType="next"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, errors.description && styles.inputError]}
                  value={formData.description}
                  onChangeText={(text) => handleChange('description', text)}
                  placeholder="Décrivez-vous en quelques mots (max 100 caractères)"
                  placeholderTextColor="#A0AEC0"
                  multiline
                  numberOfLines={3}
                  maxLength={100}
                  returnKeyType="done"
                />
                <Text style={styles.charCount}>
                  {formData.description ? formData.description.length : 0}/100 caractères
                </Text>
                {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
              </View>

              {isProvider && (
                <>
                  <Text style={styles.sectionTitle}>Informations professionnelles</Text>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>Profession</Text>
                    <TextInput
                      style={styles.input}
                      value={formData.profession}
                      onChangeText={(text) => handleChange('profession', text)}
                      placeholder="Votre profession"
                      placeholderTextColor="#A0AEC0"
                      returnKeyType="done"
                      editable={false}
                    />
                  </View>
                </>
              )}
            </View>
          </ScrollView>

          {/* Bouton premium fixe */}
          <View style={styles.footer}>
            <TouchableOpacity 
              style={[styles.saveButton, loading && styles.saveButtonDisabled]} 
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" style={styles.buttonIcon} />
                  <Text style={styles.saveButtonText}>Enregistrer les modifications</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  innerContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: StatusBar.currentHeight - 20,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    color: '#2D3748',
    fontFamily: 'Poppins-SemiBold',
  },
  scrollContainer: {
    paddingBottom: 100,
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 24,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatarContainer: {
    alignItems: 'center',
    marginRight: 24,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EDF2F7',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
  },
  avatarLabel: {
    marginTop: 8,
    color: '#718096',
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
  },
  avatarButtonsContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  avatarButtonDisabled: {
    opacity: 0.5,
  },
  avatarButtonText: {
    marginLeft: 8,
    color: '#2D3748',
    fontFamily: 'Poppins-Medium',
  },
  avatarButtonTextDisabled: {
    color: '#A0AEC0',
  },
  avatarLoading: {
    marginTop: 16,
  },
  formSection: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 16,
    color: '#4A5568',
    fontFamily: 'Poppins-SemiBold',
    marginBottom: 16,
    marginTop: 8,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 8,
    fontFamily: 'Poppins-Medium',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2D3748',
    fontFamily: 'Trebuchet MS',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  inputError: {
    borderColor: '#E53E3E',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#E53E3E',
    fontSize: 12,
    marginTop: 5,
    fontFamily: 'Trebuchet MS',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#A0AEC0',
    marginTop: 5,
    fontFamily: 'Trebuchet MS',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 5,
  },
  saveButton: {
    backgroundColor: '#075E54',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#075E54',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 8,
  },
});

export default EditProfile;