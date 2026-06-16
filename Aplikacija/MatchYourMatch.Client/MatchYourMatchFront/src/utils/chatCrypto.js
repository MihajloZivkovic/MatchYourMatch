const ENCRYPTION_PREFIX = "mymenc:v1";
const KEY_SALT = "MatchYourMatch chat privacy v1";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Privacy MVP only: this is browser-side encryption before storage, not full E2EE.
// The key is derived from participant ids and a static salt, so there are no client-only
// private keys or per-conversation secrets that the backend can never reconstruct.
export function isEncryptedChatBody(value) {
  return typeof value === "string" && value.startsWith(`${ENCRYPTION_PREFIX}:`);
}

export async function encryptChatBody(plainText, currentUserId, otherUserId) {
  const key = await getConversationKey(currentUserId, otherUserId);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plainText),
  );

  return `${ENCRYPTION_PREFIX}:${toBase64(iv)}:${toBase64(new Uint8Array(encrypted))}`;
}

export async function decryptChatBody(body, currentUserId, otherUserId) {
  if (!isEncryptedChatBody(body)) {
    return body;
  }

  try {
    const [, , ivBase64, cipherBase64] = body.split(":");
    const key = await getConversationKey(currentUserId, otherUserId);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(ivBase64) },
      key,
      fromBase64(cipherBase64),
    );

    return decoder.decode(decrypted);
  } catch {
    return "Encrypted message could not be opened.";
  }
}

async function getConversationKey(currentUserId, otherUserId) {
  const ids = [Number(currentUserId), Number(otherUserId)].sort((a, b) => a - b);
  const material = await crypto.subtle.importKey(
    "raw",
    encoder.encode(`mym-chat:${ids[0]}:${ids[1]}`),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(KEY_SALT),
      iterations: 120000,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function toBase64(bytes) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
