import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  ActivityIndicator,
  StatusBar,TouchableOpacity
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DayView = ({ route }) => {
  const { date } = route.params;
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDayReservations();
  }, [date]);

  const fetchDayReservations = async () => {
    setLoading(true);
    const userId = await AsyncStorage.getItem('userId');
    
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        client:profiles(full_name, photo_url)
      `)
      .eq('prestataire_id', userId)
      .gte('date_debut', `${date}T00:00:00`)
      .lte('date_debut', `${date}T23:59:59`);

    if (!error) {
      setReservations(data);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
     
      <Text style={styles.dateHeader}>
        
        {new Date(date).toLocaleDateString('fr-FR', { 
          weekday: 'long', 
          day: 'numeric', 
          month: 'long' 
        })}
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color="#075E54" />
      ) : reservations.length > 0 ? (
        <ScrollView contentContainerStyle={styles.reservationsContainer}>
          {reservations.map((reservation, index) => (
            <View key={index} style={styles.reservationCard}>
              <Text style={styles.clientName}>
                {reservation.client?.full_name || 'Client inconnu'}
              </Text>
              <Text style={styles.timeText}>
                {new Date(reservation.date_debut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                {reservation.date_fin ? 
                  new Date(reservation.date_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
                  'Fin non définie'}
              </Text>
              <Text style={styles.locationText}>
                {reservation.location || 'Lieu non spécifié'}
              </Text>
              <Text style={styles.statusText}>
                Statut: {reservation.status === 'pending' ? 'En attente' : 'Confirmé'}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Rien de particulier en ce jour</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  dateHeader: {
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#075E54',
    marginBottom: 20,
  },
  reservationsContainer: {
    paddingBottom: 20,
  },
  reservationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#075E54',
  },
  clientName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
    marginBottom: 8,
  },
  timeText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 4,
  },
  statusText: {
    fontSize: 14,
    fontFamily: 'Poppins-Medium',
    color: '#075E54',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontFamily: 'Poppins-Regular',
    color: '#999',
  },
});

export default DayView;