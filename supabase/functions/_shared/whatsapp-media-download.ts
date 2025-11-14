/**
 * Helper para descargar medios de WhatsApp (audio, imagen, video, etc)
 */

export interface MediaDownloadResult {
  success: boolean;
  data?: Blob;
  mimeType?: string;
  error?: string;
}

/**
 * Descargar archivo de media desde WhatsApp
 *
 * Proceso:
 * 1. GET media_id info para obtener URL
 * 2. GET URL con token para descargar el archivo
 */
export async function downloadWhatsAppMedia(
  mediaId: string,
  phoneNumberId: string,
  accessToken: string
): Promise<MediaDownloadResult> {
  try {
    console.log('[WhatsAppMedia] Downloading media:', mediaId);

    // Paso 1: Obtener información del media (incluye URL)
    const infoResponse = await fetch(
      `https://graph.facebook.com/v18.0/${mediaId}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );

    if (!infoResponse.ok) {
      const error = await infoResponse.json();
      console.error('[WhatsAppMedia] Error getting media info:', error);
      return {
        success: false,
        error: error.error?.message || 'Error getting media info'
      };
    }

    const mediaInfo = await infoResponse.json();
    console.log('[WhatsAppMedia] Media info:', mediaInfo);

    const mediaUrl = mediaInfo.url;
    const mimeType = mediaInfo.mime_type;

    if (!mediaUrl) {
      return {
        success: false,
        error: 'No URL in media info'
      };
    }

    // Paso 2: Descargar el archivo desde la URL
    const downloadResponse = await fetch(mediaUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!downloadResponse.ok) {
      const error = await downloadResponse.text();
      console.error('[WhatsAppMedia] Error downloading media:', error);
      return {
        success: false,
        error: 'Error downloading media file'
      };
    }

    const blob = await downloadResponse.blob();
    console.log('[WhatsAppMedia] Download success:', {
      size: blob.size,
      type: blob.type || mimeType
    });

    return {
      success: true,
      data: blob,
      mimeType: blob.type || mimeType
    };

  } catch (error) {
    console.error('[WhatsAppMedia] Exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Convertir Blob a File (necesario para OpenAI API)
 */
export function blobToFile(blob: Blob, filename: string, mimeType?: string): File {
  return new File([blob], filename, {
    type: mimeType || blob.type
  });
}
