// Edge Function: loan-confirm-return
// Página pública para confirmar devolución de préstamo desde WhatsApp
// v2: Soporte para comprobantes opcionales (foto/TEF)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SUPABASE_URL = 'https://qgjxkszfdoolaxmsupil.supabase.co';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const pathParts = url.pathname.split('/').filter(Boolean);

  // Esperamos: /loan-confirm-return/{loan_id}
  // O desde query param: ?loan_id=xxx
  const loanId = pathParts[1] || url.searchParams.get('loan_id');

  if (!loanId) {
    return renderErrorPage('Link inválido', 'No se encontró el ID del préstamo.');
  }

  // Inicializar Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Obtener datos del préstamo
    const { data: loan, error: loanError } = await supabase
      .from('agreements')
      .select(`
        id, title, status, due_date, amount, item_description, loan_type,
        created_at, metadata, tenant_id,
        borrower:tenant_contacts!tenant_contact_id(
          id, name,
          contact_profiles(first_name, phone_e164)
        ),
        lender:tenant_contacts!lender_tenant_contact_id(
          id, name,
          contact_profiles(first_name, phone_e164)
        )
      `)
      .eq('id', loanId)
      .single();

    if (loanError || !loan) {
      return renderErrorPage('Préstamo no encontrado', 'Este link puede haber expirado o el préstamo no existe.');
    }

    // Si lender no está, intentar obtenerlo desde metadata
    let lenderData = loan.lender;
    if (!lenderData) {
      const lenderContactId = loan.metadata?.original_context?.lender_contact_id;
      if (lenderContactId) {
        const { data: lenderFromMeta } = await supabase
          .from('tenant_contacts')
          .select('id, name, contact_profiles(first_name, phone_e164)')
          .eq('id', lenderContactId)
          .single();
        lenderData = lenderFromMeta;
      }
    }

    // Verificar estado del préstamo
    if (loan.status === 'completed') {
      return renderSuccessPage(loan, lenderData, true); // Ya estaba completado
    }

    if (loan.status === 'cancelled' || loan.status === 'rejected') {
      return renderErrorPage('Préstamo cancelado', 'Este préstamo fue cancelado y no puede marcarse como devuelto.');
    }

    // GET: Mostrar página de confirmación
    if (req.method === 'GET') {
      return renderConfirmationPage(loan, lenderData);
    }

    // POST: Procesar confirmación
    if (req.method === 'POST') {
      let note = '';
      let proofFile: File | null = null;
      let proofType = 'other';

      // Determinar tipo de contenido
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('multipart/form-data')) {
        // Manejar upload de archivo
        const formData = await req.formData();
        note = (formData.get('note') as string) || '';
        proofType = (formData.get('proofType') as string) || 'other';
        const file = formData.get('proof') as File | null;

        if (file && file.size > 0) {
          // Validar archivo
          if (file.size > MAX_FILE_SIZE) {
            return new Response(
              JSON.stringify({ success: false, error: 'El archivo es muy grande (máx 5MB)' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          if (!ALLOWED_TYPES.includes(file.type)) {
            return new Response(
              JSON.stringify({ success: false, error: 'Tipo de archivo no permitido' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
          proofFile = file;
        }
      } else {
        // JSON simple
        const body = await req.json().catch(() => ({}));
        note = body.note || '';
      }

      // Subir archivo si existe
      let proofUrl: string | null = null;
      let proofRecord: any = null;

      if (proofFile) {
        const fileExt = proofFile.name.split('.').pop() || 'jpg';
        const fileName = `${loanId}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('repayment-proofs')
          .upload(fileName, proofFile, {
            contentType: proofFile.type,
            upsert: false
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          return new Response(
            JSON.stringify({ success: false, error: 'Error al subir comprobante' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        proofUrl = `${SUPABASE_URL}/storage/v1/object/public/repayment-proofs/${fileName}`;

        // Guardar registro de comprobante
        const { data: proofData, error: proofError } = await supabase
          .from('loan_repayment_proofs')
          .insert({
            agreement_id: loanId,
            proof_type: proofType,
            file_url: proofUrl,
            file_name: proofFile.name,
            file_size: proofFile.size,
            mime_type: proofFile.type,
            note: note || null,
            created_by: loan.borrower?.id || null
          })
          .select()
          .single();

        if (proofError) {
          console.error('Proof record error:', proofError);
        } else {
          proofRecord = proofData;
        }
      }

      // Marcar como completado
      const { error: updateError } = await supabase
        .from('agreements')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString(),
          metadata: {
            ...loan.metadata,
            return_confirmation: {
              confirmed_at: new Date().toISOString(),
              confirmed_by: 'borrower',
              note: note || null,
              proof_id: proofRecord?.id || null,
              proof_url: proofUrl,
              source: 'whatsapp_button'
            }
          }
        })
        .eq('id', loanId);

      if (updateError) {
        return new Response(
          JSON.stringify({ success: false, error: 'Error al confirmar devolución' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Notificar al lender vía WhatsApp
      if (lenderData?.contact_profiles?.phone_e164) {
        await notifyLender(supabase, loan, lenderData, note, proofUrl);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Devolución confirmada', proofUrl }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response('Method not allowed', { status: 405 });

  } catch (error) {
    console.error('Error:', error);
    return renderErrorPage('Error', 'Ocurrió un error inesperado. Intenta de nuevo.');
  }
});

// Notificar al lender
async function notifyLender(supabase: any, loan: any, lender: any, note?: string, proofUrl?: string | null) {
  try {
    const { sendWhatsAppMessage, sendWhatsAppImage } = await import('../_shared/whatsapp-client.ts');

    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

    if (!phoneNumberId || !accessToken) return;

    const borrowerName = loan.borrower?.name || 'El prestatario';
    const isMoneyLoan = loan.loan_type === 'money' || loan.amount !== null;

    let message = '';
    if (isMoneyLoan) {
      const amount = loan.amount ? `$${loan.amount.toLocaleString('es-CL')}` : '';
      message = `✅ *Devolución confirmada*\n\n${borrowerName} confirmó que devolvió el préstamo de ${amount}.\n\nConcepto: ${loan.item_description || loan.title}`;
    } else {
      message = `✅ *Devolución confirmada*\n\n${borrowerName} confirmó que devolvió: ${loan.item_description || loan.title}`;
    }

    if (note) {
      message += `\n\n💬 Nota: "${note}"`;
    }

    // Si hay comprobante (imagen), enviarlo primero
    if (proofUrl && (proofUrl.endsWith('.jpg') || proofUrl.endsWith('.jpeg') || proofUrl.endsWith('.png') || proofUrl.endsWith('.webp'))) {
      try {
        await sendWhatsAppImage({
          phoneNumberId,
          accessToken,
          to: lender.contact_profiles.phone_e164,
          imageUrl: proofUrl,
          caption: message
        });
        return; // Ya enviamos mensaje con imagen
      } catch (imgError) {
        console.error('Error sending image, falling back to text:', imgError);
      }
    }

    // Si hay comprobante PDF, agregar link
    if (proofUrl && proofUrl.endsWith('.pdf')) {
      message += `\n\n📎 Comprobante: ${proofUrl}`;
    }

    await sendWhatsAppMessage({
      phoneNumberId,
      accessToken,
      to: lender.contact_profiles.phone_e164,
      text: message
    });

  } catch (error) {
    console.error('Error notifying lender:', error);
  }
}

// Renderizar página de confirmación
function renderConfirmationPage(loan: any, lender: any): Response {
  const isMoneyLoan = loan.loan_type === 'money' || loan.amount !== null;
  const borrowerName = loan.borrower?.contact_profiles?.first_name || loan.borrower?.name || 'Usuario';
  const lenderName = lender?.name || 'el prestamista';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatMoney = (amount: number) => {
    return `$${amount.toLocaleString('es-CL')}`;
  };

  const loanDisplay = isMoneyLoan
    ? formatMoney(loan.amount)
    : (loan.item_description || loan.title);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmar Devolución - PayMe</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      min-height: 100vh;
      padding: 16px;
    }
    .container {
      max-width: 440px;
      margin: 0 auto;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      margin-bottom: 16px;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px;
      color: #059669;
      margin-bottom: 8px;
    }
    .header p {
      color: #6b7280;
      font-size: 14px;
    }
    .summary {
      background: #f9fafb;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .summary-row:last-child {
      border-bottom: none;
    }
    .summary-label {
      color: #6b7280;
      font-size: 14px;
    }
    .summary-value {
      font-weight: 600;
      color: #111827;
      font-size: 14px;
    }
    .highlight {
      color: #059669;
      font-size: 20px;
    }

    /* Sección de comprobante */
    .proof-section {
      margin-bottom: 20px;
    }
    .proof-section label {
      display: block;
      font-size: 14px;
      color: #374151;
      margin-bottom: 8px;
    }
    .proof-toggle {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    }
    .proof-toggle button {
      flex: 1;
      padding: 10px;
      border: 1px solid #d1d5db;
      background: white;
      border-radius: 8px;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .proof-toggle button.active {
      border-color: #10b981;
      background: #ecfdf5;
      color: #059669;
    }
    .proof-toggle button:hover:not(.active) {
      border-color: #9ca3af;
    }
    .dropzone {
      border: 2px dashed #d1d5db;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s;
      display: none;
    }
    .dropzone.visible {
      display: block;
    }
    .dropzone:hover, .dropzone.dragover {
      border-color: #10b981;
      background: #f0fdf4;
    }
    .dropzone-icon {
      font-size: 32px;
      margin-bottom: 8px;
    }
    .dropzone-text {
      color: #6b7280;
      font-size: 14px;
    }
    .dropzone-hint {
      color: #9ca3af;
      font-size: 12px;
      margin-top: 4px;
    }
    .file-preview {
      display: none;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: #f0fdf4;
      border-radius: 8px;
      border: 1px solid #10b981;
    }
    .file-preview.visible {
      display: flex;
    }
    .file-preview-thumb {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      object-fit: cover;
      background: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
    }
    .file-preview-info {
      flex: 1;
      min-width: 0;
    }
    .file-preview-name {
      font-size: 14px;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .file-preview-size {
      font-size: 12px;
      color: #6b7280;
    }
    .file-preview-remove {
      padding: 6px;
      border: none;
      background: none;
      cursor: pointer;
      color: #dc2626;
      font-size: 18px;
    }

    .note-section {
      margin-bottom: 20px;
    }
    .note-section label {
      display: block;
      font-size: 14px;
      color: #374151;
      margin-bottom: 8px;
    }
    .note-section textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 16px;
      resize: none;
      font-family: inherit;
    }
    .note-section textarea:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
    }
    .note-section .helper {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
    .btn-primary {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: transform 0.1s, box-shadow 0.2s;
    }
    .btn-primary:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }
    .btn-primary:active {
      transform: translateY(0);
    }
    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
      transform: none;
    }
    .btn-primary .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .footer {
      text-align: center;
      margin-top: 16px;
    }
    .footer a {
      color: #6b7280;
      font-size: 14px;
      text-decoration: none;
    }
    .logo {
      text-align: center;
      margin-bottom: 16px;
      font-size: 28px;
    }
    .upload-progress {
      display: none;
      margin-top: 8px;
    }
    .upload-progress.visible {
      display: block;
    }
    .progress-bar {
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
    }
    .progress-bar-fill {
      height: 100%;
      background: #10b981;
      transition: width 0.3s;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">💰</div>

    <div class="card">
      <div class="header">
        <h1>Confirmar Devolución</h1>
        <p>Hola ${borrowerName}, confirma que devolviste este préstamo</p>
      </div>

      <div class="summary">
        <div class="summary-row">
          <span class="summary-label">${isMoneyLoan ? 'Monto' : 'Objeto'}</span>
          <span class="summary-value highlight">${loanDisplay}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">A quien</span>
          <span class="summary-value">${lenderName}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Fecha préstamo</span>
          <span class="summary-value">${formatDate(loan.created_at)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-label">Vencimiento</span>
          <span class="summary-value">${formatDate(loan.due_date)}</span>
        </div>
      </div>

      <!-- Sección de comprobante opcional -->
      <div class="proof-section">
        <label>📎 Adjuntar comprobante (opcional)</label>
        <div class="proof-toggle">
          <button type="button" id="btnPhoto" onclick="setProofType('photo')">📷 Foto</button>
          <button type="button" id="btnTef" onclick="setProofType('tef_receipt')">🏦 TEF</button>
          <button type="button" id="btnNone" class="active" onclick="setProofType('none')">Sin comprobante</button>
        </div>

        <div class="dropzone" id="dropzone">
          <div class="dropzone-icon">📤</div>
          <div class="dropzone-text">Toca para seleccionar o arrastra un archivo</div>
          <div class="dropzone-hint">Imagen o PDF (máx 5MB)</div>
        </div>

        <div class="file-preview" id="filePreview">
          <div class="file-preview-thumb" id="previewThumb">📄</div>
          <div class="file-preview-info">
            <div class="file-preview-name" id="fileName"></div>
            <div class="file-preview-size" id="fileSize"></div>
          </div>
          <button type="button" class="file-preview-remove" onclick="removeFile()">✕</button>
        </div>

        <div class="upload-progress" id="uploadProgress">
          <div class="progress-bar">
            <div class="progress-bar-fill" id="progressFill" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <div class="note-section">
        <label for="note">💬 Agregar nota (opcional)</label>
        <textarea id="note" rows="2" placeholder="Ej: Te transferí por app del banco"></textarea>
        <p class="helper">Esto se enviará al prestamista junto con la confirmación</p>
      </div>

      <button class="btn-primary" id="confirmBtn" onclick="confirmReturn()">
        <span id="btnText">✓ Confirmar Devolución</span>
      </button>

      <input type="file" id="fileInput" accept="image/*,.pdf" style="display: none">
    </div>

    <div class="footer">
      <a href="https://wa.me/56957519386?text=Hola, tengo un problema con un préstamo">
        ¿Tienes un problema? Contáctanos
      </a>
    </div>
  </div>

  <script>
    const loanId = '${loan.id}';
    let selectedFile = null;
    let proofType = 'none';

    // Setup dropzone
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const filePreview = document.getElementById('filePreview');

    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        handleFile(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        handleFile(e.target.files[0]);
      }
    });

    function setProofType(type) {
      proofType = type;
      document.querySelectorAll('.proof-toggle button').forEach(btn => btn.classList.remove('active'));

      if (type === 'photo') {
        document.getElementById('btnPhoto').classList.add('active');
        dropzone.classList.add('visible');
      } else if (type === 'tef_receipt') {
        document.getElementById('btnTef').classList.add('active');
        dropzone.classList.add('visible');
      } else {
        document.getElementById('btnNone').classList.add('active');
        dropzone.classList.remove('visible');
        removeFile();
      }
    }

    function handleFile(file) {
      // Validar tamaño
      if (file.size > 5 * 1024 * 1024) {
        alert('El archivo es muy grande (máximo 5MB)');
        return;
      }

      // Validar tipo
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        alert('Tipo de archivo no permitido. Usa JPG, PNG o PDF.');
        return;
      }

      selectedFile = file;

      // Mostrar preview
      dropzone.classList.remove('visible');
      filePreview.classList.add('visible');

      document.getElementById('fileName').textContent = file.name;
      document.getElementById('fileSize').textContent = formatBytes(file.size);

      const thumb = document.getElementById('previewThumb');
      if (file.type.startsWith('image/')) {
        thumb.innerHTML = '';
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.borderRadius = '6px';
        thumb.appendChild(img);
      } else {
        thumb.textContent = '📄';
      }
    }

    function removeFile() {
      selectedFile = null;
      fileInput.value = '';
      filePreview.classList.remove('visible');
      if (proofType !== 'none') {
        dropzone.classList.add('visible');
      }
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    async function confirmReturn() {
      const btn = document.getElementById('confirmBtn');
      const btnText = document.getElementById('btnText');
      const note = document.getElementById('note').value.trim();

      btn.disabled = true;
      btnText.innerHTML = '<div class="spinner"></div> Confirmando...';

      try {
        let response;

        if (selectedFile && proofType !== 'none') {
          // Enviar con archivo
          const formData = new FormData();
          formData.append('note', note);
          formData.append('proofType', proofType);
          formData.append('proof', selectedFile);

          // Mostrar progreso
          document.getElementById('uploadProgress').classList.add('visible');

          response = await fetch(window.location.href, {
            method: 'POST',
            body: formData
          });
        } else {
          // Enviar sin archivo
          response = await fetch(window.location.href, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note })
          });
        }

        const data = await response.json();

        if (data.success) {
          // Redirect a página de éxito
          document.body.innerHTML = \`
            <div class="container">
              <div class="card" style="text-align: center; padding: 40px;">
                <div style="font-size: 64px; margin-bottom: 16px;">✅</div>
                <h1 style="color: #059669; margin-bottom: 8px;">¡Devolución Confirmada!</h1>
                <p style="color: #6b7280; margin-bottom: 24px;">
                  Notificamos a ${lenderName} que devolviste el préstamo.
                </p>
                \${data.proofUrl ? '<p style="font-size: 14px; color: #10b981; margin-bottom: 16px;">📎 Comprobante adjuntado</p>' : ''}
                <p style="font-size: 14px; color: #9ca3af;">
                  Puedes cerrar esta página
                </p>
              </div>
            </div>
          \`;
        } else {
          throw new Error(data.error || 'Error al confirmar');
        }
      } catch (error) {
        alert('Error: ' + error.message);
        btn.disabled = false;
        btnText.textContent = '✓ Confirmar Devolución';
        document.getElementById('uploadProgress').classList.remove('visible');
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Renderizar página de éxito (préstamo ya completado)
function renderSuccessPage(loan: any, lender: any, alreadyCompleted: boolean): Response {
  const lenderName = lender?.name || 'el prestamista';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Préstamo Devuelto - PayMe</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
      min-height: 100vh;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { max-width: 440px; width: 100%; }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #059669; margin-bottom: 8px; font-size: 24px; }
    p { color: #6b7280; margin-bottom: 24px; }
    .note { font-size: 14px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">✅</div>
      <h1>${alreadyCompleted ? 'Préstamo Ya Devuelto' : '¡Devolución Confirmada!'}</h1>
      <p>${alreadyCompleted
        ? 'Este préstamo ya fue marcado como devuelto anteriormente.'
        : `Notificamos a ${lenderName} que devolviste el préstamo.`}</p>
      <p class="note">Puedes cerrar esta página</p>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}

// Renderizar página de error
function renderErrorPage(title: string, message: string): Response {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - PayMe</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #fef2f2;
      min-height: 100vh;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container { max-width: 440px; width: 100%; }
    .card {
      background: white;
      border-radius: 16px;
      padding: 40px 24px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 16px; }
    h1 { color: #dc2626; margin-bottom: 8px; font-size: 24px; }
    p { color: #6b7280; margin-bottom: 24px; }
    a {
      color: #059669;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <div class="icon">❌</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="https://wa.me/56957519386?text=Hola, tengo un problema con un link de préstamo">
        Contactar soporte
      </a>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 400,
    headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' }
  });
}
