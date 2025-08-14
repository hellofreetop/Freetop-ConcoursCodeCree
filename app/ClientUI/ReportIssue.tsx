import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';

const ReportIssueScreen = ({ navigation }) => {
  const [userId, setUserId] = useState(null);
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(3);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTypeOptions, setShowTypeOptions] = useState(false);
  const [loadingUser, setLoadingUser] = useState(true);
  const messageInputRef = useRef();

  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);
      } catch (error) {
        console.error('Error fetching user ID:', error);
      } finally {
        setLoadingUser(false);
      }
    };

    fetchUserId();
  }, []);

  const handleSubmit = async () => {
    Keyboard.dismiss(); // Ferme le clavier avant la soumission
    
    if (!message.trim()) {
       Toast.show({
              type: 'error',
              text1: 'Erreur',
              text2: 'Veuillez décrire votre problème ou suggestion',
              position: 'top',
              visibilityTime: 5000,
            });
      return;
    }
    
    if (!userId) {
       Toast.show({
              type: 'error',
              text1: 'Erreur',
              text2: 'Utilisateur non identifié',
              position: 'top',
              visibilityTime: 5000,
            });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('platform_feedback')
        .insert([{
          user_id: userId,
          type,
          message,
          rating,
          status: 'pending'
        }]);

      if (error) throw error;
      
       Toast.show({
              type: 'success',
              text1: 'Merci !',
              text2: 'Votre feedback a bien été envoyé',
              position: 'top',
              visibilityTime: 5000,
            });
      setMessage('');
      setRating(3);
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Erreur',
        text2: "Une erreur est survenue lors de l'envoi: " + error.message,
        position: 'top',
        visibilityTime: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity 
          key={i} 
          onPress={() => setRating(i)}
          activeOpacity={0.7}
        >
          <Ionicons 
            name={i <= rating ? "star" : "star-outline"} 
            size={30} 
            color={i <= rating ? "#FFD700" : "#CCCCCC"} 
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const typeLabels = {
    bug: 'Bug',
    improvement: 'Amélioration',
    feature_request: 'Nouvelle fonctionnalité'
  };

  if (loadingUser) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        {/* Header personnalisé */}
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Signaler un problème</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo et Version */}
          <View style={styles.logoContainer}>
            <Image source={require('../../assets/Freetop.png')} style={styles.logo} />
            <Text style={styles.version}>v1.0.0</Text>
          </View>

          {/* Formulaire */}
          <Text style={styles.label}>Type de signalement</Text>
          
          <TouchableOpacity 
            style={styles.typeSelector} 
            onPress={() => {
              Keyboard.dismiss();
              setShowTypeOptions(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.typeSelectorText}>{typeLabels[type]}</Text>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>

          <Text style={styles.label}>Notez votre expérience</Text>
          <View style={styles.ratingContainer}>
            {renderStars()}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput
            ref={messageInputRef}
            multiline
            numberOfLines={5}
            style={styles.input}
            placeholder="Décrivez en détail..."
            placeholderTextColor="#999"
            value={message}
            onChangeText={setMessage}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={Keyboard.dismiss}
          />

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Envoyer</Text>
            )}
          </TouchableOpacity>

          {/* Modal pour sélectionner le type */}
          <Modal
            visible={showTypeOptions}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setShowTypeOptions(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Sélectionnez un type</Text>
                
                {Object.entries(typeLabels).map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    style={styles.modalOption}
                    onPress={() => {
                      setType(value);
                      setShowTypeOptions(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={type === value ? "radio-button-on" : "radio-button-off"} 
                      size={20} 
                      color="#075E54" 
                    />
                    <Text style={styles.modalOptionText}>{label}</Text>
                  </TouchableOpacity>
                ))}
                
                <TouchableOpacity
                  style={styles.modalClose}
                  onPress={() => setShowTypeOptions(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalCloseText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 5,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { height: 2, width: 0 }
  },
  backButton: {
    padding: 5
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'Poppins-SemiBold'
  },
  headerRight: {
    width: 24
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  logoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingHorizontal: 10
  },
  logo: {
    width: 60, 
    height: 60, 
    marginLeft: -20
  },
  version: {
    color: '#888',
    fontSize: 15,
    fontFamily: 'Inter-Regular'
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 12,
    marginTop: 16,
    color: '#333',
    fontFamily: 'TrebuchetMS-Bold'
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 15,
    marginBottom: 20
  },
  typeSelectorText: {
    fontSize: 16,
    color: '#333',
    fontFamily: 'Inter-Medium'
  },
  ratingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 15,
    paddingHorizontal: 40
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    padding: 15,
    textAlignVertical: 'top',
    minHeight: 150,
    marginBottom: 25,
    fontSize: 16,
    color: '#333',
    fontFamily: 'Inter-Regular'
  },
  button: {
    backgroundColor: '#075E54',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    height: 50
  },
  buttonDisabled: {
    opacity: 0.7
  },
  buttonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 16,
    fontFamily: 'Poppins-SemiBold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center'
  },
  modalContent: {
    backgroundColor: '#FFF',
    width: '80%',
    borderRadius: 10,
    padding: 20
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#333',
    textAlign: 'center',
    fontFamily: 'Poppins-Bold'
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE'
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
    fontFamily: 'Inter-Medium'
  },
  modalClose: {
    marginTop: 20,
    padding: 10,
    alignItems: 'center'
  },
  modalCloseText: {
    color: '#075E54',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'TrebuchetMS-Bold'
  }
});

export default ReportIssueScreen;