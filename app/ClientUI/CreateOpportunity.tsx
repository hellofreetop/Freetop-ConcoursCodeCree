import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert, 
  Platform,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const professionsList = [
  'Menuisier', 'Carreleur', 'Plombier', 'Électricien', 'Peintre', 'Maçon', 'Serrurier', 'Autre'
];

export default function CreateOpportunity({ navigation, route }) {
  const { opportunity, onSave } = route.params || {};
  const [title, setTitle] = useState(opportunity?.title || '');
  const [description, setDescription] = useState(opportunity?.description || '');
  const [priceMin, setPriceMin] = useState(opportunity?.price_min?.toString() || '');
  const [priceMax, setPriceMax] = useState(opportunity?.price_max?.toString() || '');
  const [professions, setProfessions] = useState(opportunity?.professions || []);
  const [otherJobs, setOtherJobs] = useState(opportunity?.other_jobs || '');
  const [showOtherJobsInput, setShowOtherJobsInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState(null);

  // Dates
  const today = new Date();
  const [startDate, setStartDate] = useState(opportunity ? new Date(opportunity.valid_from) : today);
  const [endDate, setEndDate] = useState(opportunity ? new Date(opportunity.valid_to) : today);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Références pour les inputs
  const descriptionRef = useRef();
  const priceMinRef = useRef();
  const priceMaxRef = useRef();
  const otherJobsRef = useRef();

  useEffect(() => {
    if (opportunity?.professions?.includes('Autre')) {
      setShowOtherJobsInput(true);
    }
  }, []);

  const toggleProfession = (prof) => {
    if (prof === 'Autre') {
      setShowOtherJobsInput(!showOtherJobsInput);
      if (!showOtherJobsInput) {
        setProfessions(prev => [...prev, 'Autre']);
      } else {
        setProfessions(prev => prev.filter(p => p !== 'Autre'));
        setOtherJobs('');
      }
    } else {
      setProfessions(prev =>
        prev.includes(prof) ? prev.filter(p => p !== prof) : [...prev, prof]
      );
    }
  };

  const handlePublish = async () => {
    Keyboard.dismiss();

    if (!title || !description || !priceMin || !priceMax || professions.length === 0 || !startDate || !endDate) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (endDate < startDate) {
      Alert.alert('Erreur', 'La date de fin doit être après la date de début.');
      return;
    }
    
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const opportunityData = {
        user_id: userId,
        title,
        description,
        price_min: parseFloat(priceMin),
        price_max: parseFloat(priceMax),
        professions,
        other_jobs: otherJobs,
        valid_from: startDate.toISOString(),
        valid_to: endDate.toISOString(),
      };

      if (opportunity) {
        // Mode édition
        const { data, error } = await supabase
          .from('opportunities')
          .update({
            ...opportunityData,
            updated_at: new Date().toISOString()
          })
          .eq('id', opportunity.id)
          .select()
          .single();

        if (error) throw error;
        Alert.alert('Succès', 'Opportunité mise à jour !');
        if (onSave) onSave(data);
      } else {
        // Mode création
        const { error } = await supabase
          .from('opportunities')
          .insert({
            ...opportunityData,
            created_at: new Date().toISOString()
          });

        if (error) throw error;
        Alert.alert('Succès', 'Opportunité publiée !');
      }
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Erreur', 'Une erreur est survenue');
    }
    setLoading(false);
  };

  const dismissKeyboard = () => {
    Keyboard.dismiss();
    setFocusedInput(null);
  };

  return (
    <TouchableWithoutFeedback onPress={dismissKeyboard}>
      <ScrollView 
        style={styles.container} 
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={24} color="#075E54" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {opportunity ? 'Modifier opportunité' : 'Créer une opportunité'}
          </Text>
          <View style={{ width: 32 }} />
        </View>

        <View style={styles.form}>
          {/* Titre */}
          <Text style={styles.label}>Titre</Text>
          <TextInput
            style={[styles.input, focusedInput === 'title' && styles.focusedInput]}
            placeholder="Titre de l'opportunité"
            value={title}
            onChangeText={setTitle}
            onFocus={() => setFocusedInput('title')}
            onSubmitEditing={() => descriptionRef.current.focus()}
            returnKeyType="next"
          />

          {/* Description */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            ref={descriptionRef}
            style={[styles.input, styles.multilineInput, focusedInput === 'description' && styles.focusedInput]}
            placeholder="Décrivez votre besoin..."
            value={description}
            onChangeText={setDescription}
            multiline
            onFocus={() => setFocusedInput('description')}
            onSubmitEditing={() => priceMinRef.current.focus()}
            returnKeyType="next"
          />

          {/* Prix */}
          <View style={styles.priceRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prix min (Fcfa)</Text>
              <TextInput
                ref={priceMinRef}
                style={[styles.input, focusedInput === 'priceMin' && styles.focusedInput]}
                placeholder="Ex: 10000"
                keyboardType="numeric"
                value={priceMin}
                onChangeText={setPriceMin}
                onFocus={() => setFocusedInput('priceMin')}
                onSubmitEditing={() => priceMaxRef.current.focus()}
                returnKeyType="next"
              />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Prix max (Fcfa)</Text>
              <TextInput
                ref={priceMaxRef}
                style={[styles.input, focusedInput === 'priceMax' && styles.focusedInput]}
                placeholder="Ex: 50000"
                keyboardType="numeric"
                value={priceMax}
                onChangeText={setPriceMax}
                onFocus={() => setFocusedInput('priceMax')}
                onSubmitEditing={dismissKeyboard}
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Professions */}
          <Text style={styles.label}>Professions recherchées</Text>
          <View style={styles.professionsContainer}>
            {professionsList.map(prof => (
              <TouchableOpacity
                key={prof}
                style={[
                  styles.professionBtn,
                  professions.includes(prof) && styles.professionBtnActive
                ]}
                onPress={() => toggleProfession(prof)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.professionText,
                  professions.includes(prof) && styles.professionTextActive
                ]}>
                  {prof}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Autres professions */}
          {showOtherJobsInput && (
            <View style={styles.otherJobsContainer}>
              <Text style={styles.label}>Précisez les autres professions</Text>
              <TextInput
                ref={otherJobsRef}
                style={[styles.input, focusedInput === 'otherJobs' && styles.focusedInput]}
                placeholder="Ex: Jardinier, Pisciniste..."
                value={otherJobs}
                onChangeText={setOtherJobs}
                onFocus={() => setFocusedInput('otherJobs')}
                onSubmitEditing={dismissKeyboard}
                returnKeyType="done"
              />
            </View>
          )}

          {/* Dates */}
          <Text style={styles.label}>Période de validité</Text>
          <View style={styles.dateRow}>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => {
                dismissKeyboard();
                setShowStartPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#075E54" />
              <Text style={styles.dateText}>
                {startDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            <Text style={{ marginHorizontal: 8, color: '#888' }}>
              <Ionicons name="arrow-forward" size={18} color="#888" />
            </Text>
            <TouchableOpacity
              style={styles.dateBtn}
              onPress={() => {
                dismissKeyboard();
                setShowEndPicker(true);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={18} color="#075E54" />
              <Text style={styles.dateText}>
                {endDate.toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          </View>

          {showStartPicker && (
            <DateTimePicker
              value={startDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={today}
              onChange={(_, date) => {
                setShowStartPicker(false);
                if (date) setStartDate(date);
              }}
            />
          )}

          {showEndPicker && (
            <DateTimePicker
              value={endDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={startDate}
              onChange={(_, date) => {
                setShowEndPicker(false);
                if (date) setEndDate(date);
              }}
            />
          )}

          {/* Bouton Publier */}
          <TouchableOpacity
            style={styles.publishBtn}
            onPress={handlePublish}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.publishBtnText}>
              {loading ? (opportunity ? 'Mise à jour...' : 'Publication...') : 
               (opportunity ? 'Mettre à jour' : 'Publier')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4F8',
    backgroundColor: '#fff',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    color: '#075E54',
  },
  form: {
    padding: 20,
  },
  label: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 15,
    color: '#262626',
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    marginBottom: 8,
    color: '#262626',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  focusedInput: {
    borderColor: '#075E54',
    backgroundColor: '#F0F9F5',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  professionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 8,
  },
  professionBtn: {
    backgroundColor: '#F0F9F5',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  professionBtnActive: {
    backgroundColor: '#075E54',
    borderColor: '#075E54',
  },
  professionText: {
    color: '#075E54',
    fontFamily: 'Poppins-Medium',
    fontSize: 14,
  },
  professionTextActive: {
    color: '#fff',
  },
  otherJobsContainer: {
    marginTop: 8,
  },
  publishBtn: {
    backgroundColor: '#075E54',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
    shadowColor: '#075E54',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  publishBtnText: {
    color: '#fff',
    fontFamily: 'Poppins-SemiBold',
    fontSize: 16,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dateText: {
    marginLeft: 8,
    fontFamily: 'Poppins-Medium',
    color: '#075E54',
    fontSize: 15,
  },
});