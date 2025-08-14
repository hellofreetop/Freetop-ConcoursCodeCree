import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ToastAndroid
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Font from 'expo-font';
import { supabase } from '../../lib/supabase';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_IMAGES = 6;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_FILE_SIZE_MB = 10;
const { width } = Dimensions.get('window');

// Charger les polices personnalisées
async function loadFonts() {
  await Font.loadAsync({
    'Poppins-Regular': require('../../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../../assets/fonts/Poppins-Bold.ttf'),
  });
}

const showToast = (message) => {
  ToastAndroid.showWithGravity(
    message,
    ToastAndroid.SHORT,
    ToastAndroid.BOTTOM
  );
};

const AddProductScreen = () => {
  const navigation = useNavigation();
  const [images, setImages] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    discount: '',
  });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productId, setProductId] = useState(null);
  const [creatorId, setCreatorId] = useState(null);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  // Charger les polices au montage
  useEffect(() => {
    loadFonts().then(() => setFontsLoaded(true));
  }, []);

  // Récupérer l'ID de l'utilisateur connecté
  useEffect(() => {
    const getUserId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        if (userId) {
          setCreatorId(userId);
        } else {
          showToast('Utilisateur non identifié');
          navigation.goBack();
        }
      } catch (error) {
        console.error('Erreur récupération userId:', error);
        showToast('Erreur de connexion');
        navigation.goBack();
      }
    };

    getUserId();

    // Vérifier les permissions
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast('Permission requise pour accéder à la galerie');
      }
    })();
  }, []);

  const pickImage = async () => {
    try {
      if (images.length >= MAX_IMAGES) {
        showToast(`Maximum ${MAX_IMAGES} images autorisées`);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - images.length,
        quality: 0.8,
        aspect: [4, 3],
      });

      if (!result.canceled) {
        setImages([...images, ...result.assets.map(asset => asset.uri)]);
      }
    } catch (error) {
      console.error('Erreur sélection image:', error);
      showToast("Impossible de sélectionner l'image");
    }
  };

  const removeImage = (index) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    setImages(newImages);
  };

  const uploadProductImages = async (productId) => {
    const uploadedImageUrls = [];
    
    for (let i = 0; i < images.length; i++) {
      try {
        const uri = images[i];
        const filename = uri.split('/').pop();
        const extension = filename.split('.').pop();
        const newFilename = `product_${Date.now()}_${i}.${extension}`;

        const formData = new FormData();
        formData.append('file', {
          uri,
          name: newFilename,
          type: `image/${extension}`,
        });

        // Upload vers le bucket
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(`products/${productId}/${newFilename}`, formData);

        if (uploadError) throw uploadError;

        // Récupération de l'URL publique
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(`products/${productId}/${newFilename}`);

        // Enregistrement dans la table product_images
        const { error: dbError } = await supabase
          .from('product_images')
          .insert({
            product_id: productId,
            url: publicUrl,
            is_primary: i === 0,
            created_at: new Date().toISOString()
          });

        if (dbError) throw dbError;

        uploadedImageUrls.push(publicUrl);

        // Mettre à jour la progression
        const progress = Math.round(((i + 1) / images.length) * 100);
        setUploadProgress(progress);

      } catch (error) {
        console.error(`Erreur upload image ${i}:`, error);
        throw new Error(`Échec upload image ${i + 1}: ${error.message}`);
      }
    }

    return uploadedImageUrls;
  };

  const handleSubmit = async () => {
    if (!formData.title || !formData.price) {
      showToast('Veuillez remplir tous les champs obligatoires');
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(0);
    
    try {
      // 1. Créer le produit
      const { data: product, error } = await supabase
        .from('products')
        .insert({
          title: formData.title,
          description: formData.description,
          price: parseFloat(formData.price),
          discount: formData.discount ? parseFloat(formData.discount) : 0,
          creator_id: creatorId
        })
        .select()
        .single();

      if (error) throw error;

      // 2. Uploader les images si elles existent
      if (images.length > 0) {
        await uploadProductImages(product.id);
      }

      showToast('Produit créé avec succès');
      navigation.goBack();
    } catch (error) {
      console.error('Erreur création produit:', error);
      showToast(error.message || "Erreur lors de la création");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* AppBar */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          disabled={isSubmitting}
        >
          <Ionicons 
            name="arrow-back" 
            size={24} 
            color={isSubmitting ? '#ccc' : '#075E54'} 
          />
        </TouchableOpacity>
        
        <Text style={styles.appBarTitle}>Nouveau Produit</Text>
        
        <TouchableOpacity 
          onPress={handleSubmit} 
          style={[
            styles.publishButton,
            (isSubmitting || !creatorId) && styles.publishButtonDisabled
          ]}
          disabled={isSubmitting || !creatorId}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.publishButtonText}>Publier</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section Images */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Photos ({images.length}/{MAX_IMAGES})
          </Text>
          
          <View style={styles.imagesContainer}>
            {images.map((uri, index) => (
              <View key={`img-${index}`} style={styles.imageWrapper}>
                <Image source={{ uri }} style={styles.image} />
                {!isSubmitting && (
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#ff4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            
            {images.length < MAX_IMAGES && !isSubmitting && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={pickImage}
              >
                <Feather name="plus" size={24} color="#075E54" />
                <Text style={styles.addImageText}>Ajouter</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {isSubmitting && uploadProgress > 0 && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${uploadProgress}%` }
                  ]} 
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(uploadProgress)}% complété
              </Text>
            </View>
          )}
        </View>

        {/* Section Formulaire */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Détails du produit</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Titre *</Text>
            <TextInput
              style={styles.input}
              placeholder="Nom du produit"
              placeholderTextColor="#999"
              value={formData.title}
              onChangeText={(text) => setFormData({...formData, title: text})}
              editable={!isSubmitting}
              maxLength={100}
            />
          </View>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.descriptionInput]}
              placeholder={`Description détaillée (${MAX_DESCRIPTION_LENGTH} caractères max)`}
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              value={formData.description}
              onChangeText={(text) => setFormData({...formData, description: text})}
              editable={!isSubmitting}
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
            <Text style={styles.charCount}>
              {formData.description.length}/{MAX_DESCRIPTION_LENGTH}
            </Text>
          </View>
          
          <View style={styles.priceRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
              <Text style={styles.label}>Prix (Fcfa) *</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.price}
                onChangeText={(text) => setFormData({...formData, price: text})}
                editable={!isSubmitting}
              />
            </View>
            
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.label}>Réduction (Fcfa)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={formData.discount}
                onChangeText={(text) => setFormData({...formData, discount: text})}
                editable={!isSubmitting}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Poppins-SemiBold',
  },
  publishButton: {
    backgroundColor: '#075E54',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  publishButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  publishButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    fontFamily: 'Poppins-SemiBold',
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  imageWrapper: {
    width: width / 2 - 24,
    height: width / 2 - 24,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 12,
    padding: 4,
  },
  addImageButton: {
    width: width / 2 - 24,
    height: width / 2 - 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#075E54',
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  addImageText: {
    color: '#075E54',
    marginTop: 8,
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#075E54',
  },
  progressText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
    fontFamily: 'Poppins-Regular',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Poppins-Regular',
  },
  descriptionInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    fontFamily: 'Poppins-Regular',
  },
  priceRow: {
    flexDirection: 'row',
  },
});

export default AddProductScreen;