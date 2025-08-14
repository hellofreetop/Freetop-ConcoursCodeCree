import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';

const ChatHeader = ({ otherUser, isTyping, onBack }) => {
  const [userInfo, setUserInfo] = useState({
    name: otherUser.name,
    avatar: otherUser.avatar,
    online: false
  });

  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, photo_url, online_mark, phone')
          .eq('id', otherUser.id)
          .single();

        if (data) {
          setUserInfo({
            name: data.full_name || otherUser.name,
            avatar: data.photo_url || otherUser.avatar,
            online: data.online_mark === true,
            phone: data.phone
          });
        }
      } catch (error) {
        console.error("Error fetching user info:", error);
      }
    };

    fetchUserInfo();
  }, [otherUser.id]);

  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#1A202C" />
      </TouchableOpacity>
      
      <View style={styles.userInfo}>
        <View style={styles.avatarContainer}>
          <Image
            source={userInfo.avatar ? { uri: userInfo.avatar } : require('../../../assets/default-avatar.png')}
            style={styles.avatar}
          />
          {userInfo.online && <View style={styles.onlineIndicator} />}
        </View>
        
        <View style={styles.textContainer}>
          <Text style={styles.userName} numberOfLines={1}>
            {userInfo.name}
          </Text>
          {isTyping ? (
            <Text style={styles.typingText}>en train d'écrire...</Text>
          ) : (
            <Text style={styles.statusText}>
              {userInfo.online ? 'En ligne' : 'Hors ligne'}
            </Text>
          )}
        </View>
      </View>
      
      {userInfo.phone && (
        <TouchableOpacity 
          onPress={() => Linking.openURL(`tel:${userInfo.phone}`)}
          style={styles.callButton}
        >
          <Ionicons name="call-outline" size={24} color="#075E54" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#075E54',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#075E54',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 16,
    fontFamily: 'Trebuchet MS',
    color: '#1A202C',
    marginBottom: 2,
  },
  statusText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#718096',
  },
  typingText: {
    fontSize: 13,
    fontFamily: 'Inter-Italic',
    color: '#075E54',
  },
  callButton: {
    padding: 8,
    marginLeft: 8,
    backgroundColor: '#F0FFF4',
    borderRadius: 20,
  },
});

export default ChatHeader;