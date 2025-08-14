import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  ScrollView, 
  Alert, 
  StatusBar, 
  ActivityIndicator,
  Dimensions,
  FlatList
} from 'react-native';
import Toast from 'react-native-toast-message';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const IMAGE_SIZE = width / 2.5 - 2;
const MAX_DESCRIPTION_LENGTH = 101;

const AddCollectionScreen = ({ navigation, route }) => {
  const { collectionToEdit, onGoBack } = route.params || {};
  const [description, setDescription] = useState(collectionToEdit?.description || '');
  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [uploading, setUploading] = useState(false);
  const descriptionRef = useRef();

  useEffect(() => {
    if (collectionToEdit) {
      const loadedImages = [
        collectionToEdit.image1_url,
        collectionToEdit.image2_url,
        collectionToEdit.image3_url,
        collectionToEdit.image4_url,
        collectionToEdit.image5_url,
      ].filter(url => url);
      setExistingImages(loadedImages);
    }
  }, [collectionToEdit]);

  const pickImage = async () => {
    const availableSlots = 5 - (images.length + existingImages.length);
    if (availableSlots <= 0) {
      Toast.show({
        type: 'error',
        text1: 'Maximum atteint',
        text2: 'Vous ne pouvez sélectionner que 5 images maximum',
        position: 'top',
        visibilityTime: 10000,
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: availableSlots,
      quality: 1,
      allowsEditing: false,
    });

    if (!result.canceled) {
      setImages([...images, ...result.assets.map(asset => asset.uri)]);
    }
  };

  const uploadImages = async (folderName) => {
    const imageUrls = [...existingImages];
    
    for (let i = 0; i < images.length; i++) {
      const uri = images[i];
      const filename = uri.split('/').pop();
      const extension = filename.split('.').pop();
      const newFilename = `${Date.now()}_${i}.${extension}`;

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: newFilename,
        type: `image/${extension}`,
      });

      const { data, error } = await supabase.storage
        .from('collections')
        .upload(`${folderName}/${newFilename}`, formData);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('collections')
        .getPublicUrl(`${folderName}/${newFilename}`);

      imageUrls.push(publicUrl);
    }

    return imageUrls.slice(0, 5);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Description requise',
        text2: 'Veuillez ajouter une description',
        position: 'top',
        visibilityTime: 10000,
      });
      return;
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      Toast.show({
        type: 'error',
        text1: 'Description trop longue',
        text2: `Maximum ${MAX_DESCRIPTION_LENGTH} caractères`,
        position: 'top',
        visibilityTime: 10000,
      });
      return;
    }

    if (images.length === 0 && existingImages.length === 0) {
      Toast.show({
        type: 'error',
        text1: 'Images requises',
        text2: 'Veuillez ajouter au moins une image',
        position: 'top',
        visibilityTime: 10000,
      });
      return;
    }

    setUploading(true);

    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) throw new Error('User not found');

      const folderName = collectionToEdit?.nom_dossier || `${userId}/${Date.now()}`;
      const imageUrls = await uploadImages(folderName);

      const collectionData = {
        user_id: userId,
        description,
        nom_dossier: folderName,
      };

      imageUrls.forEach((url, index) => {
        collectionData[`image${index + 1}_url`] = url;
      });

      if (collectionToEdit) {
        const { error } = await supabase
          .from('collections')
          .update(collectionData)
          .eq('id_collection', collectionToEdit.id_collection);

        if (error) throw error;
        Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Collection mise à jour',
        position: 'top',
        visibilityTime: 10000,
      });
      } else {
        const { error } = await supabase
          .from('collections')
          .insert([collectionData]);

        if (error) throw error;

        Toast.show({
        type: 'success',
        text1: 'Succès',
        text2: 'Collection créée',
        position: 'top',
        visibilityTime: 10000,
      });
      }

      onGoBack?.();
      navigation.goBack();
    } catch (error) {
      console.error('Error saving collection:', error);
      Alert.alert('Erreur', error.message);

    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index, isExisting) => {
    if (isExisting) {
      const newExisting = [...existingImages];
      newExisting.splice(index, 1);
      setExistingImages(newExisting);
    } else {
      const newImages = [...images];
      newImages.splice(index, 1);
      setImages(newImages);
    }
  };

  const renderImageItem = ({ item, index }) => (
    <View style={styles.imageWrapper}>
      <Image source={{ uri: item }} style={styles.gridImage} />
      <TouchableOpacity 
        style={styles.removeImageButton}
        onPress={() => removeImage(index, false)}
      >
        <Ionicons name="close" size={16} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderExistingImageItem = ({ item, index }) => (
    <View style={styles.imageWrapper}>
      <Image source={{ uri: item }} style={styles.gridImage} />
      <TouchableOpacity 
        style={styles.removeImageButton}
        onPress={() => removeImage(index, true)}
      >
        <Ionicons name="close" size={16} color="white" />
      </TouchableOpacity>
      <View style={styles.existingBadge}>
        <Text style={styles.existingBadgeText}>Existante</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* App Bar Premium */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#075E54" />
        </TouchableOpacity>
        
        <Text style={styles.title}>
          {collectionToEdit ? 'Modifier la collection' : 'Nouvelle collection'}
        </Text>
        
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={uploading}
          style={styles.saveButton}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#075E54" />
          ) : (
            <Text style={styles.saveButtonText}>Enregistrer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Description Input */}
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            ref={descriptionRef}
            style={styles.input}
            placeholder={`Décrivez votre collection (${MAX_DESCRIPTION_LENGTH} caractères max)`}
            placeholderTextColor="#A0AEC0"
            value={description}
            onChangeText={setDescription}
            multiline
            maxLength={MAX_DESCRIPTION_LENGTH}
          />
          <Text style={styles.charCount}>
            {description.length}/{MAX_DESCRIPTION_LENGTH}
          </Text>
        </View>

        {/* Add Images Button */}
        <TouchableOpacity 
          style={[
            styles.addButton,
            (images.length + existingImages.length) >= 5 && styles.addButtonDisabled
          ]} 
          onPress={pickImage}
          disabled={(images.length + existingImages.length) >= 5}
        >
          <Ionicons 
            name="add" 
            size={24} 
            color={(images.length + existingImages.length) >= 5 ? "#CBD5E0" : "#075E54"} 
          />
          <Text style={styles.addButtonText}>
            Ajouter des images ({(images.length + existingImages.length)}/5)
          </Text>
        </TouchableOpacity>

        {/* Existing Images Grid */}
        {existingImages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Images existantes</Text>
            <FlatList
              data={existingImages}
              renderItem={renderExistingImageItem}
              keyExtractor={(item, index) => `existing-${index}`}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContainer}
            />
          </View>
        )}

        {/* New Images Grid */}
        {images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nouvelles images</Text>
            <FlatList
              data={images}
              renderItem={renderImageItem}
              keyExtractor={(item, index) => `new-${index}`}
              numColumns={2}
              scrollEnabled={false}
              contentContainerStyle={styles.gridContainer}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  appBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingTop: 5,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
  },
  backButton: {
    padding: 8,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#2D3748',
  },
  saveButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveButtonText: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
    color: '#075E54',
  },
  content: {
    padding: 24,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
    color: '#4A5568',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontFamily: 'Trebuchet MS',
    color: '#2D3748',
  },
  charCount: {
    textAlign: 'right',
    color: '#A0AEC0',
    fontSize: 12,
    marginTop: 4,
    fontFamily: 'Trebuchet MS',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  addButtonText: {
    marginLeft: 12,
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#075E54',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold',
    color: '#4A5568',
    marginBottom: 16,
  },
  gridContainer: {
    paddingTop: 8,
  },
  imageWrapper: {
    marginBottom: 16,
    marginRight: 16,
    position: 'relative',
  },
  gridImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 12,
    backgroundColor: '#F5F5F5',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  existingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#075e54d6',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  existingBadgeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Poppins-Medium',
  },
});

export default AddCollectionScreen;