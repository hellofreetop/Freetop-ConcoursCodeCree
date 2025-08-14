import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Image, 
  StatusBar,
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ProfileMenuScreen = ({ navigation, route }) => {
  const { userData } = route.params || {};
  const avatarSource = userData?.photo_url 
    ? { uri: userData.photo_url } 
    : require('../../assets/default-avatar.png');

  // Menu items de base
  const baseMenuItems = [
    {
      title: "Profil professionnel",
      icon: "briefcase-outline",
      action: () => navigation.navigate('ProfessionalProfile', { userData })
    },
   
  ];

  // Ajout conditionnel de l'option Collections pour les prestataires
  const menuItems = userData?.type_compte === 'Prestataire'
    ? [
        ...baseMenuItems,
        {
          title: "Vos collections",
          icon: "folder-outline",
          action: () => navigation.navigate('Collections')
        },
         {
      title: "Calendrier",
      icon: "calendar-outline",
      action: () => navigation.navigate('PrestataireCalendar')
    }
      ]
    : baseMenuItems;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* AppBar personnalisée */}
      <View style={styles.appBar}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#000000" />
        </TouchableOpacity>
        
        <View style={styles.leftContainer}>
          <Text style={styles.title}>Menu</Text>
        </View>
        
        <View style={styles.avatarContainer}>
          <Image 
            source={avatarSource} 
            style={styles.avatar} 
          />
          <TouchableOpacity 
            style={styles.menuIconContainer}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="menu" size={10} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity 
            key={index}
            style={styles.menuItem}
            onPress={item.action}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Ionicons name={item.icon} size={22} color="#075E54" />
            </View>
            <Text style={styles.menuText}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={18} color="#ADB5BD" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#FFFFFF'
  },
  backButton: {
    padding: 8,
    marginRight: 8
  },
  leftContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center'
  },
  title: {
    fontSize: 22,
    fontFamily: 'Poppins-SemiBold',
    color: '#000000',
    marginLeft: 8
  },
  avatarContainer: {
    position: 'relative',
    width: 44,
    height: 44,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#000000'
  },
  menuIconContainer: {
    position: 'absolute',
    right: 5,
    bottom: -2,
    backgroundColor: '#000000',
    width: 18,
    height: 18,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  menuContainer: {
    paddingTop: 10,
    marginHorizontal: 16
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5'
  },
  iconContainer: {
    width: 28,
    alignItems: 'center',
    marginRight: 14
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontFamily: Platform.select({
      ios: 'Inter-SemiBold',
      android: 'Inter-SemiBold'
    }),
    color: '#333333',
    letterSpacing: 0.3
  }
});

export default ProfileMenuScreen;