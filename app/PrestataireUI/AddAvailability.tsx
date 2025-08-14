import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons, Feather, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AddAvailability = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [allDay, setAllDay] = useState(false);
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [location, setLocation] = useState('');
  const [client, setClient] = useState(null);
  const [showPicker, setShowPicker] = useState(null);

  const handleSave = async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      
      const reservationData = {
        prestataire_id: userId,
        date_debut: combineDateAndTime(startDate, startTime),
        date_fin: allDay ? null : combineDateAndTime(endDate, endTime),
        all_day: allDay,
        location: location.trim(),
        status: allDay ? 'unavailable' : 'reserved',
        client_id: client?.id || null,
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('reservations')
        .insert([reservationData]);

      if (error) throw error;

      navigation.goBack();
    } catch (error) {
      console.error('Error saving reservation:', error);
      Alert.alert('Erreur', error.message || 'Impossible de sauvegarder');
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

  const handleDateChange = (event, selectedDate) => {
    setShowPicker(null);
    if (!selectedDate) return;

    if (showPicker === 'startDate') {
      setStartDate(selectedDate);
      if (selectedDate > endDate) setEndDate(selectedDate);
    } else if (showPicker === 'endDate') {
      setEndDate(selectedDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowPicker(null);
    if (!selectedTime) return;

    if (showPicker === 'startTime') {
      setStartTime(selectedTime);
    } else if (showPicker === 'endTime') {
      setEndTime(selectedTime);
    }
  };

  const handleSelectClient = () => {
    navigation.navigate('SelectClient', { onClientSelect: setClient });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        <Text style={styles.title}>Ajouter indisponibilité</Text>
        <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.iconButton}>
          {loading ? (
            <ActivityIndicator size="small" color="#075E54" />
          ) : (
            <Feather name="check" size={24} color="#075E54" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={20} color="#075E54" />
            <Text style={styles.cardTitle}>Durée</Text>
          </View>
          
          <View style={styles.switchContainer}>
            <Text style={styles.switchLabel}>Toute la journée</Text>
            <Switch
              value={allDay}
              onValueChange={setAllDay}
              trackColor={{ false: '#E0E0E0', true: '#075E54' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="calendar" size={20} color="#075E54" />
            <Text style={styles.cardTitle}>Dates</Text>
          </View>

          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeContainer}>
              <Text style={styles.dateTimeLabel}>Début</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowPicker('startDate')}
              >
                <Ionicons name="calendar-outline" size={18} color="#666" />
                <Text style={styles.dateTimeText}>{startDate.toLocaleDateString('fr-FR')}</Text>
              </TouchableOpacity>
            </View>

            {!allDay && (
              <View style={styles.dateTimeContainer}>
                <Text style={styles.dateTimeLabel}>Heure</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowPicker('startTime')}
                >
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.dateTimeRow}>
            <View style={styles.dateTimeContainer}>
              <Text style={styles.dateTimeLabel}>Fin</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowPicker('endDate')}
              >
                <Ionicons name="calendar-outline" size={18} color="#666" />
                <Text style={styles.dateTimeText}>{endDate.toLocaleDateString('fr-FR')}</Text>
              </TouchableOpacity>
            </View>

            {!allDay && (
              <View style={styles.dateTimeContainer}>
                <Text style={styles.dateTimeLabel}>Heure</Text>
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowPicker('endTime')}
                >
                  <Ionicons name="time-outline" size={18} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <FontAwesome name="user-o" size={18} color="#075E54" />
            <Text style={styles.cardTitle}>Client</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.inputField}
            onPress={handleSelectClient}
          >
            <View style={styles.inputContent}>
              <MaterialIcons name="person-outline" size={20} color="#666" />
              <Text style={styles.inputText}>{client ? client.full_name : 'Sélectionner un client'}</Text>
            </View>
            <Feather name="chevron-right" size={20} color="#999" />
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Feather name="map-pin" size={18} color="#075E54" />
            <Text style={styles.cardTitle}>Lieu</Text>
          </View>
          
          <View style={styles.inputField}>
            <View style={styles.inputContent}>
              <MaterialIcons name="location-on" size={20} color="#666" />
              <TextInput
                style={styles.textInput}
                placeholder="Adresse ou lieu de rendez-vous"
                placeholderTextColor="#999"
                value={location}
                onChangeText={setLocation}
              />
            </View>
          </View>
        </View>

        {showPicker && (
          <DateTimePicker
            value={
              showPicker === 'startDate' ? startDate :
              showPicker === 'endDate' ? endDate :
              showPicker === 'startTime' ? startTime : endTime
            }
            mode={showPicker.includes('Date') ? 'date' : 'time'}
            display="default"
            onChange={
              showPicker.includes('Date') ? handleDateChange : handleTimeChange
            }
            minimumDate={showPicker === 'endDate' ? startDate : new Date()}
          />
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    elevation: 2,
  },
  iconButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#075E54',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontFamily: 'Poppins-Medium',
    color: '#075E54',
    marginLeft: 8,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  switchLabel: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#333',
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  dateTimeContainer: {
    flex: 1,
    marginRight: 8,
  },
  dateTimeLabel: {
    fontSize: 13,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 4,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  dateTimeText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#333',
    marginLeft: 8,
  },
  inputField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#EEE',
  },
  inputContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputText: {
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#333',
    marginLeft: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Poppins-Regular',
    color: '#333',
    marginLeft: 8,
    paddingVertical: 0,
  },
});

export default AddAvailability;