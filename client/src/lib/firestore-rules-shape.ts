/**
 * Constante aliniate cu firestore.rules — testate în CI fără emulator greu.
 * Dacă schimbi formatul envelope din family-crypto, actualizează și rules + aceste valori.
 */
export const FIRESTORE_ROOM_ID_HEX_LEN = 64;
export const FIRESTORE_ENVELOPE_VERSION = 1;
export const FIRESTORE_SALT_B64_LEN = 24; // 16 bytes salt → base64
export const FIRESTORE_IV_B64_LEN = 16; // 12 bytes IV → base64
export const FIRESTORE_CIPHERTEXT_MAX = 2_000_000;
export const FIRESTORE_ALLOWED_DOC_KEYS = ["envelope", "updatedAt"] as const;
export const FIRESTORE_ALLOWED_ENVELOPE_KEYS = ["version", "createdAt", "salt", "iv", "ciphertext"] as const;
