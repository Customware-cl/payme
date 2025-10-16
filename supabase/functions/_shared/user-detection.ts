// User Detection Helper
// Detecta si un contact_profile está asociado a un usuario activo con tenant

export interface UserDetectionResult {
  isUser: boolean;
  tenant_id?: string;
  user_id?: string;
  user_name?: string;
}

/**
 * Verifica si un contact_profile corresponde a un usuario de la app
 *
 * @param supabase - Cliente de Supabase
 * @param contact_profile_id - ID del contact_profile a verificar
 * @returns Información sobre si es usuario y su tenant
 */
export async function checkIfContactIsAppUser(
  supabase: any,
  contact_profile_id: string
): Promise<UserDetectionResult> {
  try {
    // 1. Obtener el contact_profile
    const { data: profile, error: profileError } = await supabase
      .from('contact_profiles')
      .select('phone_e164, email')
      .eq('id', contact_profile_id)
      .single();

    if (profileError || !profile) {
      console.log('[USER_DETECTION] Contact profile not found:', contact_profile_id);
      return { isUser: false };
    }

    // 2. Buscar usuario por phone o email
    let userQuery = supabase
      .from('users')
      .select('id, tenant_id, first_name, last_name, phone, email');

    // Buscar por teléfono O email
    if (profile.phone_e164 && profile.email) {
      userQuery = userQuery.or(`phone.eq.${profile.phone_e164},email.eq.${profile.email}`);
    } else if (profile.phone_e164) {
      userQuery = userQuery.eq('phone', profile.phone_e164);
    } else if (profile.email) {
      userQuery = userQuery.eq('email', profile.email);
    } else {
      // No hay forma de buscar
      return { isUser: false };
    }

    const { data: users, error: userError } = await userQuery;

    if (userError) {
      console.error('[USER_DETECTION] Error searching users:', userError);
      return { isUser: false };
    }

    if (!users || users.length === 0) {
      console.log('[USER_DETECTION] No user found for contact_profile:', contact_profile_id);
      return { isUser: false };
    }

    // Si hay múltiples matches, tomar el primero (edge case)
    const user = users[0];
    const userName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Usuario';

    console.log('[USER_DETECTION] User found:', {
      contact_profile_id,
      user_id: user.id,
      tenant_id: user.tenant_id,
      user_name: userName
    });

    return {
      isUser: true,
      tenant_id: user.tenant_id,
      user_id: user.id,
      user_name: userName
    };

  } catch (error) {
    console.error('[USER_DETECTION] Exception:', error);
    return { isUser: false };
  }
}

/**
 * Buscar contact_profile por teléfono
 *
 * @param supabase - Cliente de Supabase
 * @param phone_e164 - Teléfono en formato E.164
 * @returns Contact profile si existe
 */
export async function findContactProfileByPhone(
  supabase: any,
  phone_e164: string
): Promise<{ id: string; phone_e164: string; email?: string } | null> {
  try {
    const { data, error } = await supabase
      .from('contact_profiles')
      .select('id, phone_e164, email')
      .eq('phone_e164', phone_e164)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('[USER_DETECTION] Error finding contact profile:', error);
    return null;
  }
}

/**
 * Buscar contact_profile por email
 *
 * @param supabase - Cliente de Supabase
 * @param email - Email del contacto
 * @returns Contact profile si existe
 */
export async function findContactProfileByEmail(
  supabase: any,
  email: string
): Promise<{ id: string; phone_e164?: string; email: string } | null> {
  try {
    const { data, error } = await supabase
      .from('contact_profiles')
      .select('id, phone_e164, email')
      .eq('email', email)
      .single();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (error) {
    console.error('[USER_DETECTION] Error finding contact profile by email:', error);
    return null;
  }
}
