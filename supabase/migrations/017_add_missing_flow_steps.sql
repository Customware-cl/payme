-- Migration 017: Add missing flow_step values
-- Adds values used in conversation-manager.ts that were missing from the enum

-- Add missing flow step values to the enum
ALTER TYPE flow_step ADD VALUE 'awaiting_money_amount';
ALTER TYPE flow_step ADD VALUE 'awaiting_object_description';
ALTER TYPE flow_step ADD VALUE 'awaiting_other_description';
ALTER TYPE flow_step ADD VALUE 'awaiting_phone_for_new_contact';

-- Comment documenting the complete flow_step enum after this migration
COMMENT ON TYPE flow_step IS 'Flow steps for conversational flows. Values: init, awaiting_contact, awaiting_phone_for_new_contact, awaiting_item, awaiting_money_amount, awaiting_object_description, awaiting_other_description, awaiting_due_date, awaiting_confirmation, awaiting_reschedule_date, awaiting_service_details, awaiting_recurrence, confirming, complete, cancelled';
