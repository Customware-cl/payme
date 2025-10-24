/**
 * Gestor de memoria conversacional
 * Almacena y recupera historial de conversaciones para contexto de IA
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { OpenAIMessage } from './openai-client.ts';

export interface ConversationMessage {
  id: string;
  tenant_id: string;
  contact_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: {
    audio_url?: string;
    image_url?: string;
    intent_detected?: string;
    confidence?: number;
    tool_calls?: any[];
  };
  created_at: string;
}

export class ConversationMemory {
  private supabase: SupabaseClient;

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }

  /**
   * Guardar mensaje en el historial
   */
  async saveMessage(
    tenantId: string,
    contactId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata: any = {}
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      console.log('[ConversationMemory] Saving message:', {
        tenantId,
        contactId,
        role,
        contentLength: content.length
      });

      // Resolver contactId a tenantContactId si es legacy contact
      let resolvedContactId = contactId;

      // Verificar si existe en tenant_contacts
      const { data: tenantContact } = await this.supabase
        .from('tenant_contacts')
        .select('id')
        .eq('id', contactId)
        .maybeSingle();

      // Si no existe, buscar en legacy contacts para obtener tenant_contact_id
      if (!tenantContact) {
        const { data: legacyContact } = await this.supabase
          .from('contacts')
          .select('tenant_contact_id')
          .eq('id', contactId)
          .maybeSingle();

        if (legacyContact?.tenant_contact_id) {
          resolvedContactId = legacyContact.tenant_contact_id;
          console.log('[ConversationMemory] Resolved legacy contact to tenant_contact:', resolvedContactId);
        }
      }

      const { data, error } = await this.supabase
        .from('conversation_history')
        .insert({
          tenant_id: tenantId,
          contact_id: resolvedContactId,  // Usar ID resuelto
          role,
          content,
          metadata
        })
        .select('id')
        .single();

      if (error) {
        console.error('[ConversationMemory] Error saving message:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        messageId: data.id
      };

    } catch (error) {
      console.error('[ConversationMemory] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Obtener historial de conversación (últimos N mensajes)
   */
  async getHistory(
    tenantId: string,
    contactId: string,
    limit: number = 20,
    includeSystem: boolean = false
  ): Promise<{ success: boolean; messages?: ConversationMessage[]; error?: string }> {
    try {
      console.log('[ConversationMemory] Getting history:', {
        tenantId,
        contactId,
        limit,
        includeSystem
      });

      // Resolver contactId a tenantContactId si es legacy contact
      let resolvedContactId = contactId;

      // Verificar si existe en tenant_contacts
      const { data: tenantContact } = await this.supabase
        .from('tenant_contacts')
        .select('id')
        .eq('id', contactId)
        .maybeSingle();

      // Si no existe, buscar en legacy contacts para obtener tenant_contact_id
      if (!tenantContact) {
        const { data: legacyContact } = await this.supabase
          .from('contacts')
          .select('tenant_contact_id')
          .eq('id', contactId)
          .maybeSingle();

        if (legacyContact?.tenant_contact_id) {
          resolvedContactId = legacyContact.tenant_contact_id;
          console.log('[ConversationMemory] Resolved legacy contact to tenant_contact for history:', resolvedContactId);
        }
      }

      let query = this.supabase
        .from('conversation_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', resolvedContactId)  // Usar ID resuelto
        .order('created_at', { ascending: false })
        .limit(limit);

      // Excluir mensajes de sistema si no se solicitan
      if (!includeSystem) {
        query = query.neq('role', 'system');
      }

      const { data, error } = await query;

      if (error) {
        console.error('[ConversationMemory] Error getting history:', error);
        return {
          success: false,
          error: error.message
        };
      }

      // Invertir el orden para que sea cronológico (más antiguo primero)
      const messages = (data || []).reverse();

      console.log('[ConversationMemory] Retrieved messages:', messages.length);

      return {
        success: true,
        messages
      };

    } catch (error) {
      console.error('[ConversationMemory] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convertir historial a formato OpenAI
   */
  historyToOpenAIMessages(messages: ConversationMessage[]): OpenAIMessage[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Obtener historial formateado para OpenAI
   */
  async getHistoryForOpenAI(
    tenantId: string,
    contactId: string,
    limit: number = 20
  ): Promise<{ success: boolean; messages?: OpenAIMessage[]; error?: string }> {
    const result = await this.getHistory(tenantId, contactId, limit, false);

    if (!result.success || !result.messages) {
      return {
        success: false,
        error: result.error
      };
    }

    return {
      success: true,
      messages: this.historyToOpenAIMessages(result.messages)
    };
  }

  /**
   * Limpiar historial antiguo (mantener solo últimos N días)
   */
  async cleanOldHistory(
    tenantId: string,
    daysToKeep: number = 30
  ): Promise<{ success: boolean; deleted?: number; error?: string }> {
    try {
      console.log('[ConversationMemory] Cleaning old history:', {
        tenantId,
        daysToKeep
      });

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { data, error } = await this.supabase
        .from('conversation_history')
        .delete()
        .eq('tenant_id', tenantId)
        .lt('created_at', cutoffDate.toISOString())
        .select('id');

      if (error) {
        console.error('[ConversationMemory] Error cleaning history:', error);
        return {
          success: false,
          error: error.message
        };
      }

      console.log('[ConversationMemory] Deleted messages:', data?.length || 0);

      return {
        success: true,
        deleted: data?.length || 0
      };

    } catch (error) {
      console.error('[ConversationMemory] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Obtener estadísticas de conversación
   */
  async getStats(
    tenantId: string,
    contactId: string
  ): Promise<{
    success: boolean;
    stats?: {
      total_messages: number;
      user_messages: number;
      assistant_messages: number;
      first_message: string | null;
      last_message: string | null;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('conversation_history')
        .select('role, created_at')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ConversationMemory] Error getting stats:', error);
        return {
          success: false,
          error: error.message
        };
      }

      const messages = data || [];
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');

      return {
        success: true,
        stats: {
          total_messages: messages.length,
          user_messages: userMessages.length,
          assistant_messages: assistantMessages.length,
          first_message: messages[0]?.created_at || null,
          last_message: messages[messages.length - 1]?.created_at || null
        }
      };

    } catch (error) {
      console.error('[ConversationMemory] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Buscar en historial por contenido
   */
  async searchHistory(
    tenantId: string,
    contactId: string,
    searchTerm: string,
    limit: number = 10
  ): Promise<{ success: boolean; messages?: ConversationMessage[]; error?: string }> {
    try {
      console.log('[ConversationMemory] Searching history:', {
        tenantId,
        contactId,
        searchTerm
      });

      const { data, error } = await this.supabase
        .from('conversation_history')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('contact_id', contactId)
        .ilike('content', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ConversationMemory] Error searching:', error);
        return {
          success: false,
          error: error.message
        };
      }

      return {
        success: true,
        messages: data || []
      };

    } catch (error) {
      console.error('[ConversationMemory] Exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

/**
 * Helper para crear resumen de contexto del usuario
 */
export async function getUserContext(
  supabase: SupabaseClient,
  tenantId: string,
  contactId: string
): Promise<{
  success: boolean;
  context?: {
    contactName: string;
    totalLoans: number;
    activeLoans: number;
    totalLent: number;
    totalBorrowed: number;
  };
  error?: string;
}> {
  try {
    // Obtener información del contacto (con join a contact_profiles para phone)
    let { data: contact, error: contactError } = await supabase
      .from('tenant_contacts')
      .select('id, name, contact_profile_id, contact_profiles(phone_e164)')
      .eq('id', contactId)
      .maybeSingle();

    let tenantContactId = contactId; // Por defecto, asumimos que es tenant_contact_id

    // Si no se encuentra en tenant_contacts, buscar en legacy contacts
    if (contactError || !contact) {
      console.log('[ConversationMemory] Contact not found in tenant_contacts, checking legacy contacts');

      const { data: legacyContact } = await supabase
        .from('contacts')
        .select('tenant_contact_id, name, phone_e164, contact_profile_id')
        .eq('id', contactId)
        .maybeSingle();

      if (legacyContact?.tenant_contact_id) {
        console.log('[ConversationMemory] Found legacy contact mapping, fetching tenant_contact:', legacyContact.tenant_contact_id);

        // Usar el tenant_contact_id mapeado
        tenantContactId = legacyContact.tenant_contact_id;

        const { data: mappedContact, error: mappedError } = await supabase
          .from('tenant_contacts')
          .select('id, name, contact_profile_id, contact_profiles(phone_e164)')
          .eq('id', legacyContact.tenant_contact_id)
          .maybeSingle();

        if (mappedError || !mappedContact) {
          console.error('[ConversationMemory] Error fetching mapped tenant_contact:', mappedError);
          return {
            success: false,
            error: mappedError?.message || 'Mapped tenant_contact not found'
          };
        }

        contact = mappedContact;
        contactError = null;
      } else {
        console.error('[ConversationMemory] Contact not found in either table');
        return {
          success: false,
          error: 'Contact not found'
        };
      }
    }

    if (!contact) {
      return {
        success: false,
        error: 'Contact not found'
      };
    }

    // Obtener estadísticas de préstamos (tabla agreements, type='loan')
    let loans: any[] = [];
    let activeLoans: any[] = [];
    let totalLent = 0;
    let totalBorrowed = 0;

    const { data: agreements, error: agreementsError } = await supabase
      .from('agreements')
      .select('amount, status, tenant_contact_id, lender_tenant_contact_id')
      .eq('tenant_id', tenantId)
      .eq('type', 'loan')
      .or(`tenant_contact_id.eq.${tenantContactId},lender_tenant_contact_id.eq.${tenantContactId}`);

    if (agreementsError) {
      console.error('[ConversationMemory] Error fetching agreements:', agreementsError);
      // No fallar completamente, continuar con valores por defecto (ya inicializados arriba)
    } else {
      loans = agreements || [];
      activeLoans = loans.filter(l => l.status === 'active' || l.status === 'overdue');

      // lent = cuando lender_tenant_contact_id es NULL (owner presta) O cuando lender_tenant_contact_id = tenantContactId
      // borrowed = cuando tenant_contact_id = tenantContactId (es el que recibe)
      const lentLoans = loans.filter(l =>
        l.lender_tenant_contact_id === null || l.lender_tenant_contact_id === tenantContactId
      );
      const borrowedLoans = loans.filter(l => l.tenant_contact_id === tenantContactId);

      totalLent = lentLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
      totalBorrowed = borrowedLoans.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    }

    // Extraer phone si existe (es un objeto o array anidado del join)
    const contactProfile = Array.isArray(contact.contact_profiles)
      ? contact.contact_profiles[0]
      : contact.contact_profiles;
    const phoneE164 = contactProfile?.phone_e164 || 'Usuario';

    return {
      success: true,
      context: {
        contactName: contact.name || phoneE164,
        totalLoans: loans.length,
        activeLoans: activeLoans.length,
        totalLent,
        totalBorrowed
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
