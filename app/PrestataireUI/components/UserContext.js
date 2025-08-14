import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('No authenticated user');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .single();

      await AsyncStorage.setItem('userId', authUser.id);
      setUser(profile);
    } catch (error) {
      console.error('Failed to load user:', error);
      await AsyncStorage.removeItem('userId');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUser(); }, []);

  return (
    <UserContext.Provider value={{ user, loading, refresh: loadUser }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) throw new Error('useUser must be used within UserProvider');
  return context;
};