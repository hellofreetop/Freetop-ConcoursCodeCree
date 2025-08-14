import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../lib/supabase';

export default function NotificationSetup() {
  useEffect(() => {
    const registerForPushNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') return;

      const token = (await Notifications.getExpoPushTokenAsync()).data;
      const userId = await AsyncStorage.getItem('userId');
      
      // Enregistrer le token dans Supabase
      await supabase
        .from('user_push_tokens')
        .upsert({ 
          user_id: userId, 
          expo_push_token: token 
        }, { 
          onConflict: 'user_id' 
        });
    };

    registerForPushNotifications();
  }, []);

  return null;
}