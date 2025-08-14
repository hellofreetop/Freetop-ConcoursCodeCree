import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image,
  StatusBar,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Calendar } from 'react-native-calendars';
import AsyncStorage from '@react-native-async-storage/async-storage';

const formatDate = (date) => date.toISOString().split('T')[0];

const PrestataireCalendar = () => {
  const navigation = useNavigation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [markedDates, setMarkedDates] = useState({});
  const [userAvatar, setUserAvatar] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserProfile();
    fetchBookedDates();
  }, []);

  useEffect(() => {
    fetchBookedDates();
  }, [currentDate]);

  const fetchUserProfile = async () => {
    const userId = await AsyncStorage.getItem('userId');
    const { data, error } = await supabase
      .from('profiles')
      .select('photo_url')
      .eq('id', userId)
      .single();

    if (!error && data?.photo_url) setUserAvatar(data.photo_url);
  };

  const fetchBookedDates = async () => {
    setLoading(true);
    const userId = await AsyncStorage.getItem('userId');
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from('reservations')
      .select('date_debut, date_fin, status')
      .or(`prestataire_id.eq.${userId},status.eq.pending`);

    if (!error) {
      const dates = {};
      data.forEach(reservation => {
        const startDate = new Date(reservation.date_debut);
        const endDate = reservation.date_fin ? new Date(reservation.date_fin) : startDate;
        
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
          const dateStr = formatDate(currentDate);
          dates[dateStr] = {
            marked: true,
            dotColor: reservation.status === 'pending' ? '#FFA500' : '#075E54',
            selected: true,
            selectedColor: reservation.status === 'pending' 
              ? 'rgba(255, 165, 0, 0.2)' 
              : 'rgba(7, 94, 84, 0.2)'
          };
          currentDate.setDate(currentDate.getDate() + 1);
        }
      });
      setMarkedDates(dates);
    }
    setLoading(false);
  };

  const handleMonthChange = (month) => {
    setCurrentDate(new Date(month.dateString));
  };

  const handleDayPress = (day) => {
    navigation.navigate('DayView', { date: day.dateString });
  };

  const handleAddAvailability = () => {
    navigation.navigate('AddAvailability');
  };

  const viewPendingReservations = () => {
    navigation.navigate('PendingReservations');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Ionicons name="arrow-back" size={24} color="#075E54" />
                </TouchableOpacity>
        <Text style={styles.title}>Mon Calendrier</Text>
        
        <View style={styles.actions}>
          <TouchableOpacity onPress={viewPendingReservations} style={styles.pendingButton}>
            <Feather name="clock" size={20} color="#FFA500" />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={handleAddAvailability} style={styles.createButton}>
            <Feather name="plus" size={20} color="#075E54" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#075E54" />
        </View>
      ) : (
        <Calendar
          current={formatDate(currentDate)}
          onDayPress={handleDayPress}
          onMonthChange={handleMonthChange}
          markedDates={markedDates}
          theme={calendarTheme}
          enableSwipeMonths={true}
        />
      )}
    </SafeAreaView>
  );
};

const calendarTheme = {
  calendarBackground: '#FFFFFF',
  selectedDayBackgroundColor: '#075E54',
  selectedDayTextColor: '#FFFFFF',
  todayTextColor: '#075E54',
  dayTextColor: '#2D4150',
  textDisabledColor: '#d9e1e8',
  dotColor: '#075E54',
  selectedDotColor: '#FFFFFF',
  arrowColor: '#075E54',
  monthTextColor: '#075E54',
  textMonthFontWeight: 'bold',
  textMonthFontSize: 16,
  textDayHeaderFontWeight: '400',
  textDayFontSize: 14,
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
    fontSize: 20,
    fontFamily: 'Poppins-SemiBold',
    color: '#075E54',
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  pendingButton: {
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    padding: 8,
    borderRadius: 20,
  },
  createButton: {
    backgroundColor: 'rgba(7, 94, 84, 0.1)',
    padding: 8,
    borderRadius: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default PrestataireCalendar;