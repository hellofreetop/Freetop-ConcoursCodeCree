import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TextInput, 
  TouchableOpacity, 
  Image,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
  Alert
} from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc,
  doc,
  updateDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ChatMarketplace = ({ route, navigation }) => {
  const { discussionId } = route.params;
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productInfo, setProductInfo] = useState(null);
  const [creatorInfo, setCreatorInfo] = useState(null);
  const [productImage, setProductImage] = useState(null);
  const flatListRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Récupérer l'ID utilisateur
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);

        // 2. Récupérer les infos de la discussion depuis Firestore
        const discussionRef = doc(db, 'discussionsMarketplace', discussionId);
        const discussionDoc = await getDoc(discussionRef);
        
        if (discussionDoc.exists()) {
          const discussionData = discussionDoc.data();
          const productId = discussionData.productId;
          const creatorId = discussionData.creatorId;

          // 3. Récupérer les infos du produit depuis Supabase
          const { data: productData, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

          if (productError) throw productError;
          setProductInfo(productData);

          // 4. Récupérer la première image du produit
          const { data: imageData, error: imageError } = await supabase
            .from('product_images')
            .select('url')
            .eq('product_id', productId)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (!imageError && imageData) {
            setProductImage(imageData.url);
          }

          // 5. Récupérer les infos du créateur depuis Supabase
          const { data: creatorData, error: creatorError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', creatorId)
            .single();

          if (creatorError) throw creatorError;
          setCreatorInfo(creatorData);
        }

        // 6. Charger les messages
        loadMessages();
      } catch (error) {
        console.error('Error fetching data:', error);
        Alert.alert('Erreur', "Impossible de charger les données du chat");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [discussionId]);

  const loadMessages = () => {
    const messagesRef = collection(db, 'messagesMarketplace');
    const q = query(
      messagesRef,
      where('discussionId', '==', discussionId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const messagesData = [];
      querySnapshot.forEach((doc) => {
        messagesData.push({ id: doc.id, ...doc.data() });
      });

      setMessages(messagesData);
      markMessagesAsRead();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });

    return unsubscribe;
  };

  const markMessagesAsRead = async () => {
    const discussionRef = doc(db, 'discussionsMarketplace', discussionId);
    await updateDoc(discussionRef, {
      unreadCount: 0
    });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !userId) return;

    try {
      await addDoc(collection(db, 'messagesMarketplace'), {
        discussionId,
        text: newMessage,
        senderId: userId,
        createdAt: new Date(),
        isRead: false
      });

      const discussionRef = doc(db, 'discussionsMarketplace', discussionId);
      await updateDoc(discussionRef, {
        lastMessage: newMessage,
        lastMessageTime: new Date(),
        lastMessageSender: userId
      });

      setNewMessage('');
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Erreur', "Impossible d'envoyer le message");
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.senderId === userId;
    
    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.otherMessage
      ]}>
        <Text style={[
          styles.messageText,
          isMe ? styles.myMessageText : styles.otherMessageText
        ]}>
          {item.text}
        </Text>
        <Text style={[
          styles.timeText,
          isMe ? styles.myTimeText : styles.otherTimeText
        ]}>
          {new Date(item.createdAt?.toDate()).toLocaleTimeString('fr-FR', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </Text>
      </View>
    );
  };

  if (loading || !productInfo || !creatorInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#075E54" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar 
        barStyle="light-content" 
        translucent={true} 
        backgroundColor="#075E54"
      />
      
      {/* AppBar avec les infos du produit et du créateur */}
      <View style={[styles.appBar, { paddingTop: insets.top }]}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.productInfo}>
          <Image 
            source={{ uri: productImage  }} 
            style={styles.productImage}
          />
          <View style={styles.productText}>
            <Text 
              style={[styles.productTitle, { fontFamily: 'Poppins-SemiBold' }]}
              numberOfLines={1}
            >
              {productInfo.title}
            </Text>
            <View style={styles.priceAddressRow}>
              <Text style={[styles.priceText, { fontFamily: 'Poppins-Medium' }]}>
                {parseFloat(productInfo.price).toFixed(2)} Fcfa
              </Text>
              <Text 
                style={[styles.addressText, { fontFamily: 'Poppins-Regular' }]}
                numberOfLines={1}
              >
                {creatorInfo.address || 'Adresse non spécifiée'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 60 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={[styles.input, { fontFamily: 'Poppins-Regular' }]}
            placeholder="Écrire un message..."
            placeholderTextColor="#999"
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity 
            style={styles.sendButton}
            onPress={handleSendMessage}
            disabled={!newMessage.trim()}
          >
            <Feather 
              name="send" 
              size={24} 
              color={newMessage.trim() ? '#075E54' : '#ccc'} 
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    top: -20,
    paddingBottom: 10,
    backgroundColor: '#075E54',
  },
  backButton: {
    marginRight: 15,
  },
  productInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  productImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#fff',
  },
  productText: {
    flex: 1,
  },
  productTitle: {
    fontSize: 16,
    color: '#fff',
  },
  priceAddressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceText: {
    fontSize: 14,
    color: '#fff',
    marginRight: 10,
  },
  addressText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  messagesContent: {
    padding: 15,
    paddingBottom: 80,
  },
  messageContainer: {
    maxWidth: '80%',
    marginBottom: 15,
    padding: 12,
    borderRadius: 12,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#075E54',
    borderTopRightRadius: 0,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderTopLeftRadius: 0,
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  timeText: {
    fontSize: 10,
    marginTop: 5,
    textAlign: 'right',
  },
  myTimeText: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherTimeText: {
    color: '#999',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingBottom: 30,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 10,
  },
});

export default ChatMarketplace;