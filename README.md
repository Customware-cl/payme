# PayMe 💳

Sistema completo de pagos y recordatorios por WhatsApp/Telegram desarrollado por Customware.

## Características

### Frontend
- 🚀 Interfaz moderna y responsiva con React 18
- 💱 Múltiples métodos de pago
- 📊 Dashboard de analytics
- ⚡ Rendimiento optimizado con Vite

### Backend
- 📱 Recordatorios automáticos por WhatsApp y Telegram
- 🤖 Bot conversacional con inline keyboards (Telegram)
- 🔄 Pagos recurrentes con confirmación automática
- ✅ Gestión de opt-in cumpliendo políticas de WhatsApp
- 🌍 Multi-tenant con aislamiento completo de datos
- ⏰ Zonas horarias y programación inteligente
- 🔒 Seguridad con RLS y autenticación
- 📊 Métricas y seguimiento de entregas

## Tecnologías

### Frontend
- React 18 + TypeScript + Vite
- Styled Components
- React Query
- React Hook Form + Yup
- Lucide React

### Backend
- Supabase (PostgreSQL + Edge Functions + Auth + RLS)
- WhatsApp Cloud API con templates aprobadas
- Telegram Bot API con inline keyboards
- Scheduler con pg_cron para envíos automáticos
- Deno runtime para Edge Functions

## Instalación

```bash
# Clonar el repositorio
git clone https://github.com/Customware-cl/payme.git
cd payme

# Instalar dependencias del frontend
npm install

# Instalar Supabase CLI
npm install -g supabase

# Iniciar servicios locales de Supabase
supabase start
```

## Scripts Disponibles

### Frontend
- `npm run dev` - Inicia el servidor de desarrollo (Vite)
- `npm run build` - Construye la aplicación para producción
- `npm run preview` - Previsualiza la build de producción
- `npm run lint` - Ejecuta el linter
- `npm run test` - Ejecuta las pruebas

### Backend (Supabase)
- `supabase start` - Inicia Supabase local
- `supabase functions deploy` - Deploya edge functions
- `supabase db reset` - Resetea la base de datos local
- `supabase db push` - Aplica migraciones

## Estructura del Proyecto

```
.
├── src/                    # Frontend React
│   ├── components/         # Componentes reutilizables
│   ├── pages/             # Páginas de la aplicación
│   ├── services/          # Servicios y API calls
│   ├── utils/             # Utilidades y helpers
│   └── types/             # Definiciones de TypeScript
├── supabase/              # Backend Supabase
│   ├── functions/         # Edge Functions (webhooks, procesamiento)
│   │   ├── wa_webhook/    # Webhook WhatsApp
│   │   └── tg_webhook_simple/  # Webhook Telegram con inline keyboards
│   └── migrations/        # Migraciones de base de datos
├── lib/                   # Librerías compartidas backend
└── types/                 # Types de base de datos
```

## Funcionalidades Telegram

El bot de Telegram incluye:
- ✅ **Inline Keyboards** para comandos principales (/start)
- 📅 **Botones contextuales** para selección de fechas
- ✅ **Botones de confirmación** en el flujo de préstamos
- 🔄 **Verificación de contactos** antes de crear préstamos
- 💾 **Persistencia de estado** conversacional

## Configuración

### Variables de Entorno

Copia `.env.example` a `.env` y configura:

```env
# Supabase
SUPABASE_URL=tu_url_de_supabase
SUPABASE_ANON_KEY=tu_key_publica
SUPABASE_SERVICE_ROLE_KEY=tu_key_privada

# WhatsApp
WHATSAPP_ACCESS_TOKEN=tu_token
WHATSAPP_PHONE_NUMBER_ID=tu_phone_id
WHATSAPP_VERIFY_TOKEN=tu_verify_token

# Telegram
TELEGRAM_BOT_TOKEN=tu_bot_token
TELEGRAM_SECRET_TOKEN=tu_secret
```

## Contribuir

1. Fork el proyecto
2. Crea tu feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está licenciado bajo la Licencia MIT.