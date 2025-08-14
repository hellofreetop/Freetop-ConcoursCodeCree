import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SectionList,
  Image,
  Alert,
  Vibration,
  KeyboardAvoidingView,
  Platform,
  Clipboard,
  Dimensions,
  Pressable,
  Animated,
  Easing,
  Keyboard,
  PanResponder
} from 'react-native';
import { Ionicons, Feather, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ChatHeader from './components/ChatHeader';
import MediaViewer from './components/MediaViewer';
import { useFocusEffect } from '@react-navigation/native';

const { width, height } = Dimensions.get('window');

// Sons de notification
const SOUNDS = {
  SEND: require('../../assets/sounds/user_send.mp3'),
  RECEIVE: require('../../assets/sounds/user_receive.wav'),
  TYPING: require('../../assets/sounds/PreventRemoveContext.mp3'),
  CANCEL: require('../../assets/sounds/user_cancel.wav'),
};

const ChatScreen = ({ route, navigation }) => {
  const { discussionId: initialDiscussionId, otherUser } = route.params;
  const [discussionId, setDiscussionId] = useState(initialDiscussionId);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [recording, setRecording] = useState(null);
  const [senderId, setSenderId] = useState(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [currentPlayingAudio, setCurrentPlayingAudio] = useState(null);
  const [mediaViewerVisible, setMediaViewerVisible] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [editingMessage, setEditingMessage] = useState(null);
  const [unreadMarkerIndex, setUnreadMarkerIndex] = useState(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingPaused, setRecordingPaused] = useState(false);
  const [lastSeenMessage, setLastSeenMessage] = useState(null);
  
  const sectionListRef = useRef();
  const soundRef = useRef(null);
  const typingSoundRef = useRef(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const scrollY = useRef(new Animated.Value(0)).current;
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const keyboardHeight = useRef(0);
  const inputRef = useRef(null);
  const recordingInterval = useRef(null);
  const lastMessageRef = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 50) {
          setSelectedMessage(null);
        }
      },
    })
  ).current;

  // Initialisation
  useEffect(() => {
    const init = async () => {
      const id = await AsyncStorage.getItem('userId');
      setSenderId(id);

      if (!initialDiscussionId) {
        await createDiscussion();
      } else {
        await loadMessages();
        setupTypingListener();
      }

      setupConnectionListener();
      
      // Charger les sons
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      
      // Précharger les sons
      const { sound: typingSound } = await Audio.Sound.createAsync(SOUNDS.TYPING);
      typingSoundRef.current = typingSound;
    };

    init();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (typingSoundRef.current) {
        typingSoundRef.current.unloadAsync();
      }
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  // Écouteur de scroll pour le bouton de scroll vers le bas
  useEffect(() => {
    const listener = scrollY.addListener(({ value }) => {
      // Afficher le bouton si l'utilisateur a scrollé vers le haut
      setShowScrollToBottom(value < -height);
    });

    return () => scrollY.removeListener(listener);
  }, []);

  // Écouteur de clavier
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        keyboardHeight.current = e.endCoordinates.height;
        scrollToBottom();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        keyboardHeight.current = 0;
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  // Marquage des messages comme lus quand l'utilisateur voit le chat
  useFocusEffect(
    React.useCallback(() => {
      if (messages.length > 0 && senderId) {
        markMessagesAsRead(messages);
        setLastSeenMessage(messages[messages.length - 1].id);
      }
    }, [messages, senderId])
  );

  // Jouer un son
  const playSound = async (soundType) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }
      
      const { sound } = await Audio.Sound.createAsync(soundType);
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.error("Erreur lecture son:", error);
    }
  };

  // Création discussion
  const createDiscussion = async () => {
    try {
      const currentUserId = await AsyncStorage.getItem('userId');
      if (!currentUserId || !otherUser?.id) return;

      const participants = [currentUserId, otherUser.id].sort();
      const discussionRef = doc(collection(db, 'discussions'));
      
      const discussionData = {
        participants,
        created_at: serverTimestamp(),
        last_message: null,
        participants_info: {
          [currentUserId]: {
            name: await AsyncStorage.getItem('userName'),
            avatar: await AsyncStorage.getItem('userAvatar')
          },
          [otherUser.id]: {
            name: otherUser.name,
            avatar: otherUser.avatar
          }
        },
        unread: {
          [currentUserId]: 0,
          [otherUser.id]: 0
        },
        typing: {
          [currentUserId]: false,
          [otherUser.id]: false
        },
        last_seen: {
          [currentUserId]: null,
          [otherUser.id]: null
        }
      };

      await setDoc(discussionRef, discussionData);
      setDiscussionId(discussionRef.id);
      await loadMessages();
      setupTypingListener();
    } catch (error) {
      console.error("Erreur création discussion:", error);
      Alert.alert("Erreur", "Impossible de créer la discussion");
    }
  };

  // Écouteur de connexion
  const setupConnectionListener = () => {
    return NetInfo.addEventListener(state => {
      const wasOffline = !isOnline && state.isConnected;
      setIsOnline(state.isConnected);
      
      if (wasOffline) {
        syncOfflineMessages();
      }
    });
  };

  // Écouteur de saisie
  const setupTypingListener = () => {
    if (!discussionId) return;

    const docRef = doc(db, 'discussions', discussionId);
    return onSnapshot(docRef, (doc) => {
      const data = doc.data();
      if (data?.typing) {
        const isTyping = data.typing[otherUser.id];
        setOtherUserTyping(isTyping);
        
        // Jouer le son de typing si l'autre utilisateur tape
        if (isTyping && typingSoundRef.current) {
          typingSoundRef.current.playAsync();
        }
      }
    });
  };

  // Gestion saisie utilisateur
  const handleTextChange = (text) => {
    setText(text);
    updateTypingStatus(!!text);
  };

  const updateTypingStatus = (typing) => {
    if (!discussionId || !senderId) return;

    setIsTyping(typing);
    updateDoc(doc(db, 'discussions', discussionId), {
      [`typing.${senderId}`]: typing
    });
  };

  // Chargement messages
  const loadMessages = async () => {
    if (!discussionId) return;

    const q = query(
      collection(db, 'discussions', discussionId, 'messages'),
      orderBy('created_at', 'asc')
    );

    return onSnapshot(q, (snapshot) => {
      const serverMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        synced: true
      }));

      // Trouver l'index du premier message non lu de l'autre utilisateur
      const firstUnreadIndex = serverMessages.findIndex(
        m => m.sender_id === otherUser.id && !m.is_read
      );
      
      setUnreadMarkerIndex(firstUnreadIndex !== -1 ? firstUnreadIndex : null);
      
      // Jouer le son de réception si nouveau message reçu de l'autre utilisateur
      if (serverMessages.length > messages.length && 
          serverMessages[serverMessages.length - 1].sender_id === otherUser.id) {
        playSound(SOUNDS.RECEIVE);
      }
      
      setMessages(serverMessages);
      scrollToBottom();
    });
  };

  // Scroll vers le bas
  const scrollToBottom = (animated = true) => {
    if (sectionListRef.current && messages.length > 0) {
      setTimeout(() => {
        sectionListRef.current.scrollToLocation({
          animated,
          sectionIndex: 0,
          itemIndex: messages.length - 1,
          viewOffset: 50
        });
      }, 100);
    }
  };

  // Marquage messages comme lus
  const markMessagesAsRead = async (messagesToMark) => {
    if (!discussionId || !senderId) return;

    const unreadMessages = messagesToMark.filter(
      m => m.sender_id !== senderId && !m.is_read
    );

    if (unreadMessages.length > 0) {
      try {
        const batch = unreadMessages.map(msg => 
          updateDoc(doc(db, 'discussions', discussionId, 'messages', msg.id), {
            is_read: true
          })
        );

        await Promise.all(batch);
        
        await updateDoc(doc(db, 'discussions', discussionId), {
          [`unread.${senderId}`]: 0,
          [`last_seen.${senderId}`]: serverTimestamp()
        });
      } catch (error) {
        console.error("Erreur marquage messages lus:", error);
      }
    }
  };

  // Envoi message texte
  const sendTextMessage = async () => {
    if ((!text.trim() && !replyingTo && !editingMessage) || !senderId || !discussionId) return;

    if (editingMessage) {
      await updateMessage(editingMessage.id, text);
      setEditingMessage(null);
      setText('');
      return;
    }

    const newMessage = {
      id: `local_${Date.now()}`,
      type: 'text',
      sender_id: senderId,
      content: text,
      is_read: false,
      created_at: isOnline ? serverTimestamp() : null,
      synced: false,
      reply_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        type: replyingTo.type,
        sender_id: replyingTo.sender_id
      } : null
    };

    // Mise à jour optimiste
    setMessages(prev => [...prev, newMessage]);
    setText('');
    setReplyingTo(null);
    updateTypingStatus(false);
    scrollToBottom();

    // Jouer le son d'envoi
    playSound(SOUNDS.SEND);

    if (isOnline) {
      await sendMessageToServer({
        type: 'text',
        content: text,
        reply_to: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          type: replyingTo.type,
          sender_id: replyingTo.sender_id
        } : null
      }, newMessage);
    } else {
      await saveToCache([...messages, newMessage]);
    }

    await updateLastMessage(text || "📎 Pièce jointe");
  };

  // Mise à jour d'un message existant
  const updateMessage = async (messageId, newContent) => {
    try {
      // Mise à jour optimiste
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, content: newContent, edited: true } : m
      ));

      if (isOnline) {
        await updateDoc(doc(db, 'discussions', discussionId, 'messages', messageId), {
          content: newContent,
          edited: true,
          updated_at: serverTimestamp()
        });
      } else {
        await saveToCache(messages.map(m => 
          m.id === messageId ? { ...m, content: newContent, edited: true } : m
        ));
      }
    } catch (error) {
      console.error("Erreur mise à jour message:", error);
      Alert.alert("Erreur", "Impossible de modifier le message");
    }
  };

  // Envoi au serveur
  const sendMessageToServer = async (messageData, localMessage) => {
    try {
      const docRef = await addDoc(
        collection(db, 'discussions', discussionId, 'messages'), 
        {
          ...messageData,
          sender_id: senderId,
          is_read: false,
          created_at: serverTimestamp()
        }
      );

      // Mise à jour avec l'ID serveur
      setMessages(prev => prev.map(m => 
        m.id === localMessage.id ? { 
          ...m, 
          id: docRef.id, 
          synced: true,
          created_at: serverTimestamp()
        } : m
      ));
    } catch (error) {
      console.error("Erreur envoi message:", error);
      setMessages(prev => prev.filter(m => m.id !== localMessage.id));
    }
  };

  // Mise à jour dernier message
  const updateLastMessage = async (content) => {
    if (!discussionId) return;
    
    try {
      await updateDoc(doc(db, 'discussions', discussionId), {
        last_message: {
          content: content.length > 30 ? `${content.substring(0, 30)}...` : content,
          sent_at: serverTimestamp(),
          sender_id: senderId
        },
        [`unread.${otherUser.id}`]: increment(1)
      });
    } catch (error) {
      console.error("Erreur mise à jour dernier message:", error);
    }
  };

  // Sélection multiple de médias
  const handleMultipleMediaSelection = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setSelectedImages(result.assets);
        setMediaViewerVisible(true);
      }
    } catch (error) {
      Alert.alert("Erreur", "Impossible d'accéder à la galerie");
    }
  };

  // Upload multiple de médias
  const handleMultipleMediaUpload = async (selectedImagesWithCaptions) => {
    if (!senderId || !discussionId) return;

    const newMessages = selectedImagesWithCaptions.map(({ uri, caption }) => ({
      id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'image',
      sender_id: senderId,
      content: caption || '',
      localUri: uri,
      is_read: false,
      created_at: isOnline ? serverTimestamp() : null,
      synced: false,
      reply_to: replyingTo ? {
        id: replyingTo.id,
        content: replyingTo.content,
        type: replyingTo.type,
        sender_id: replyingTo.sender_id
      } : null
    }));

    setMessages(prev => [...prev, ...newMessages]);
    setReplyingTo(null);
    setSelectedImages([]);
    setMediaViewerVisible(false);
    scrollToBottom();

    // Jouer le son d'envoi
    playSound(SOUNDS.SEND);

    if (isOnline) {
      await Promise.all(
        selectedImagesWithCaptions.map(({ uri, caption }, index) => 
          uploadMediaToServer(uri, caption || '', newMessages[index])
        )
      );
    } else {
      await saveToCache([...messages, ...newMessages]);
    }

    await updateLastMessage("📷 Photos");
  };

  // Upload média vers Supabase
  const uploadMediaToServer = async (fileUri, caption, localMessage) => {
    try {
      const fileExtension = fileUri.split('.').pop();
      const fileName = `image_${Date.now()}.${fileExtension}`;
      const filePath = `discussions/${discussionId}/${fileName}`;

      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const bytes = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

      const { error } = await supabase.storage
        .from('messages')
        .upload(filePath, bytes, {
          contentType: `image/${fileExtension === 'png' ? 'png' : 'jpeg'}`,
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(filePath);

      await sendMessageToServer({
        type: 'image',
        content: caption,
        file_url: [publicUrl],
        reply_to: localMessage.reply_to
      }, localMessage);

    } catch (error) {
      console.error("Erreur upload média:", error);
      setMessages(prev => prev.filter(m => m.id !== localMessage.id));
      Alert.alert("Erreur", `Échec de l'envoi: ${error.message}`);
    }
  };

  // Gestion audio
  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);
      setRecordingPaused(false);
      Vibration.vibrate(50);
      
      // Démarrer le compteur
      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement");
    }
  };

  const pauseRecording = async () => {
    if (!recording) return;
    
    try {
      await recording.pauseAsync();
      setRecordingPaused(true);
      clearInterval(recordingInterval.current);
    } catch (error) {
      console.error("Erreur pause enregistrement:", error);
    }
  };

  const resumeRecording = async () => {
    if (!recording) return;
    
    try {
      await recording.startAsync();
      setRecordingPaused(false);
      
      // Redémarrer le compteur
      recordingInterval.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Erreur reprise enregistrement:", error);
    }
  };

  const stopRecording = async (send = true) => {
    if (!recording || !senderId || !discussionId) return;

    try {
      clearInterval(recordingInterval.current);
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording.getURI();
      setRecording(null);
      setIsRecording(false);
      setRecordingDuration(0);

      if (!send) {
        playSound(SOUNDS.CANCEL);
        return;
      }

      const { sound: tempSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false }
      );
      const status = await tempSound.getStatusAsync();
      await tempSound.unloadAsync();

      const duration = status.isLoaded ? Math.floor(status.durationMillis / 1000) : 1;

      const newMessage = {
        id: `local_${Date.now()}`,
        type: 'audio',
        sender_id: senderId,
        content: '',
        localAudioUri: uri,
        duration,
        is_read: false,
        created_at: isOnline ? serverTimestamp() : null,
        synced: false,
        reply_to: replyingTo ? {
          id: replyingTo.id,
          content: replyingTo.content,
          type: replyingTo.type,
          sender_id: replyingTo.sender_id
        } : null
      };

      setMessages(prev => [...prev, newMessage]);
      setReplyingTo(null);
      scrollToBottom();

      // Jouer le son d'envoi
      playSound(SOUNDS.SEND);

      if (isOnline) {
        await uploadAudioToServer(uri, duration, newMessage);
      } else {
        await saveToCache([...messages, newMessage]);
      }

      await updateLastMessage("🎤 Message audio");
    } catch (error) {
      console.error("Erreur enregistrement:", error);
    }
  };

  const uploadAudioToServer = async (fileUri, duration, localMessage) => {
    try {
      const fileName = `audio_${Date.now()}.m4a`;
      const filePath = `discussions/${discussionId}/${fileName}`;

      const fileContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const bytes = Uint8Array.from(atob(fileContent), c => c.charCodeAt(0));

      const { error } = await supabase.storage
        .from('messages')
        .upload(filePath, bytes, {
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('messages')
        .getPublicUrl(filePath);

      await sendMessageToServer({
        type: 'audio',
        file_url: [publicUrl],
        duration,
        reply_to: localMessage.reply_to,
      }, localMessage);

    } catch (error) {
      console.error("Erreur upload audio:", error);
      setMessages(prev => prev.filter(m => m.id !== localMessage.id));
      Alert.alert("Erreur", `Échec d'envoi audio: ${error.message}`);
    }
  };

  // Lecture audio
  const playAudio = async (audioId, uri) => {
    try {
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      setCurrentPlayingAudio(audioId);

      // Vérifier si c'est une URI locale ou distante
      const source = uri.startsWith('file://') ? 
        { uri } : 
        { uri: `${uri}?${Date.now()}` }; // Ajout d'un timestamp pour éviter le cache

      const { sound } = await Audio.Sound.createAsync(
        source,
        { shouldPlay: true }
      );

      soundRef.current = sound;
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate(status => {
        if (status.isLoaded) {
          const progress = status.positionMillis / status.durationMillis;
          setAudioProgress(progress);
          setAudioDuration(status.durationMillis / 1000);
          
          // Animation de la barre de progression
          Animated.timing(progressAnim, {
            toValue: progress,
            duration: 100,
            useNativeDriver: false,
            easing: Easing.linear
          }).start();

          if (status.didJustFinish) {
            setCurrentPlayingAudio(null);
            setAudioProgress(0);
            progressAnim.setValue(0);
          }
        }
      });

    } catch (error) {
      console.error("Erreur lecture audio:", error);
      Alert.alert("Erreur", "Impossible de lire le message audio");
    }
  };

  const stopAudio = async () => {
    if (soundRef.current) {
      await soundRef.current.stopAsync();
      await soundRef.current.unloadAsync();
      soundRef.current = null;
      setCurrentPlayingAudio(null);
      setAudioProgress(0);
      progressAnim.setValue(0);
    }
  };

  // Sauvegarde cache
  const saveToCache = async (messagesToCache) => {
    try {
      await AsyncStorage.setItem(
        `chat_${discussionId}_messages`, 
        JSON.stringify(messagesToCache.filter(m => !m.synced))
      );
    } catch (error) {
      console.log("Erreur sauvegarde cache:", error);
    }
  };

  // Synchronisation messages offline
  const syncOfflineMessages = async () => {
    try {
      const cached = await AsyncStorage.getItem(`chat_${discussionId}_messages`);
      const unsynced = cached ? JSON.parse(cached) : [];

      for (const message of unsynced) {
        try {
          if (message.type === 'text') {
            await sendMessageToServer({
              type: 'text',
              content: message.content,
              reply_to: message.reply_to
            }, message);
          } 
          else if (message.type === 'image' && message.localUri) {
            await uploadMediaToServer(message.localUri, message.content, message);
          }
          else if (message.type === 'audio' && message.localAudioUri) {
            await uploadAudioToServer(message.localAudioUri, message.duration, message);
          }
        } catch (error) {
          console.error(`Erreur synchro message ${message.id}:`, error);
        }
      }

      await AsyncStorage.removeItem(`chat_${discussionId}_messages`);
    } catch (error) {
      console.error("Erreur synchro messages:", error);
    }
  };

  // Répondre à un message
  const handleReply = (message) => {
    setReplyingTo(message);
    setSelectedMessage(null);
  };

  // Modifier un message
  const handleEdit = (message) => {
    setEditingMessage(message);
    setText(message.content);
    setSelectedMessage(null);
    inputRef.current?.focus();
  };

  // Supprimer un message
  const deleteMessage = async (messageId) => {
    try {
      // Mise à jour optimiste
      setMessages(prev => prev.map(m => 
        m.id === messageId ? { ...m, deleted: true } : m
      ));
      
      if (isOnline) {
        await updateDoc(doc(db, 'discussions', discussionId, 'messages', messageId), {
          deleted: true,
          deleted_at: serverTimestamp()
        });
      } else {
        await saveToCache(messages.map(m => 
          m.id === messageId ? { ...m, deleted: true } : m
        ));
      }
    } catch (error) {
      console.error("Erreur suppression message:", error);
      Alert.alert("Erreur", "Impossible de supprimer le message");
    }
  };

  // Copier le message
  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    Alert.alert("Copié", "Le message a été copié dans le presse-papiers");
  };

  // Ouvrir le visualiseur d'images
  const openMediaViewer = (images, index = 0) => {
    setSelectedImages(images);
    setCurrentImageIndex(index);
    setMediaViewerVisible(true);
  };

  // Naviguer vers un message
  const navigateToMessage = (messageId) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      sectionListRef.current?.scrollToLocation({
        animated: true,
        sectionIndex: 0,
        itemIndex: index,
        viewOffset: 50
      });
    }
  };

  // Grouper les messages par date
  const groupMessagesByDate = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const grouped = messages.reduce((acc, message, index) => {
      if (message.deleted) return acc;
      
      // Ne pas afficher de date pour les messages non synchronisés
      const messageDate = message.synced ? (message.created_at?.toDate?.() || new Date(message.created_at)) : null;
      
      const dateKey = messageDate ? 
        (messageDate < today ? 
          (messageDate < yesterday ? 
            messageDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) : 
            'Hier') : 
          'Aujourd\'hui') : 
        'En attente';
      
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      
      // Ajouter un marqueur pour les nouveaux messages non lus de l'autre utilisateur
      if (unreadMarkerIndex === index && messages[index].sender_id === otherUser.id) {
        acc[dateKey].push({ id: `unread_marker_${index}`, type: 'unread_marker' });
      }
      
      acc[dateKey].push(message);
      return acc;
    }, {});
    
    return Object.entries(grouped).map(([title, data]) => ({
      title,
      data
    }));
  };

  // Formater la durée d'enregistrement
  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Formater le temps audio
  const formatAudioTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Formater la date/heure
  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Rendu des sections de date
  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.dateHeader}>
      <Text style={styles.dateText}>{title}</Text>
    </View>
  );

  // Rendu des messages
  const renderMessage = ({ item, index, section }) => {
    if (item.type === 'unread_marker') {
      return (
        <View style={styles.unreadMarkerContainer}>
          <View style={styles.unreadMarkerLine} />
          <Text style={styles.unreadMarkerText}>Nouveaux messages</Text>
          <View style={styles.unreadMarkerLine} />
        </View>
      );
    }

    if (item.deleted) {
      return (
        <View style={styles.deletedMessageContainer}>
          <Text style={styles.deletedMessageText}>
            {item.sender_id === senderId ? 'Vous avez supprimé ce message' : 'Ce message a été supprimé'}
          </Text>
        </View>
      );
    }

    const isMe = item.sender_id === senderId;
    const isRead = item.is_read || isMe;
    const isLastMessage = messages.length > 0 && item.id === messages[messages.length - 1].id;
    const isSeen = isLastMessage && isMe && isRead;

    return (
      <View 
        style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.otherMessage,
          !item.synced && styles.unsyncedMessage
        ]}
      >
        {item.reply_to && (
          <TouchableOpacity 
            style={[
              styles.replyContainer,
              isMe ? styles.myReply : styles.otherReply
            ]}
            onPress={() => {
              const originalMessage = messages.find(m => m.id === item.reply_to.id);
              if (originalMessage) {
                navigateToMessage(originalMessage.id);
              }
            }}
          >
            <Text style={styles.replySender}>
              {item.reply_to.sender_id === senderId ? 'Vous' : otherUser.name}
            </Text>
            {item.reply_to.type === 'text' && (
              <Text style={styles.replyContent} numberOfLines={1}>
                {item.reply_to.content}
              </Text>
            )}
            {item.reply_to.type === 'image' && (
              <Text style={styles.replyContent}>📷 Photo</Text>
            )}
            {item.reply_to.type === 'audio' && (
              <Text style={styles.replyContent}>🎤 Message audio</Text>
            )}
          </TouchableOpacity>
        )}

        {item.type === 'text' && (
          <Pressable
            onLongPress={() => {
              setSelectedMessage(item);
              Vibration.vibrate(50);
            }}
          >
            <Text style={styles.messageText}>{item.content}</Text>
          </Pressable>
        )}
        
        {item.type === 'image' && (
          <Pressable
            onLongPress={() => {
              setSelectedMessage(item);
              Vibration.vibrate(50);
            }}
            onPress={() => {
              const imageUri = item.file_url ? item.file_url[0] : item.localUri;
              openMediaViewer([{ uri: imageUri }], 0);
            }}
          >
            <Image
              source={{ uri: item.file_url ? item.file_url[0] : item.localUri }}
              style={styles.messageImage}
            />
            {item.content ? (
              <Text style={styles.captionText}>{item.content}</Text>
            ) : null}
          </Pressable>
        )}
        
        {item.type === 'audio' && (
          <Pressable
            onLongPress={() => {
              setSelectedMessage(item);
              Vibration.vibrate(50);
            }}
          >
            <View style={styles.audioBubble}>
              <TouchableOpacity 
                onPress={() => 
                  currentPlayingAudio === item.id 
                    ? stopAudio() 
                    : playAudio(item.id, item.file_url ? item.file_url[0] : item.localAudioUri)
                }
                style={styles.playButton}
              >
                <Feather 
                  name={currentPlayingAudio === item.id ? "pause-circle" : "play-circle"} 
                  size={20} 
                  color="white" 
                />
              </TouchableOpacity>
              
              <View style={styles.audioProgressContainer}>
                <View style={[
                  styles.audioProgressBackground,
                  currentPlayingAudio === item.id && { backgroundColor: 'rgba(255,255,255,0.3)' }
                ]} />
                {currentPlayingAudio === item.id && (
                  <Animated.View 
                    style={[
                      styles.audioProgressBar,
                      { width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%']
                      })}
                    ]} 
                  />
                )}
              </View>
              
              <View style={styles.audioTimeContainer}>
                <Text style={styles.audioTimeText}>
                  {formatAudioTime(currentPlayingAudio === item.id ? audioDuration * audioProgress : item.duration)}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
        
        <View style={styles.messageFooter}>
          {item.created_at && (
            <Text style={styles.messageTime}>
              {formatDateTime(item.created_at)}
              {item.edited && ' (modifié)'}
            </Text>
          )}
          {isSeen && (
            <Ionicons name="checkmark" color="rgba(255,255,255,0.7)" />
          )}
          {!item.synced && (
            <Ionicons 
              name="cloud-offline" 
              size={12} 
              color="rgba(255,255,255,0.7)" 
              style={styles.offlineIcon}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ChatHeader 
        otherUser={otherUser} 
        isTyping={otherUserTyping} 
        onBack={() => navigation.goBack()}
      />

      {!isOnline && (
        <View style={styles.offlineBar}>
          <Text style={styles.offlineText}>Mode hors ligne - Les messages seront envoyés lorsque vous serez reconnecté</Text>
        </View>
      )}

      <Animated.SectionList
        ref={sectionListRef}
        sections={groupMessagesByDate()}
        renderItem={renderMessage}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.messagesList}
        inverted={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={21}
        onContentSizeChange={() => scrollToBottom(false)}
        onLayout={() => scrollToBottom(false)}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            sectionListRef.current?.scrollToLocation({
              animated: true,
              sectionIndex: 0,
              itemIndex: index,
              viewOffset: 50
            });
          }, 100);
        }}
      />

      {showScrollToBottom && (
        <TouchableOpacity 
          style={styles.scrollToBottomButton}
          onPress={() => scrollToBottom()}
        >
          <Ionicons name="chevron-down" size={24} color="white" />
        </TouchableOpacity>
      )}

      {/* Zone de saisie avec KeyboardAvoidingView */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[isKeyboardVisible && { paddingBottom: keyboardHeight.current }]}>
        {replyingTo && (
          <View style={styles.replyPreview}>
            <View style={styles.replyPreviewContent}>
              <Text style={styles.replyPreviewText}>
                Réponse à {replyingTo.sender_id === senderId ? 'vous' : otherUser.name}
              </Text>
              <Text style={styles.replyPreviewMessage} numberOfLines={1}>
                {replyingTo.type === 'text' 
                  ? replyingTo.content 
                  : replyingTo.type === 'image' 
                    ? '📷 Photo'
                    : '🎤 Message audio'}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => setReplyingTo(null)}
              style={styles.cancelReply}
            >
              <Ionicons name="close" size={24} color="#E53E3E" />
            </TouchableOpacity>
          </View>
        )}

        {editingMessage && (
          <View style={styles.editingPreview}>
            <View style={styles.editingPreviewContent}>
              <Text style={styles.editingPreviewText}>
                Modification du message
              </Text>
              <Text style={styles.editingPreviewMessage} numberOfLines={1}>
                {editingMessage.content}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                setEditingMessage(null);
                setText('');
              }}
              style={styles.cancelEditing}
            >
              <Ionicons name="close" size={24} color="#E53E3E" />
            </TouchableOpacity>
          </View>
        )}

        {showAttachmentMenu && (
          <View style={styles.attachmentMenu}>
            <TouchableOpacity 
              style={styles.attachmentButton}
              onPress={() => handleMultipleMediaSelection()}
            >
              <Ionicons name="image" size={28} color="#075E54" />
              <Text style={styles.attachmentText}>Galerie</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.attachmentButton}
              onPress={() => handleMediaSelection('camera')}
            >
              <Ionicons name="camera" size={28} color="#075E54" />
              <Text style={styles.attachmentText}>Camera</Text>
            </TouchableOpacity>
          
          </View>
        )}

        {isRecording && (
          <View style={styles.recordingContainer}>
            <TouchableOpacity 
              onPress={() => stopRecording(false)}
              style={styles.recordingButton}
            >
              <Feather name="trash-2" size={24} color="#E53E3E" />
            </TouchableOpacity>
            
            <View style={styles.recordingIndicator}>
              <Text style={styles.recordingText}>
                {recordingPaused ? 'En pause' : 'Enregistrement...'} {formatRecordingTime(recordingDuration)}
              </Text>
              {recordingPaused ? (
                <TouchableOpacity 
                  onPress={resumeRecording}
                  style={styles.recordingControl}
                >
                  <Ionicons name="play" size={24} color="#075E54" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  onPress={pauseRecording}
                  style={styles.recordingControl}
                >
                  <Ionicons name="pause" size={24} color="#075E54" />
                </TouchableOpacity>
              )}
            </View>
            
            <TouchableOpacity 
              onPress={() => stopRecording(true)}
              style={styles.recordingButton}
            >
              <Feather name="send" size={24} color="#075E54" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity 
            onPress={() => setShowAttachmentMenu(!showAttachmentMenu)}
            style={styles.attachmentToggle}
          >
            <Feather 
              name={showAttachmentMenu ? "x" : "paperclip"} 
              size={22} 
              color="#075E54" 
            />
          </TouchableOpacity>

          <TextInput
            ref={inputRef}
            style={styles.input}
            value={text}
            onChangeText={handleTextChange}
            placeholder="Écrivez un message..."
            placeholderTextColor="#A0AEC0"
            onSubmitEditing={sendTextMessage}
            multiline
            onFocus={scrollToBottom}
          />

          {text ? (
            <TouchableOpacity 
              onPress={sendTextMessage}
              style={styles.sendButton}
            >
              <Feather name="send" size={23} color="white" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={startRecording}
              onLongPress={startRecording}
              style={styles.recordButton}
            >
              <Feather name="mic" size={24} color="white" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {selectedMessage && (
        <View 
          style={[
            styles.messageActions,
            isKeyboardVisible && { bottom: keyboardHeight.current + 60 }
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.actionsRow}>
            {selectedMessage.type === 'text' && (
              <TouchableOpacity 
                onPress={() => {
                  copyToClipboard(selectedMessage.content);
                  setSelectedMessage(null);
                }}
                style={styles.actionButton}
              >
                <Feather name="copy" size={24} color="#4A5568" />
                <Text style={styles.actionText}>Copier</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={() => {
                handleReply(selectedMessage);
              }}
              style={styles.actionButton}
            >
              <Feather name="corner-down-left" size={24} color="#4A5568" />
              <Text style={styles.actionText}>Répondre</Text>
            </TouchableOpacity>
            
            {selectedMessage.sender_id === senderId && selectedMessage.type === 'text' && (
              <TouchableOpacity 
                onPress={() => {
                  handleEdit(selectedMessage);
                }}
                style={styles.actionButton}
              >
                <Feather name="edit" size={24} color="#4A5568" />
                <Text style={styles.actionText}>Modifier</Text>
              </TouchableOpacity>
            )}
            {selectedMessage.sender_id === senderId && (
              <TouchableOpacity 
                onPress={() => {
                  deleteMessage(selectedMessage.id);
                  setSelectedMessage(null);
                }}
                style={[styles.actionButton]}
              >
                <Feather name="trash-2" size={24} color="#E53E3E" />
                <Text style={[styles.actionText, styles.deleteText]}>Supprimer</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {/* Barre de fermeture */}
          <View style={styles.closeBarContainer}>
            <View style={styles.closeBar} />
          </View>
        </View>
      )}

      <MediaViewer
        visible={mediaViewerVisible}
        images={selectedImages}
        currentIndex={currentImageIndex}
        onClose={() => setMediaViewerVisible(false)}
        onUpload={handleMultipleMediaUpload}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#e5ddd5',
  },
  offlineBar: {
    backgroundColor: '#E53E3E',
    padding: 8,
    alignItems: 'center',
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
  },
  messagesList: {
    padding: 15,
    paddingBottom: 120,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#075E54',
    borderBottomRightRadius: 0,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#222323a9',
    borderBottomLeftRadius: 0,
  },
  unsyncedMessage: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: '#CBD5E0',
  },
  deletedMessageContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.1)',
    padding: 10,
    borderRadius: 16,
    marginVertical: 10,
  },
  deletedMessageText: {
    color: '#718096',
    fontSize: 12,
    fontStyle: 'italic',
    fontFamily: 'Roboto-Regular',
  },
  unreadMarkerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 15,
  },
  unreadMarkerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#718096',
  },
  unreadMarkerText: {
    fontSize: 12,
    color: '#718096',
    marginHorizontal: 10,
    fontFamily: 'Roboto-Medium',
  },
  replyContainer: {
    padding: 8,
    borderLeftWidth: 3,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  myReply: {
    borderLeftColor: '#4FD1C5',
  },
  otherReply: {
    borderLeftColor: '#4299E1',
  },
  replySender: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
    fontFamily: 'Roboto-Medium',
  },
  replyContent: {
    fontSize: 12,
    color: 'white',
    opacity: 0.8,
    fontFamily: 'Roboto-Regular',
  },
  messageText: {
    color: 'white',
    fontSize: 16,
    fontFamily: 'Roboto-Regular',
    lineHeight: 22,
  },
  messageImage: {
    width: 250,
    height: 250,
    borderRadius: 12,
    marginBottom: 5,
  },
  captionText: {
    color: 'white',
    fontSize: 12,
    marginTop: 5,
    fontFamily: 'Roboto-Regular',
  },
  audioBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#4299E1',
    borderRadius: 25,
    minWidth: 180,
  },
  playButton: {
    marginRight: 10,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioProgressContainer: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginRight: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  audioProgressBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  audioProgressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'white',
  },
  audioTimeContainer: {
    minWidth: 50,
  },
  audioTimeText: {
    color: 'white',
    fontSize: 12,
    fontFamily: 'Roboto-Medium',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 5,
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Roboto-Regular',
  },
  seenText: {
    fontSize: 10,
    color: '#4FD1C5',
    marginLeft: 5,
    fontFamily: 'Roboto-Medium',
    fontStyle: 'italic',
  },
  offlineIcon: {
    marginLeft: 5,
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 15,
  },
  dateText: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: '500',
    backgroundColor: '#EDF2F7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontFamily: 'Roboto-Medium',
  },
  replyPreview: {
    backgroundColor: '#EDF2F7',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E0',
  },
  editingPreview: {
    backgroundColor: '#EDF2F7',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#CBD5E0',
  },
  replyPreviewContent: {
    flex: 1,
  },
  editingPreviewContent: {
    flex: 1,
  },
  replyPreviewText: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: 'bold',
    fontFamily: 'Roboto-Medium',
  },
  editingPreviewText: {
    fontSize: 12,
    color: '#4A5568',
    fontWeight: 'bold',
    fontFamily: 'Roboto-Medium',
  },
  replyPreviewMessage: {
    fontSize: 12,
    color: '#718096',
    fontFamily: 'Roboto-Regular',
  },
  editingPreviewMessage: {
    fontSize: 12,
    color: '#718096',
    fontFamily: 'Roboto-Regular',
  },
  cancelReply: {
    marginLeft: 10,
  },
  cancelEditing: {
    marginLeft: 10,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  input: {
    flex: 1,
    padding: 12,
    marginHorizontal: 10,
    backgroundColor: '#F7FAFC',
    borderRadius: 20,
    maxHeight: 100,
    fontSize: 16,
    color: '#2D3748',
    fontFamily: 'Roboto-Regular',
  },
  attachmentToggle: {
    marginLeft: 5,
    padding: 8,
  },
  sendButton: {
    backgroundColor: '#075E54',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#075E54',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentMenu: {
    backgroundColor: 'white',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  attachmentButton: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    width: width/3,
  },
  attachmentText: {
    marginTop: 5,
    fontSize: 12,
    color: '#4A5568',
    fontFamily: 'Roboto-Medium',
  },
  recordingContainer: {
    backgroundColor: 'white',
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
  },
  recordingButton: {
    padding: 10,
  },
  recordingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordingControl: {
    marginLeft: 10,
  },
  recordingText: {
    color: '#E53E3E',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 10,
    fontFamily: 'Roboto-Medium',
  },
  messageActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'white',
    paddingVertical: 15,
    borderTopWidth: 1,
    borderTopColor: '#EDF2F7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 5,
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  actionText: {
    fontSize: 12,
    color: '#4A5568',
    marginTop: 5,
    fontFamily: 'Roboto-Medium',
  },
  deleteText: {
    color: '#E53E3E',
  },
  closeBarContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  closeBar: {
    width: 40,
    height: 5,
    backgroundColor: '#CBD5E0',
    borderRadius: 3,
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 20,
    bottom: 80,
    backgroundColor: '#075E54',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
});

export default ChatScreen;