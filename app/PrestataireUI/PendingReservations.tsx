import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PendingReservations = () => {
  const navigation = useNavigation();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingReservations();
  }, []);

  const fetchPendingReservations = async () => {
    setLoading(true);
    const userId = await AsyncStorage.getItem('userId');
    
    const { data, error } = await supabase
      .from('pending_reservations')
      .select(`
        *,
        client:profiles(full_name, photo_url)
      `)
      .eq('prestataire_id', userId)
      .eq('status', 'pending')
      .order('date_debut', { ascending: true });

    if (!error) {
      setReservations(data);
    }
    setLoading(false);
  };

  const handleConfirm = async (reservationId) => {
    try {
      const { data, error } = await supabase
        .from('pending_reservations')
        .update({ status: 'confirmed' })
        .eq('id', reservationId)
        .select()
        .single();

      if (error) throw error;

      // Ajouter à la table des réservations confirmées
      const { error: insertError } = await supabase
        .from('reservations')
        .insert([{
          prestataire_id: data.prestataire_id,
          client_id: data.client_id,
          date_debut: data.date_debut,
          date_fin: data.date_fin,
          location: data.location,
          status: 'confirmed',
          created_at: new Date().toISOString()
        }]);

      if (insertError) throw insertError;

      // Mettre à jour la liste
      fetchPendingReservations();
    } catch (error) {
      console.error('Error confirming reservation:', error);
      Alert.alert('Erreur', 'Impossible de confirmer la réservation');
    }
  };

  const handleReject = async (reservationId) => {
    try {
      const { error } = await supabase
        .from('pending_reservations')
        .update({ status: 'rejected' })
        .eq('id', reservationId);

      if (error) throw error;

      // Mettre à jour la liste
      fetchPendingReservations();
    } catch (error) {
      console.error('Error rejecting reservation:', error);
      Alert.alert('Erreur', 'Impossible de rejeter la réservation');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#075E54" />
        </TouchableOpacity>
        <Text style={styles.title}>Réservations en attente</Text>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#075E54" style={styles.loader} />
      ) : reservations.length > 0 ? (
        <FlatList
          data={reservations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={styles.reservationCard}>
              <View style={styles.reservationHeader}>
                {item.client?.photo_url ? (
                  <Image source={{ uri: item.client.photo_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Ionicons name="person" size={20} color="#FFF" />
                  </View>
                )}
                <Text style={styles.clientName}>{item.client?.full_name || 'Client inconnu'}</Text>
              </View>
              
              <View style={styles.reservationDetails}>
                <Text style={styles.dateText}>
                  {new Date(item.date_debut).toLocaleDateString('fr-FR', { 
                    weekday: 'long', 
                    day: 'numeric', 
                    month: 'long' 
                  })}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(item.date_debut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                  {new Date(item.date_fin).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                {item.location && (
                  <Text style={styles.locationText}>
                    <Ionicons name="location-outline" size={16} color="#666" /> {item.location}
                  </Text>
                )}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.rejectButton}
                  onPress={() => handleReject(item.id)}
                >
                  <Text style={styles.buttonText}>Refuser</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.confirmButton}
                  onPress={() => handleConfirm(item.id)}
                >
                  <Text style={styles.buttonText}>Confirmer</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune réservation en attente</Text>
        </View>
      )}
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
  loader: {
    marginTop: 20,
  },
  listContent: {
    padding: 16,
  },
  reservationCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  reservationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientName: {
    fontSize: 18,
    fontFamily: 'Poppins-SemiBold',
    color: '#333',
  },
  reservationDetails: {
    marginBottom: 16,
  },
  dateText: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#333',
    marginBottom: 4,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    fontFamily: 'Poppins-Regular',
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rejectButton: {
    flex: 1,
    backgroundColor: '#FFECEC',
    padding: 12,
    borderRadius: 8,
    marginRight: 8,
    alignItems: 'center',
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#E6F7EE',
    padding: 12,
    borderRadius: 8,
    marginLeft: 8,
    alignItems: 'center',
  },
  buttonText: {
    fontFamily: 'Poppins-Medium',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default PendingReservations;