import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Alert,
  Keyboard,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AccessKeyAuth = ({ navigation }) => {
  const [accessKey, setAccessKey] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const handleChangeText = (text, index) => {
    const newKey = [...accessKey];
    newKey[index] = text.toUpperCase();
    setAccessKey(newKey);

    // Auto focus next field
    if (text && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (index, key) => {
    // Handle backspace
    if (key === 'Backspace' && !accessKey[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleVerify = async () => {
    try {
      setLoading(true);
      Keyboard.dismiss();

      const fullKey = accessKey.join('');
      if (fullKey.length !== 6) {
        throw new Error('La clé doit contenir 6 caractères');
      }

      // 1. Vérification de la clé dans Supabase
      const { data: profile, error } = await supabase
        .from('profiles')
        .select(`
          id,
          type_compte,
          full_name,
          photo_url,
          email,
          access_key,
          online_mark
        `)
        .eq('access_key', fullKey)
        .single();

      if (error || !profile) {
        throw new Error('Clé d\'accès incorrecte');
      }

      // 2. Mise à jour du statut de connexion
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          online_mark: true
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 3. Stockage des données utilisateur
      await AsyncStorage.multiSet([
        ['userId', profile.id],
        ['userName', profile.full_name || ''],
        ['userEmail', profile.email || ''],
        ['userPhoto', profile.photo_url || ''],
        ['accountType', profile.type_compte || '']
      ]);

      // 4. Redirection vers l'écran approprié
      navigation.replace(
        profile.type_compte === 'Client' ? 'ClientHome' : 'ClientHome',
        { profile }
      );

    } catch (error) {
      Alert.alert(
        'Erreur de connexion',
        error.message || 'Impossible de se connecter avec cette clé'
      );
      // Réinitialiser les champs
      setAccessKey(['', '', '', '', '', '']);
      inputs.current[0].focus();
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* Header */}
      <View style={styles.header}>
        <Image 
          source={require('../assets/logo.png')} 
          style={styles.logo}
        />
        <Text style={styles.title}>Connexion par clé d'accès</Text>
        <Text style={styles.subtitle}>Entrez votre clé à 6 caractères</Text>
      </View>

      {/* Key Inputs */}
      <View style={styles.inputsContainer}>
        {accessKey.map((char, index) => (
          <TextInput
            key={index}
            ref={ref => inputs.current[index] = ref}
            style={styles.input}
            value={char}
            onChangeText={text => handleChangeText(text, index)}
            onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
            maxLength={1}
            keyboardType="default"
            autoCapitalize="characters"
            selectTextOnFocus
            editable={!loading}
            textContentType="oneTimeCode"
            autoFocus={index === 0}
          />
        ))}
      </View>

      {/* Verify Button */}
      <TouchableOpacity
        style={[
          styles.button,
          (accessKey.some(c => !c) || loading) && styles.buttonDisabled
        ]}
        onPress={handleVerify}
        disabled={accessKey.some(c => !c) || loading}
      >
        {loading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Vérifier</Text>
          </>
        )}
      </TouchableOpacity>


    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 24,
    justifyContent: 'center'
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  logo: {
    width: 110,
    height: 30,
    marginBottom: 20
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
    marginBottom: 8
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Trebuchet MS',
    color: '#666666'
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40
  },
  input: {
    width: 48,
    height: 60,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    textAlign: 'center',
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
    color: '#000000'
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#075E54',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18
  },
  footer: {
    marginTop: 30,
    alignItems: 'center'
  },
  footerLink: {
    color: '#075E54',
    fontFamily: 'Poppins-Medium',
    fontSize: 15
  }
});

export default AccessKeyAuth;