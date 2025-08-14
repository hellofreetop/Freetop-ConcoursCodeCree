import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Dimensions,
  StatusBar,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
  Alert
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const UserReviews = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { userId } = route.params;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const commentInputRef = useRef(null);

  useEffect(() => {
    fetchReviews();
    fetchCurrentUser();
  }, [userId]);

  const fetchCurrentUser = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, photo_url')
        .eq('id', currentUserId)
        .single();

      if (error) throw error;
      setCurrentUser(data);
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
  };

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('user_reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:profiles!user_reviews_reviewer_id_fkey (id, full_name, photo_url)
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      Alert.alert('Erreur', 'Impossible de charger les avis');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    try {
      if (!rating) {
        Alert.alert('Information', 'Veuillez donner une note');
        return;
      }

      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId) {
        Alert.alert('Erreur', 'Vous devez être connecté');
        return;
      }

      if (currentUserId === userId) {
        Alert.alert('Erreur', 'Vous ne pouvez pas vous noter vous-même');
        return;
      }

      setSubmitting(true);

      // Créer un nouvel avis (sans vérifier l'existence d'un avis précédent)
      const { error } = await supabase
        .from('user_reviews')
        .insert({
          reviewer_id: currentUserId,
          reviewed_id: userId,
          rating,
          comment
        });

      if (error) throw error;

      // Rafraîchir les avis
      await fetchReviews();
      setComment('');
      setRating(0);
      Keyboard.dismiss();
      Alert.alert('Succès', 'Votre avis a été enregistré');
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  const renderReviewItem = ({ item }) => (
    <View style={styles.reviewItem}>
      <View style={styles.reviewHeader}>
        {item.reviewer.photo_url ? (
          <Image source={{ uri: item.reviewer.photo_url }} style={styles.reviewerAvatar} />
        ) : (
          <View style={[styles.reviewerAvatar, styles.avatarPlaceholder]}>
            <Ionicons name="person" size={20} color="white" />
          </View>
        )}
        <View style={styles.reviewerInfo}>
          <Text style={styles.reviewerName}>{item.reviewer.full_name}</Text>
          <View style={styles.ratingContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <MaterialIcons
                key={star}
                name={star <= item.rating ? 'star' : 'star-border'}
                size={16}
                color="#F6AD55"
              />
            ))}
          </View>
        </View>
        <Text style={styles.reviewDate}>
          {moment(item.created_at).fromNow()}
        </Text>
      </View>
      {item.comment && (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      )}
    </View>
  );

  const renderRatingStars = () => {
    return (
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.ratingStars}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity
              key={star}
              onPress={() => {
                setRating(star);
                Keyboard.dismiss();
              }}
              activeOpacity={0.7}
            >
              <MaterialIcons
                name={star <= rating ? 'star' : 'star-border'}
                size={32}
                color="#F6AD55"
              />
            </TouchableOpacity>
          ))}
        </View>
      </TouchableWithoutFeedback>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="white" />
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#075E54" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Avis et notations</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {currentUser && currentUser.id !== userId && (
            <View style={styles.reviewForm}>
              <Text style={styles.sectionTitle}>Donnez votre avis</Text>
              {renderRatingStars()}
              
              <TextInput
                ref={commentInputRef}
                style={styles.commentInput}
                placeholder="Décrivez votre expérience (optionnel)"
                placeholderTextColor="#A0AEC0"
                multiline
                numberOfLines={4}
                value={comment}
                onChangeText={setComment}
                blurOnSubmit={true}
              />
              
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitReview}
                disabled={submitting || !rating}
              >
                {submitting ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    Publier votre avis
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.reviewsSection}>
            <Text style={styles.sectionTitle}>
              Avis ({reviews.length})
            </Text>
            
            {loading ? (
              <ActivityIndicator size="large" color="#075E54" style={styles.loader} />
            ) : reviews.length > 0 ? (
              <FlatList
                data={reviews}
                renderItem={renderReviewItem}
                keyExtractor={(item) => item.id.toString()}
                scrollEnabled={false}
                contentContainerStyle={styles.reviewsList}
              />
            ) : (
              <Text style={styles.noReviewsText}>Aucun avis pour le moment</Text>
            )}
          </View>
        </ScrollView>
      </View>
    </TouchableWithoutFeedback>
  );
};

// Les styles restent identiques à votre code précédent
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
  },
  content: {
    paddingBottom: 20,
  },
  reviewForm: {
    backgroundColor: 'white',
    padding: 20,
    marginBottom: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 16,
  },
  ratingStars: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  commentInput: {
    backgroundColor: '#F7FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    minHeight: 100,
    marginBottom: 20,
    textAlignVertical: 'top',
    fontSize: 16,
    color: '#4A5568',
  },
  submitButton: {
    backgroundColor: '#075E54',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  reviewsSection: {
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  reviewsList: {
    paddingBottom: 20,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2F7',
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#CBD5E0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    color: '#A0AEC0',
  },
  reviewComment: {
    fontSize: 15,
    color: '#4A5568',
    lineHeight: 22,
    marginLeft: 52,
  },
  noReviewsText: {
    textAlign: 'center',
    color: '#A0AEC0',
    marginVertical: 30,
    fontSize: 16,
  },
  loader: {
    marginVertical: 30,
  },
});


export default UserReviews;