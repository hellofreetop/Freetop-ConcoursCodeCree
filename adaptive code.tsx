import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

function MainApp() {
  // Récupère les insets (marges sécurisées)
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.content}>
      <Text>Contenu adaptatif</Text>
    </View>
  );
}

export default function App() {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaProvider>
      {/* Statut bar (haut) */}
      <SafeAreaView style={[styles.statusBar, { height: insets.top }]} />
      {/* Contenu principal */}
      <MainApp />
      {/* Barre de navigation (bas) */}
      <SafeAreaView style={[styles.navigationBar, { height: insets.bottom }]} />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  statusBar: {
    backgroundColor: '#ff0000', // Couleur du statut bar
  },
  navigationBar: {
    backgroundColor: '#0000ff', // Couleur de la barre de navigation
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000', // Couleur du contenu principal
  },
});