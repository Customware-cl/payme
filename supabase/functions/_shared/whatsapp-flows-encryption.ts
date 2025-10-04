// WhatsApp Flows Encryption Module
// Implements AES-GCM encryption/decryption for WhatsApp Flows endpoint
// Based on: https://developers.facebook.com/docs/whatsapp/flows/guides/implementingyourflowendpoint

/**
 * Imports RSA private key for RSA-OAEP decryption
 * Used to decrypt the AES key sent by WhatsApp
 */
export async function importPrivateKeyForDecryption(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and newlines
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  // Convert base64 to ArrayBuffer
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Import key for RSA-OAEP decryption
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt']
  );
}

/**
 * Decrypts the AES key using RSA-OAEP
 * @param encryptedAesKeyBase64 - Base64 encoded encrypted AES key
 * @param privateKeyPem - PEM formatted private key
 * @returns Decrypted AES key as ArrayBuffer (128 bits)
 */
export async function decryptAesKey(
  encryptedAesKeyBase64: string,
  privateKeyPem: string
): Promise<ArrayBuffer> {
  try {
    // Import private key for decryption
    const privateKey = await importPrivateKeyForDecryption(privateKeyPem);

    // Decode base64 encrypted AES key
    const encryptedKeyBytes = Uint8Array.from(atob(encryptedAesKeyBase64), c => c.charCodeAt(0));

    // Decrypt using RSA-OAEP
    const aesKeyBuffer = await crypto.subtle.decrypt(
      {
        name: 'RSA-OAEP',
      },
      privateKey,
      encryptedKeyBytes
    );

    console.log('[CRYPTO] AES key decrypted successfully, length:', aesKeyBuffer.byteLength, 'bytes');
    return aesKeyBuffer;
  } catch (error) {
    console.error('[CRYPTO] Error decrypting AES key:', error);
    throw new Error('Failed to decrypt AES key');
  }
}

/**
 * Flips/inverts the initialization vector (bitwise NOT operation)
 * Required by WhatsApp Flows protocol for response encryption
 * @param iv - Original initialization vector
 * @returns Flipped initialization vector
 */
export function flipInitializationVector(iv: Uint8Array): Uint8Array {
  const flipped = new Uint8Array(iv.length);
  for (let i = 0; i < iv.length; i++) {
    flipped[i] = ~iv[i];
  }
  return flipped;
}

/**
 * Decrypts Flow data using AES-128-GCM
 * @param encryptedDataBase64 - Base64 encoded encrypted payload (includes 16-byte auth tag at end)
 * @param aesKeyBuffer - Decrypted AES key (128 bits)
 * @param ivBase64 - Base64 encoded initialization vector
 * @returns Decrypted and parsed JSON object
 */
export async function decryptFlowData(
  encryptedDataBase64: string,
  aesKeyBuffer: ArrayBuffer,
  ivBase64: string
): Promise<any> {
  try {
    // Decode base64 inputs
    const encryptedBytes = Uint8Array.from(atob(encryptedDataBase64), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

    console.log('[CRYPTO] Decrypting flow data...');
    console.log('[CRYPTO] Encrypted data length:', encryptedBytes.length, 'bytes');
    console.log('[CRYPTO] IV length:', ivBytes.length, 'bytes');

    // Import AES key for AES-GCM decryption
    const aesKey = await crypto.subtle.importKey(
      'raw',
      aesKeyBuffer,
      {
        name: 'AES-GCM',
      },
      false,
      ['decrypt']
    );

    // Decrypt using AES-GCM
    // Note: The authentication tag (16 bytes) is included at the end of encryptedBytes
    const decryptedBuffer = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: ivBytes,
        tagLength: 128, // 16 bytes
      },
      aesKey,
      encryptedBytes
    );

    // Convert to string and parse JSON
    const decryptedText = new TextDecoder().decode(decryptedBuffer);
    const decryptedData = JSON.parse(decryptedText);

    console.log('[CRYPTO] Flow data decrypted successfully');
    return decryptedData;
  } catch (error) {
    console.error('[CRYPTO] Error decrypting flow data:', error);
    throw new Error('Failed to decrypt flow data');
  }
}

/**
 * Encrypts response using AES-128-GCM with flipped IV
 * @param response - Response object to encrypt
 * @param aesKeyBuffer - AES key from request (128 bits)
 * @param ivBase64 - Original IV from request (will be flipped)
 * @returns Base64 encoded encrypted response (includes auth tag)
 */
export async function encryptResponse(
  response: any,
  aesKeyBuffer: ArrayBuffer,
  ivBase64: string
): Promise<string> {
  try {
    // Convert response to JSON bytes
    const responseJson = JSON.stringify(response);
    const responseBytes = new TextEncoder().encode(responseJson);

    // Decode and flip the IV
    const originalIv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const flippedIv = flipInitializationVector(originalIv);

    console.log('[CRYPTO] Encrypting response...');
    console.log('[CRYPTO] Response length:', responseBytes.length, 'bytes');
    console.log('[CRYPTO] Using flipped IV');

    // Import AES key for AES-GCM encryption
    const aesKey = await crypto.subtle.importKey(
      'raw',
      aesKeyBuffer,
      {
        name: 'AES-GCM',
      },
      false,
      ['encrypt']
    );

    // Encrypt using AES-GCM with flipped IV
    const encryptedBuffer = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: flippedIv,
        tagLength: 128, // 16 bytes
      },
      aesKey,
      responseBytes
    );

    // The encrypted buffer includes the ciphertext + 16-byte authentication tag
    // Encode to base64
    const encryptedBytes = new Uint8Array(encryptedBuffer);
    const base64Encrypted = btoa(String.fromCharCode(...encryptedBytes));

    console.log('[CRYPTO] Response encrypted successfully, length:', encryptedBytes.length, 'bytes');
    return base64Encrypted;
  } catch (error) {
    console.error('[CRYPTO] Error encrypting response:', error);
    throw new Error('Failed to encrypt response');
  }
}
