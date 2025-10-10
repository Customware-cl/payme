// Flow Data Provider
// Obtiene datos existentes del usuario para prellenar WhatsApp Flows

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export class FlowDataProvider {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseServiceKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Obtiene datos del perfil del usuario para prellenar el Flow de Perfil
   */
  async getProfileData(contactId: string): Promise<{
    first_name: string;
    last_name: string;
    email: string;
  }> {
    try {
      // Obtener tenant_contact con join a contact_profiles
      const { data: contact } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id, contact_profiles(first_name, last_name, phone_e164, email)')
        .eq('id', contactId)
        .single();

      if (!contact || !contact.contact_profile_id) {
        throw new Error('Contact profile not found');
      }

      const profile = contact.contact_profiles;

      return {
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        email: profile?.email || ""
      };

    } catch (error) {
      console.error('Error getting profile data:', error);
      // Retornar datos vacíos si hay error
      return {
        first_name: "",
        last_name: "",
        email: ""
      };
    }
  }

  /**
   * Obtiene las cuentas bancarias del usuario para prellenar el Flow de Cuentas
   * Devuelve un array en formato NavigationItem para WhatsApp Flows
   */
  async getBankAccountsData(contactId: string): Promise<Array<{
    id: string;
    main_content: {
      title: string;
      description: string;
    };
    end: {
      title: string;
    };
    on_click_action: {
      name: string;
      next: {
        type: string;
        name: string;
      };
      payload: {
        edit_mode: boolean;
        account_id?: string;
        alias?: string;
        bank_name?: string;
        account_type?: string;
        account_number?: string;
        is_default?: boolean;
      };
    };
  }>> {
    try {
      // Obtener tenant_contact para acceder al contact_profile_id
      const { data: contact } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id')
        .eq('id', contactId)
        .single();

      if (!contact || !contact.contact_profile_id) {
        throw new Error('Contact profile not found');
      }

      // Obtener cuentas bancarias activas
      const { data: accounts } = await this.supabase
        .from('bank_transfer_accounts')
        .select('id, alias, bank_name, account_type, account_number, is_default')
        .eq('contact_profile_id', contact.contact_profile_id)
        .eq('is_active', true)
        .order('is_default', { ascending: false }) // Cuenta default primero
        .order('created_at', { ascending: true });

      const navigationItems = [];

      // Primer item: "Agregar nueva cuenta" (siempre presente)
      navigationItems.push({
        id: 'add_new',
        main_content: {
          title: '➕ Agregar nueva cuenta',
          description: 'Registra una nueva cuenta bancaria para recibir transferencias'
        },
        end: {
          title: ''
        },
        on_click_action: {
          name: 'navigate',
          next: {
            type: 'screen',
            name: 'ACCOUNT_FORM'
          },
          payload: {
            edit_mode: false
          }
        }
      });

      // Agregar cuentas existentes
      if (accounts && accounts.length > 0) {
        for (const account of accounts) {
          const bankTitle = this.getBankTitle(account.bank_name);
          const typeTitle = this.getAccountTypeTitle(account.account_type);
          const defaultIndicator = account.is_default ? ' • ⭐ Principal' : '';

          navigationItems.push({
            id: account.id,
            main_content: {
              title: `${account.alias} - ${bankTitle}`,
              description: `${typeTitle} • ${account.account_number}${defaultIndicator}`
            },
            end: {
              title: ''
            },
            on_click_action: {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'ACCOUNT_FORM'
              },
              payload: {
                edit_mode: true,
                account_id: account.id,
                alias: account.alias,
                bank_name: account.bank_name,
                account_type: account.account_type,
                account_number: account.account_number,
                is_default: account.is_default
              }
            }
          });
        }
      }

      return navigationItems;

    } catch (error) {
      console.error('Error getting bank accounts data:', error);
      // Retornar solo el item "Agregar nueva cuenta" si hay error
      return [{
        id: 'add_new',
        main_content: {
          title: '➕ Agregar nueva cuenta',
          description: 'Registra una nueva cuenta bancaria para recibir transferencias'
        },
        end: {
          title: ''
        },
        on_click_action: {
          name: 'navigate',
          next: {
            type: 'screen',
            name: 'ACCOUNT_FORM'
          },
          payload: {
            edit_mode: false
          }
        }
      }];
    }
  }

  /**
   * Obtiene la lista de contactos del tenant para prellenar el Flow de Préstamos
   * Devuelve un array en formato NavigationItem para WhatsApp Flows
   * Incluye loan_type y loan_detail en los payloads para mantener contexto
   */
  async getContactsListData(
    tenantId: string,
    lenderContactId: string,
    loanType?: string,
    loanDetail?: string
  ): Promise<Array<{
    id: string;
    'main-content': {
      title: string;
      description: string;
    };
    end: {
      title: string;
    };
    'on-click-action': {
      name: string;
      next: {
        type: string;
        name: string;
      };
      payload: Record<string, any>;
    };
  }>> {
    try {
      // Obtener contactos activos del tenant (excluir al mismo lender)
      // Con join a contact_profiles para obtener phone_e164
      const { data: contacts } = await this.supabase
        .from('tenant_contacts')
        .select('id, name, contact_profiles(phone_e164)')
        .eq('tenant_id', tenantId)
        .eq('opt_in_status', 'opted_in')
        .neq('id', lenderContactId)
        .order('name', { ascending: true })
        .limit(50);

      const navigationItems = [];

      // Primer item: "Agregar nuevo contacto" (siempre presente)
      navigationItems.push({
        id: 'add_new',
        'main-content': {
          title: '➕ Agregar nuevo',
          description: 'Registrar persona nueva'
        },
        'on-click-action': {
          name: 'navigate',
          next: {
            type: 'screen',
            name: 'NEW_CONTACT_FORM'
          },
          payload: {
            loan_type: loanType || '',
            loan_detail: loanDetail || ''
          }
        }
      });

      // Agregar contactos existentes
      if (contacts && contacts.length > 0) {
        for (const contact of contacts) {
          // Formatear teléfono para que quepa en 20 caracteres
          let description = 'Sin teléfono';
          const phoneE164 = contact.contact_profiles?.phone_e164;
          if (phoneE164) {
            // Remover +56 y formatear: +56912345678 -> "912345678"
            const cleanPhone = phoneE164.replace('+56', '').replace(/\s/g, '');
            description = cleanPhone.substring(0, 15); // Max 15 caracteres para el número
          }

          navigationItems.push({
            id: contact.id,
            'main-content': {
              title: contact.name,
              description: description
            },
            'on-click-action': {
              name: 'navigate',
              next: {
                type: 'screen',
                name: 'DUE_DATE_SELECT'
              },
              payload: {
                loan_type: loanType || '',
                loan_detail: loanDetail || '',
                contact_id: contact.id,
                contact_name: contact.name,
                contact_phone: phoneE164 || '',
                new_contact: false
              }
            }
          });
        }
      }

      return navigationItems;

    } catch (error) {
      console.error('Error getting contacts list data:', error);
      // Retornar solo el item "Agregar nuevo contacto" si hay error
      return [{
        id: 'add_new',
        'main-content': {
          title: '➕ Agregar nuevo',
          description: 'Registrar persona nueva'
        },
        'on-click-action': {
          name: 'navigate',
          next: {
            type: 'screen',
            name: 'NEW_CONTACT_FORM'
          },
          payload: {
            loan_type: loanType || '',
            loan_detail: loanDetail || ''
          }
        }
      }];
    }
  }

  /**
   * Genera un flow_token único para identificar al usuario en el flow
   * Format: [flow_type]_[tenant_id]_[contact_id]_[contact_profile_id]_[timestamp]
   */
  async generateFlowToken(
    flowType: 'profile' | 'bank' | 'loan',
    tenantId: string,
    contactId: string
  ): Promise<string> {
    try {
      console.log('[FLOW_TOKEN] Querying tenant_contact with ID:', contactId);

      // Obtener tenant_contact con join a contact_profiles
      const { data: contact, error: contactError } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id, contact_profiles(phone_e164)')
        .eq('id', contactId)
        .single();

      console.log('[FLOW_TOKEN] Query result - data:', contact);
      console.log('[FLOW_TOKEN] Query result - error:', contactError);

      if (!contact) {
        console.error('[FLOW_TOKEN] Tenant contact not found for contactId:', contactId);
        console.error('[FLOW_TOKEN] Error details:', contactError);
        throw new Error('Tenant contact not found');
      }

      const contactProfileId = contact.contact_profile_id;

      // Validar que tenga contact_profile_id (siempre debe tener por FK constraint)
      if (!contactProfileId) {
        console.error('[FLOW_TOKEN] Contact profile ID missing for tenant_contact:', contactId);
        throw new Error('Contact profile ID missing');
      }

      const timestamp = Date.now();
      return `${flowType}_${tenantId}_${contactId}_${contactProfileId}_${timestamp}`;

    } catch (error) {
      console.error('Error generating flow token:', error);
      throw error;
    }
  }

  /**
   * Mapea el ID interno del banco al título para mostrar
   */
  getBankTitle(bankId: string): string {
    const bankMap: Record<string, string> = {
      'banco_estado': 'BancoEstado',
      'banco_chile': 'Banco de Chile',
      'santander': 'Banco Santander',
      'bci': 'Banco BCI',
      'scotiabank': 'Scotiabank Chile',
      'itau': 'Banco Itaú',
      'security': 'Banco Security',
      'falabella': 'Banco Falabella',
      'ripley': 'Banco Ripley',
      'consorcio': 'Banco Consorcio',
      'bice': 'Banco BICE',
      'internacional': 'Banco Internacional'
    };

    return bankMap[bankId] || bankId;
  }

  /**
   * Mapea el tipo de cuenta para display
   */
  getAccountTypeTitle(accountType: string): string {
    const typeMap: Record<string, string> = {
      'corriente': 'Cuenta Corriente',
      'ahorro': 'Cuenta de Ahorro',
      'vista': 'Cuenta Vista',
      'rut': 'Cuenta RUT'
    };

    return typeMap[accountType] || accountType;
  }
}
