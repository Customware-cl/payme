-- Migración 044: Eliminar versión incorrecta de create_p2p_loan()
-- Esta función fantasma causaba que agreements se crearan sin lender/borrower_tenant_id

-- =====================================================
-- ELIMINAR FUNCIÓN INCORRECTA
-- =====================================================

-- La versión incorrecta tiene firma:
-- create_p2p_loan(p_lender_tenant_id, p_borrower_contact_id, p_amount, ...)
-- Sin el parámetro p_i_am_lender necesario

DROP FUNCTION IF EXISTS create_p2p_loan(
  UUID, -- p_lender_tenant_id
  UUID, -- p_borrower_contact_id
  NUMERIC, -- p_amount
  VARCHAR, -- p_title
  TEXT, -- p_description
  DATE, -- p_due_date
  VARCHAR -- p_currency
);

-- =====================================================
-- VERIFICACIÓN
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migración 044 completada:';
  RAISE NOTICE '- Función create_p2p_loan incorrecta eliminada';
  RAISE NOTICE '- Solo queda la versión correcta con p_i_am_lender';
END $$;

-- Fin de migración 044
