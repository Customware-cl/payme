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
    phone: string;
    email: string;
  }> {
    try {
      // Obtener tenant_contact para acceder al contact_profile_id
      const { data: tenantContact } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id')
        .eq('id', contactId)
        .single();

      if (!tenantContact || !tenantContact.contact_profile_id) {
        throw new Error('Contact profile not found');
      }

      // Obtener datos del contact_profile
      const { data: profile } = await this.supabase
        .from('contact_profiles')
        .select('first_name, last_name, phone_e164, email')
        .eq('id', tenantContact.contact_profile_id)
        .single();

      return {
        first_name: profile?.first_name || "",
        last_name: profile?.last_name || "",
        phone: profile?.phone_e164 || "",
        email: profile?.email || ""
      };

    } catch (error) {
      console.error('Error getting profile data:', error);
      // Retornar datos vacíos si hay error
      return {
        first_name: "",
        last_name: "",
        phone: "",
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
      const { data: tenantContact } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id')
        .eq('id', contactId)
        .single();

      if (!tenantContact || !tenantContact.contact_profile_id) {
        throw new Error('Contact profile not found');
      }

      // Obtener cuentas bancarias activas
      const { data: accounts } = await this.supabase
        .from('bank_transfer_accounts')
        .select('id, alias, bank_name, account_type, account_number, is_default')
        .eq('contact_profile_id', tenantContact.contact_profile_id)
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
   * Genera un flow_token único para identificar al usuario en el flow
   * Format: [flow_type]_[tenant_id]_[contact_id]_[contact_profile_id]_[timestamp]
   */
  async generateFlowToken(
    flowType: 'profile' | 'bank',
    tenantId: string,
    contactId: string
  ): Promise<string> {
    try {
      // Obtener contact_profile_id y phone del tenant_contact
      const { data: tenantContact } = await this.supabase
        .from('tenant_contacts')
        .select('contact_profile_id, phone_e164')
        .eq('id', contactId)
        .single();

      if (!tenantContact) {
        throw new Error('Contact not found');
      }

      let contactProfileId = tenantContact.contact_profile_id;

      // Si no tiene contact_profile, crear uno automáticamente
      if (!contactProfileId) {
        console.log('Contact profile not found, creating new one for contact:', contactId);

        const { data: newProfile, error: createError } = await this.supabase
          .from('contact_profiles')
          .insert({
            phone_e164: tenantContact.phone_e164,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select('id')
          .single();

        if (createError || !newProfile) {
          console.error('Error creating contact profile:', createError);
          throw new Error('Failed to create contact profile');
        }

        contactProfileId = newProfile.id;

        // Actualizar tenant_contact con el nuevo contact_profile_id
        const { error: updateError } = await this.supabase
          .from('tenant_contacts')
          .update({ contact_profile_id: contactProfileId })
          .eq('id', contactId);

        if (updateError) {
          console.error('Error updating tenant_contact:', updateError);
        }

        console.log('Contact profile created and linked:', contactProfileId);
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
