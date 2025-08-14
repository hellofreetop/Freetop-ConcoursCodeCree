import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  StyleSheet, 
  Alert,
  Keyboard,
  StatusBar,
  ActivityIndicator,
  Animated, Easing
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SwitchAccountScreen = ({ navigation }) => {
  const [fullName, setFullName] = useState('');
  const [accessKey, setAccessKey] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);
const spinValue = new Animated.Value(0);

const spin = spinValue.interpolate({
  inputRange: [0, 1],
  outputRange: ['0deg', '360deg']
});

React.useEffect(() => {
  if (loading) {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    ).start();
  } else {
    spinValue.setValue(0);
  }
}, [loading]);

  const handleKeyChange = (text, index) => {
    const newKey = [...accessKey];
    newKey[index] = text.toUpperCase();
    setAccessKey(newKey);

    if (text && index < 5) {
      inputs.current[index + 1].focus();
    }
  };

  const handleKeyPress = (index, key) => {
    if (key === 'Backspace' && !accessKey[index] && index > 0) {
      inputs.current[index - 1].focus();
    }
  };

  const handleSwitchAccount = async () => {
    try {
      setLoading(true);
      Keyboard.dismiss();

      const key = accessKey.join('');
      if (!fullName || key.length !== 6) {
        throw new Error('Veuillez remplir tous les champs');
      }

      // 1. Vérification du compte
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
        .eq('full_name', fullName.trim())
        .eq('access_key', key)
        .single();

      if (error || !profile) {
        throw new Error('Nom ou clé d\'accès incorrect');
      }

      // 2. Mise à jour du statut
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_login: new Date().toISOString(),
          online_mark: true
        })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      // 3. Remplacement du userId
      await AsyncStorage.multiSet([
        ['userId', profile.id],
        ['userName', profile.full_name],
        ['userEmail', profile.email || ''],
        ['userPhoto', profile.photo_url || ''],
        ['accountType', profile.type_compte]
      ]);

      // 4. Redirection
      navigation.replace(
        profile.type_compte === 'Client' ? 'ClientHome' : 'ClientHome',
        { profile }
      );

    } catch (error) {
      Alert.alert(
        'Erreur',
        error.message || 'Échec du changement de compte'
      );
      setAccessKey(['', '', '', '', '', '']);
      if (inputs.current[0]) inputs.current[0].focus();
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
        <Text style={styles.title}>Changer de compte</Text>
      </View>

      {/* Form */}
      <View style={styles.formContainer}>
        {/* Full Name Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Nom complet</Text>
          <TextInput
            style={styles.textInput}
            value={fullName}
            onChangeText={setFullName}
            placeholder="Entrez votre nom complet"
            placeholderTextColor="#999"
            autoCapitalize="words"
            editable={!loading}
          />
        </View>

        {/* Access Key Inputs */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Clé d'accès (6 caractères)</Text>
          <View style={styles.keyInputsContainer}>
            {accessKey.map((char, index) => (
              <TextInput
                key={index}
                ref={ref => inputs.current[index] = ref}
                style={styles.keyInput}
                value={char}
                onChangeText={text => handleKeyChange(text, index)}
                onKeyPress={({ nativeEvent: { key } }) => handleKeyPress(index, key)}
                maxLength={1}
                keyboardType="default"
                autoCapitalize="characters"
                selectTextOnFocus
                editable={!loading}
              />
            ))}
          </View>
        </View>

        {/* Submit Button */}
        {/* Submit Button avec animation */}
<TouchableOpacity
  style={[
    styles.submitButton,
    (loading || !fullName || accessKey.some(c => !c)) && styles.buttonDisabled
  ]}
  onPress={handleSwitchAccount}
  disabled={loading || !fullName || accessKey.some(c => !c)}
>
  {loading ? (
    <View style={styles.loadingContent}>
      <Animated.View style={[styles.iconContainer, { transform: [{ rotate: spin }] }]}>
        <Ionicons name="sync" size={20} color="#FFFFFF" />
      </Animated.View>
      <Text style={styles.buttonText}>Vérification...</Text>
    </View>
  ) : (
    <>
      <Ionicons name="sync" size={20} color="#FFFFFF" />
      <Text style={styles.buttonText}>Changer de compte</Text>
    </>
  )}
</TouchableOpacity>
      </View>

      {/* Footer Links */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.footerLink}
          onPress={() => navigation.navigate('AccountType')}
        >
         
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 40
  },
  header: {
    alignItems: 'center',
    marginBottom: 40
  },
  logo: {
    width: 100,
    height: 30,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
    textAlign: 'center'
  },
  formContainer: {
    marginBottom: 30
  },
  inputGroup: {
    marginBottom: 30
  },
  label: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333333',
    marginBottom: 12,
    paddingLeft: 5
  },
  textInput: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Trebuchet MS',
    backgroundColor: '#FAFAFA',
    color: '#000000'
  },
  keyInputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  keyInput: {
    width: 48,
    height: 56,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    backgroundColor: '#FAFAFA',
    textAlign: 'center',
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#000000'
  },
  
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 20,
    alignItems: 'center'
  },
  footerLink: {
    paddingVertical: 10
  },
  footerLinkText: {
    color: '#075E54',
    fontFamily: 'Poppins-Medium',
    fontSize: 15
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  iconContainer: {
    width: 20,
    height: 20
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 12,
    backgroundColor: '#075E54',
    gap: 12,
    overflow: 'hidden'
  },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18
  },
  buttonDisabled: {
    opacity: 0.7
  }
});

export default SwitchAccountScreen;