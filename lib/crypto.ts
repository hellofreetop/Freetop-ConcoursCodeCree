import * as Crypto from 'expo-crypto';
import { SignalProtocolStore } from './signalStore';

export const encryptMessage = async (message, recipientId) => {
  try {
    // Implémentation simplifiée - À remplacer par libsignal
    const discussionKey = await getDiscussionKey(recipientId);
    const iv = Crypto.getRandomValues(new Uint8Array(16));
    const encrypted = await Crypto.encrypt(
      'AES-GCM',
      discussionKey,
      new TextEncoder().encode(message),
      iv
    );
    return {
      ciphertext: Array.from(new Uint8Array(encrypted)),
      iv: Array.from(iv),
      version: 'v1'
    };
  } catch (error) {
    console.error("Erreur chiffrement:", error);
    throw error;
  }
};

export const decryptMessage = async (encryptedData, senderId) => {
  // Implémentation inverse
};

const getDiscussionKey = async (recipientId) => {
  // Récupérer depuis SecureStore
};