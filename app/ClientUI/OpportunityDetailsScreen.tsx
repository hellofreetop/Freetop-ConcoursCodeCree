import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useRoute, useNavigation } from '@react-navigation/native';

export default function OpportunityDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { opportunityId } = route.params;
  const [opportunity, setOpportunity] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Récupérer l'opportunité
        const { data: oppData } = await supabase
          .from('opportunities')
          .select('*')
          .eq('id', opportunityId)
          .single();

        // Récupérer l'utilisateur
        const { data: userData } = await supabase
          .from('profiles')
          .select('full_name, photo_url')
          .eq('id', oppData.user_id)
          .single();

        setOpportunity(oppData);
        setUser(userData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [opportunityId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Chargement...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Image 
          source={{ uri: user.photo_url || require('../../assets/default-avatar.png') }} 
          style={styles.avatar}
        />
        <Text style={styles.userName}>{user.full_name}</Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.title}>{opportunity.title}</Text>
        <Text style={styles.description}>{opportunity.description}</Text>
        
        <View style={styles.details}>
          <Text style={styles.price}>
            Budget: {opportunity.price_min}Fcfa - {opportunity.price_max}Fcfa
          </Text>
          
          <Text style={styles.professions}>
            Professions: {opportunity.professions.join(', ')}
            {opportunity.other_jobs && `, ${opportunity.other_jobs}`}
          </Text>
          
          <Text style={styles.dates}>
            Valable du {new Date(opportunity.valid_from).toLocaleDateString()} 
            au {new Date(opportunity.valid_to).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  content: {
    marginTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#075E54',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  details: {
    marginTop: 20,
  },
  price: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 10,
  },
  professions: {
    fontSize: 16,
    marginBottom: 10,
    color: '#555',
  },
  dates: {
    fontSize: 14,
    color: '#777',
    fontStyle: 'italic',
  },
});