import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ClientReservation = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { prestataireId } = route.params;
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [prestataire, setPrestataire] = useState(null);
  const [availability, setAvailability] = useState([]);

  useEffect(() => {
    fetchPrestataire();
    fetchAvailability();
  }, []);

  const fetchPrestataire = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('full_name, profession')
      .eq('id', prestataireId)
      .single();

    if (!error) setPrestataire(data);
  };

  const fetchAvailability = async () => {
    const { data, error } = await supabase
      .from('reservations')
      .select('date_debut, date_fin')
      .eq('prestataire_id', prestataireId)
      .gte('date_debut', new Date().toISOString());

    if (!error) setAvailability(data);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) setDate(selectedDate);
  };

  const handleStartTimeChange = (event, selectedTime) => {
    setShowStartTimePicker(false);
    if (selectedTime) setStartTime(selectedTime);
  };

  const handleEndTimeChange = (event, selectedTime) => {
    setShowEndTimePicker(false);
    if (selectedTime) setEndTime(selectedTime);
  };

  const handleReservation = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const { error } = await supabase
        .from('pending_reservations')
        .insert([{
          client_id: userId,
          prestataire_id: prestataireId,
          date_debut: combineDateAndTime(date, startTime),
          date_fin: combineDateAndTime(date, endTime),
          location: location.trim(),
          status: 'pending',
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

      Alert.alert(
        'Demande envoyée', 
        'Votre demande de réservation a été envoyée au prestataire',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Error creating reservation:', error);
      Alert.alert('Erreur', 'Impossible de créer la réservation');
    } finally {
      setLoading(false);
    }
  };

  const combineDateAndTime = (date, time) => {
    const newDate = new Date(date);
    newDate.setHours(time.getHours());
    newDate.setMinutes(time.getMinutes());
    return newDate.toISOString();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        <Text style={styles.title}>Nouvelle réservation</Text>
        <TouchableOpacity onPress={handleReservation} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#075E54" />
          ) : (
            <Text style={styles.saveButton}>Envoyer</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {prestataire && (
          <View style={styles.prestataireInfo}>
            <Text style={styles.prestataireName}>{prestataire.full_name}</Text>
            <Text style={styles.prestataireProfession}>{prestataire.profession}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date</Text>
          <TouchableOpacity 
            style={styles.input}
            onPress={() => setShowDatePicker(true)}
          >
            <Text>{date.toLocaleDateString('fr-FR')}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heure de début</Text>
          <TouchableOpacity 
            style={styles.input}
            onPress={() => setShowStartTimePicker(true)}
          >
            <Text>{startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Heure de fin</Text>
          <TouchableOpacity 
            style={styles.input}
            onPress={() => setShowEndTimePicker(true)}
          >
            <Text>{endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lieu</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Adresse ou lieu de rendez-vous"
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            minimumDate={new Date()}
            onChange={handleDateChange}
          />
        )}

        {showStartTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="default"
            onChange={handleStartTimeChange}
          />
        )}

        {showEndTimePicker && (
          <DateTimePicker
            value={endTime}
            mode="time"
            display="default"
            onChange={handleEndTimeChange}
          />
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#075E54',
  },
  saveButton: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#075E54',
  },
  content: {
    padding: 16,
  },
  prestataireInfo: {
    marginBottom: 24,
  },
  prestataireName: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
  },
  prestataireProfession: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#666',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  textInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EEE',
    fontSize: 16,
  },
});

export default ClientReservation;