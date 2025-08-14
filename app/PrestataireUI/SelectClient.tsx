import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  FlatList,
  TextInput,
  ActivityIndicator,Image
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const SelectClient = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const [searchQuery, setSearchQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [filteredClients, setFilteredClients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, photo_url')
      .ilike('full_name', `%${searchQuery}%`)
      .limit(50);

    if (!error) {
      setClients(data);
      setFilteredClients(data);
    }
    setLoading(false);
  };

  const handleSelect = (client) => {
    route.params.onClientSelect(client);
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Rechercher un client..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={fetchClients}
          autoFocus
        />
        <Feather name="search" size={20} color="#999" style={styles.searchIcon} />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#075E54" style={styles.loader} />
      ) : filteredClients.length > 0 ? (
        <FlatList
          data={filteredClients}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.clientItem}
              onPress={() => handleSelect(item)}
            >
              {item.photo_url ? (
                <Image source={{ uri: item.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={20} color="#FFF" />
                </View>
              )}
              <Text style={styles.clientName}>{item.full_name}</Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucun client trouvé</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  searchContainer: {
    padding: 16,
    position: 'relative',
  },
  searchInput: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    paddingLeft: 40,
    fontSize: 16,
  },
  searchIcon: {
    position: 'absolute',
    left: 28,
    top: 28,
  },
  loader: {
    marginTop: 20,
  },
  clientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#075E54',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  clientName: {
    fontSize: 16,
    fontFamily: 'Poppins-Regular',
    color: '#333',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default SelectClient;