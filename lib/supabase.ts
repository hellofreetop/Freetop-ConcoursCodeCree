import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
const supabaseUrl = 'https://tkkkbmkwzekevwnnxwpk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRra2tibWt3emVrZXZ3bm54d3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIyMjE4MTcsImV4cCI6MjA2Nzc5NzgxN30.zZGNwckT0eH4DImRV94_M-TIQraenxpPFar3zSymvLc';

export const supabase = createClient(supabaseUrl, supabaseKey,  {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});
