// WhatsApp Flows Cryptographic Module
// Implements request validation and response signing for WhatsApp Flows endpoint security

/**
 * Converts PEM-formatted private key to CryptoKey for Web Crypto API
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  // Remove PEM headers and newlines
  const pemContents = pemKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  // Convert base64 to ArrayBuffer
  const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

  // Import key using Web Crypto API
  return await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

/**
 * Signs a payload using RS256 algorithm and returns JWS (JSON Web Signature) compact format
 * Format: <base64url(header)>.<base64url(payload)>.<base64url(signature)>
 */
export async function signFlowResponse(
  payload: any,
  privateKeyPem: string
): Promise<string> {
  try {
    // JWS Header
    const header = {
      alg: 'RS256',
      typ: 'JWT'
    };

    // Base64url encode header and payload
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));

    // Create signing input: <header>.<payload>
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    // Import private key
    const privateKey = await importPrivateKey(privateKeyPem);

    // Sign the input
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      new TextEncoder().encode(signingInput)
    );

    // Base64url encode signature
    const encodedSignature = base64UrlEncode(signature);

    // Return JWS compact format
    return `${signingInput}.${encodedSignature}`;

  } catch (error) {
    console.error('Error signing flow response:', error);
    throw new Error('Failed to sign flow response');
  }
}

/**
 * Validates incoming request signature from WhatsApp
 * WhatsApp signs requests with HMAC SHA-256 using app secret
 */
export async function validateRequestSignature(
  payload: string,
  signature: string,
  appSecret: string
): Promise<boolean> {
  try {
    // Expected format: sha256=<signature>
    if (!signature.startsWith('sha256=')) {
      console.error('Invalid signature format');
      return false;
    }

    const expectedSignature = signature.substring(7); // Remove 'sha256=' prefix

    // Import app secret as key
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(appSecret),
      {
        name: 'HMAC',
        hash: 'SHA-256',
      },
      false,
      ['sign', 'verify']
    );

    // Calculate HMAC
    const mac = await crypto.subtle.sign(
      'HMAC',
      key,
      new TextEncoder().encode(payload)
    );

    // Convert to hex string
    const calculatedSignature = Array.from(new Uint8Array(mac))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Compare signatures (constant-time comparison would be better in production)
    return calculatedSignature === expectedSignature;

  } catch (error) {
    console.error('Error validating request signature:', error);
    return false;
  }
}

/**
 * Base64url encoding (different from regular base64)
 * Replaces +/= with -_= per RFC 7515
 */
function base64UrlEncode(data: string | ArrayBuffer): string {
  let base64: string;

  if (typeof data === 'string') {
    base64 = btoa(data);
  } else {
    base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  }

  // Convert base64 to base64url
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Wraps signed response in the format expected by WhatsApp Flows
 */
export function createSignedResponse(jws: string): any {
  return {
    signed_request: jws
  };
}
