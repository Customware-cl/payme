# Cuestionario Google Forms - Validación Payme (A vs B)

**Versión**: 2.1 (Mejorada con recomendaciones Lean Startup + diferenciación dinero/objetos)
**Fecha**: 2025-11-03
**Objetivo**: Validar cuál oportunidad (A o B) tiene mayor demanda + canal preferido + smoke test real
**Duración estimada**: 6-8 minutos
**Total preguntas**: 21 (17 obligatorias + 4 condicionales: P5, P8b, P14b, P17)

---

## 📋 INSTRUCCIONES PARA CREAR EL FORMULARIO

### Configuración General de Google Forms

1. **Título del formulario**: "Ayúdame a validar una idea 💡 (5 min)"
2. **Descripción**:
   ```
   Hola! Estoy validando una idea de negocio y necesito tu ayuda.

   Son hasta 21 preguntas rápidas sobre problemas cotidianos con pagos y deudas.
   No hay respuestas correctas o incorrectas, solo quiero conocer tu experiencia.

   Tiempo estimado: 6-8 minutos
   Tus respuestas son anónimas.

   ¡Gracias por tu tiempo! 🙏
   ```
3. **Configuración**:
   - ✅ Recopilar direcciones de email: NO (para aumentar tasa de respuesta)
   - ✅ Limitar a 1 respuesta: SÍ (evita spam)
   - ✅ Mostrar barra de progreso: SÍ
   - ✅ Orden aleatorio de preguntas: NO (mantener lógica)

---

## 🔢 SECCIÓN 1: DATOS DEMOGRÁFICOS (Obligatorias)

### P1: ¿Cuál es tu edad?
**Tipo**: Opción múltiple (obligatoria)

- [ ] 18-25 años
- [ ] 26-35 años
- [ ] 36-45 años
- [ ] 46-55 años
- [ ] 56+ años

---

### P2: ¿Cuál describe mejor tu ocupación actual?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Empleado(a) dependiente
- [ ] Independiente / Freelancer
- [ ] Emprendedor(a) / Dueño(a) de negocio
- [ ] Estudiante
- [ ] Dueña(o) de casa
- [ ] Jubilado(a)
- [ ] Otro

---

## 💰 SECCIÓN 2: PAGOS RECURRENTES (Opción B)

**Texto introductorio**:
```
Las siguientes preguntas son sobre cuentas o servicios que pagas mensualmente
(dividendo, luz, agua, internet, tarjetas, seguros, etc.)
```

### P3: ¿Cuántas cuentas o servicios pagas mensualmente?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Ninguna (saltar a SECCIÓN 3)
- [ ] 1-3 cuentas
- [ ] 4-6 cuentas
- [ ] 7-10 cuentas
- [ ] Más de 10 cuentas

**Lógica de salto**: Si responde "Ninguna" → Ir directo a P8 (SECCIÓN 3)

---

### P4: En los últimos 6 meses, ¿has olvidado pagar alguna cuenta a tiempo?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Nunca (saltar a P6)
- [ ] Sí, 1-2 veces
- [ ] Sí, 3-5 veces
- [ ] Sí, más de 5 veces

**Lógica de salto**: Si responde "Nunca" → Saltar P5, ir a P6

---

### P5: ¿Qué consecuencia tuviste por olvidar un pago? (puedes marcar varias)
**Tipo**: Casillas de verificación (opcional, solo aparece si P4 ≠ "Nunca")

- [ ] Multa o interés ($2.000 - $10.000)
- [ ] Multa o interés ($10.000+)
- [ ] Corte de servicio (luz, agua, internet)
- [ ] Estrés / Preocupación
- [ ] Tuve que pagar en un lugar físico (perdí tiempo)
- [ ] Otro

---

### P6: ¿Qué tan estresante es para ti acordarte de pagar todas tus cuentas a tiempo?
**Tipo**: Escala lineal (obligatoria)

```
1 = No me estresa nada, es fácil
10 = Me estresa muchísimo, olvido seguido

[Escala 1 ──────────── 10]
```

---

### P7: ¿Cómo te acuerdas actualmente de pagar tus cuentas? (puedes marcar varias)
**Tipo**: Casillas de verificación (obligatoria)

- [ ] Memoria / Me acuerdo solo(a)
- [ ] Calendario o alarmas en el celular
- [ ] Alguien más me recuerda (pareja, familiar)
- [ ] Pago automático (PAC / débito automático)
- [ ] App de banco o finanzas personales
- [ ] Espero a recibir el aviso de vencimiento
- [ ] No tengo un método, a veces olvido

---

## 🤝 SECCIÓN 3: DEUDAS INFORMALES (Opción A)

**Texto introductorio**:
```
Las siguientes preguntas son sobre dinero u objetos que prestas o te prestan
de forma informal (amigos, familia, compañeros de trabajo).

Ejemplos: plata prestada, herramientas, libros, ropa, equipos, etc.
```

### P8: En el último año, ¿has prestado o te han prestado dinero u objetos de forma informal?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Nunca, ni presto ni me prestan (saltar a SECCIÓN 4)
- [ ] Sí, he prestado dinero u objetos
- [ ] Sí, me han prestado dinero u objetos
- [ ] Ambos (presto y me prestan)

**Lógica de salto**: Si responde "Nunca..." → Ir directo a P12 (SECCIÓN 4)

---

### P8b: [Solo si P8 ≠ "Nunca"] ¿En cuál de estas situaciones has experimentado MÁS incomodidad al recordar o que te recuerden?
**Tipo**: Opción múltiple (opcional, solo aparece si P8 ≠ "Nunca")

- [ ] Dinero prestado 💰 (me incomoda más recordar/pedir plata)
- [ ] Objetos prestados 📦 (me incomoda más recordar/pedir objetos de vuelta)
- [ ] Ambos por igual
- [ ] Nunca he hecho el recordatorio (evito el conflicto)

**Lógica de salto**: Solo aparece si P8 = "Sí, he prestado" o "Sí, me han prestado" o "Ambos"

**🎯 Qué mide**: Diferenciación crítica entre pain de dinero vs pain de objetos

**Por qué es crítica (recomendación agente asesor-lean-startup):**
- Separa la señal del ruido: ¿el pain es por dinero o por objetos?
- Permite análisis diferenciado para decisión de MVP
- Si ≥70% dice "dinero" → construir MVP solo para dinero (validar objetos en fase 2)
- Si ≥70% dice "objetos" → considerar MVP enfocado en objetos
- Si distribución 50/50 → pain no está claro, considerar experimentos separados

---

### P9: ¿Has tenido problemas para que te devuelvan dinero/objetos o para acordarte de devolver?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Nunca he tenido problemas
- [ ] Sí, me han quedado debiendo y no devolvieron
- [ ] Sí, yo olvidé devolver y fue incómodo
- [ ] Sí, ambos (he quedado debiendo y me han quedado debiendo)

---

### P10: ¿Qué tan incómodo te resulta recordarle a alguien que te debe dinero o un objeto prestado?
**Tipo**: Escala lineal (obligatoria)

```
1 = No me incomoda nada, es fácil cobrar/pedir de vuelta
10 = Extremadamente incómodo, casi no puedo hacerlo

[Escala 1 ──────────── 10]
```

---

### P11: ¿Qué tan estresante es para ti gestionar estas deudas informales?
**Tipo**: Escala lineal (obligatoria)

```
1 = No me estresa, lo manejo bien
10 = Me genera mucha ansiedad

[Escala 1 ──────────── 10]
```

---

## 🎯 SECCIÓN 4: COMPARACIÓN Y WILLINGNESS TO PAY

**Texto introductorio**:
```
Ahora te voy a contar brevemente lo que estoy construyendo:

"Payme es un servicio que te envía recordatorios automáticos
para que nunca olvides pagar tus cuentas o devolver dinero prestado."

Por ejemplo:
• "Hola Juan, recuerda pagar dividendo el 5 de noviembre 💡"
• "Hola María, recuerda devolver $20.000 a Pablo el viernes 💰"
• "Hola Pedro, recuerda devolver el taladro que te prestó Luis 🔧"

Después de pagar/devolver, confirmas y Payme lo marca como completado.
```

### P12: De estos dos usos, ¿cuál te resultaría MÁS ÚTIL?
**Tipo**: Opción múltiple (obligatoria)

- [ ] **Opción 1**: Recordatorios para cuentas recurrentes (dividendo, luz, agua, internet, etc.)
- [ ] **Opción 2**: Recordatorios para deudas informales (dinero u objetos prestados a amigos/familia)
- [ ] Ambos me parecen igual de útiles
- [ ] Ninguno me parece útil

---

### P13: ¿Por qué medio te gustaría recibir estos recordatorios? (puedes marcar más de uno)
**Tipo**: Casillas de verificación (obligatoria)

- [ ] WhatsApp (mensaje de texto)
- [ ] Email / Correo electrónico
- [ ] SMS (mensaje de texto normal)
- [ ] Notificación push de una app móvil
- [ ] Llamada telefónica automática
- [ ] Telegram u otro chat
- [ ] No me importa el canal, cualquiera sirve
- [ ] Prefiero gestionarlo yo mismo (calendario/alarmas)

---

### P14: ¿Pagas actualmente por alguna app o servicio que te ayude con gestión financiera, recordatorios o pagos?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Sí, pago por apps/servicios de este tipo
- [ ] No, solo uso apps o herramientas gratuitas
- [ ] No uso ninguna app de este tipo (solo memoria/calendario del celular)

**🎯 Validación crítica:** Esta pregunta valida COMPORTAMIENTO PASADO (qué haces hoy) en lugar de intención futura.

---

### P14b: [Solo si responde "Sí" en P14] ¿Cuánto pagas mensualmente en total por estos servicios?
**Tipo**: Opción múltiple (opcional, solo aparece si P14 = "Sí")

- [ ] $990 o menos
- [ ] $1.990-$2.990
- [ ] $3.990-$4.990
- [ ] Más de $5.000

**Lógica de salto**: Solo aparece si P14 = "Sí, pago por apps"

---

### P15: Si este servicio te ahorra multas, estrés o incomodidad, ¿cuánto estarías dispuesto a pagar mensualmente?
**Tipo**: Opción múltiple (obligatoria)

- [ ] $0 - Solo lo usaría si es 100% gratis
- [ ] $990/mes (precio de un café)
- [ ] $1.990/mes (precio de un streaming)
- [ ] $2.990/mes (precio de un gym básico)
- [ ] $4.990/mes o más
- [ ] No lo usaría ni gratis

---

### P16: Si Payme estuviera disponible HOY, ¿lo probarías?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Sí, definitivamente lo probaría
- [ ] Tal vez, dependería de cómo funcione
- [ ] No, no me interesa

---

### P17: Si respondes "Sí" o "Tal vez" en la pregunta anterior, ¿para qué lo usarías PRIMERO?
**Tipo**: Opción múltiple (opcional, solo si P16 = "Sí" o "Tal vez")

- [ ] Para recordar pagos de cuentas recurrentes
- [ ] Para recordar deudas informales (dinero u objetos prestados)
- [ ] Para ambos desde el inicio
- [ ] No estoy seguro(a) todavía

**Lógica de salto**: Solo aparece si P16 = "Sí, definitivamente" o "Tal vez"

---

## 🎁 SECCIÓN 5: CIERRE Y SMOKE TEST

### P18: ¿Quieres ser de los primeros en probar Payme cuando lance la beta?
**Tipo**: Respuesta corta (opcional)

```
Si quieres ser early adopter, déjanos tu WhatsApp o email:
(Ej: +56912345678 o nombre@email.com)

[Campo de texto libre]
```

**Nota**: Hacer esta pregunta OPCIONAL para no frenar tasa de respuesta.

---

### P19: 🚀 [SMOKE TEST REAL] Payme lanzará su beta en 2 semanas
**Tipo**: Opción múltiple (obligatoria)

**Texto explicativo:**
```
Los primeros 50 usuarios tendrán acceso prioritario con:
• 30 días GRATIS (sin tarjeta de crédito)
• Recordatorios ilimitados
• Soporte directo del equipo

Después del trial: $2.990/mes (cancela cuando quieras)
```

**¿Quieres reservar tu cupo para la beta?**

- [ ] Sí, quiero probar la beta AHORA (dejaré mi contacto arriba en P18)
- [ ] Tal vez más adelante, avísame cuando lance oficialmente
- [ ] No me interesa probar la beta

**🎯 Validación crítica:** Esta pregunta convierte INTENCIÓN en ACCIÓN. Solo los comprometidos dirán "Sí".

---

### MENSAJE FINAL (página de confirmación)

```
¡Gracias por tu tiempo! 🙏

Tus respuestas me ayudan un montón a entender si voy por buen camino.

Si conoces a alguien más que pueda ayudarme, comparte este formulario:
[Link del formulario]

---

Si quieres seguir el progreso de Payme:
• Instagram: @payme.chile (ejemplo)
• Web: www.payme.cl (ejemplo)

¡Nos vemos pronto! 🚀
```

---

## 📊 ANÁLISIS DE RESULTADOS - CÓMO INTERPRETAR

Una vez que tengas **50+ respuestas**, descarga las respuestas en Excel y analiza:

### Métricas Clave a Calcular

#### **Para Opción B (Pagos Recurrentes):**

```excel
Pain_B_Promedio = PROMEDIO(P6)
% Olvidó_Pagos = CONTAR.SI(P4, ">Nunca") / TOTAL * 100
% Prioriza_B = CONTAR.SI(P12, "Opción 1") / TOTAL * 100
% Usaría_Para_B = CONTAR.SI(P15, "Para recordar pagos") / TOTAL * 100
```

**Señal FUERTE para B:**
- Pain_B_Promedio ≥ 7/10
- % Olvidó_Pagos ≥ 60%
- % Prioriza_B ≥ 55%
- % Usaría_Para_B ≥ 50%

---

#### **Para Opción A (Deudas Informales):**

```excel
Pain_A_Incomodidad = PROMEDIO(P10)
Pain_A_Estrés = PROMEDIO(P11)
Pain_A_Promedio = (Pain_A_Incomodidad + Pain_A_Estrés) / 2

% Presta_Pide = CONTAR.SI(P8, ">Nunca") / TOTAL * 100
% Prioriza_A = CONTAR.SI(P12, "Opción 2") / TOTAL * 100
% Usaría_Para_A = CONTAR.SI(P17, "Para recordar deudas") / TOTAL * 100

# CRÍTICO: Diferenciación Dinero vs Objetos (P8b)
% Pain_Dinero = CONTAR.SI(P8b, "Dinero prestado") / TOTAL_P8b * 100
% Pain_Objetos = CONTAR.SI(P8b, "Objetos prestados") / TOTAL_P8b * 100
% Pain_Ambos = CONTAR.SI(P8b, "Ambos por igual") / TOTAL_P8b * 100
% Evita_Conflicto = CONTAR.SI(P8b, "Nunca he hecho el recordatorio") / TOTAL_P8b * 100
```

**Señal FUERTE para A:**
- Pain_A_Promedio ≥ 7/10
- % Presta_Pide ≥ 70%
- % Prioriza_A ≥ 55%
- % Usaría_Para_A ≥ 50%

**Decisión CRÍTICA (Dinero vs Objetos):**
- Si % Pain_Dinero ≥ 70% → **Construir MVP solo para dinero** (validar objetos en fase 2)
- Si % Pain_Objetos ≥ 70% → Considerar MVP enfocado en objetos
- Si % Pain_Ambos ≥ 40% → Pain está distribuido, MVP híbrido o experimentar separadamente
- Si % Evita_Conflicto ≥ 40% → ⚠️ Problema: usuarios evitan el conflicto (pain alto pero no accionan)

---

#### **Willingness to Pay (general):**

```excel
WTP_Promedio = Calcular promedio numérico excluyendo "$0" y "No usaría"

% Pagaría_Algo = (Respuestas con $990 o más) / TOTAL * 100
% No_Pagaría = (Respuestas con $0 o "No usaría") / TOTAL * 100
```

**Señal de viabilidad comercial:**
- % Pagaría_Algo ≥ 40% → Hay willingness to pay real
- % No_Pagaría > 60% → Problema con pricing o value prop

---

#### **Canal Preferido (H8):**

```excel
% WhatsApp = CONTAR.SI(P13, "WhatsApp") / TOTAL * 100
% Email = CONTAR.SI(P13, "Email") / TOTAL * 100
% App = CONTAR.SI(P13, "App móvil") / TOTAL * 100
% SMS = CONTAR.SI(P13, "SMS") / TOTAL * 100
% No_Importa = CONTAR.SI(P13, "No me importa el canal") / TOTAL * 100
```

**Señal de validación de canal:**
- % WhatsApp ≥ 60% → Canal validado, seguir con arquitectura actual
- % WhatsApp < 40% → RIESGO ALTO, considerar pivotar canal
- % Email + App > WhatsApp → Necesitas app móvil, no solo WhatsApp bot

---

#### **Comportamiento Pasado (mejora agente):**

```excel
% Paga_Apps = CONTAR.SI(P14, "Sí, pago por apps") / TOTAL * 100
% Solo_Gratis = CONTAR.SI(P14, "No, solo gratis") / TOTAL * 100
% No_Usa_Apps = CONTAR.SI(P14, "No uso ninguna app") / TOTAL * 100

WTP_Actual_Promedio = PROMEDIO(P14b [solo quienes respondieron Sí en P14])
```

**Señal de comportamiento real:**
- % Paga_Apps ≥ 30% → Target tiene hábito de pagar por apps, buena señal
- % Paga_Apps < 10% → Target acostumbrado a gratis, pricing será desafío
- WTP_Actual_Promedio → Benchmark para pricing de Payme

---

#### **Intención de Uso:**

```excel
% Usaría_Definitivamente = CONTAR.SI(P16, "Sí, definitivamente") / TOTAL * 100
% Usaría_Tal_Vez = CONTAR.SI(P16, "Tal vez") / TOTAL * 100
% No_Usaría = CONTAR.SI(P16, "No, no me interesa") / TOTAL * 100
```

**Señal de product-market fit:**
- % Usaría_Definitivamente ≥ 30% → Fuerte interés
- % (Sí + Tal vez) ≥ 70% → Interés generalizado
- % No_Usaría > 50% → Problema con propuesta de valor

---

#### **Smoke Test Real (mejora agente):**

```excel
% Beta_Ahora = CONTAR.SI(P19, "Sí, quiero probar la beta AHORA") / TOTAL * 100
% Beta_Tal_Vez = CONTAR.SI(P19, "Tal vez más adelante") / TOTAL * 100
% Beta_No = CONTAR.SI(P19, "No me interesa") / TOTAL * 100

Conversion_Rate = % Beta_Ahora / % Usaría_Definitivamente (P16)
```

**Señal de compromiso real:**
- % Beta_Ahora ≥ 15% → Compromiso real, hay early adopters
- % Beta_Ahora < 5% → Alto sesgo de cortesía, intención ≠ acción
- Conversion_Rate ≥ 40% → Buena conversión de intención a acción
- Conversion_Rate < 20% → Demasiado sesgo, validar con experimentos externos

---

## 🎯 CRITERIOS DE DECISIÓN POST-ENCUESTA

### **Escenario 1: Opción B GANA** ✅

**Condiciones:**
- Pain_B_Promedio > Pain_A_Promedio (al menos 1.5 puntos diferencia)
- % Prioriza_B > 55%
- % Olvidó_Pagos > 60%
- WTP promedio ≥ $990

**Decisión:**
→ **CONSTRUIR PARA PAGOS RECURRENTES (B)**

**Próximos pasos:**
1. Diseñar landing page enfocada en "Nunca más olvides un pago"
2. Crear onboarding para: dividendo, luz, agua, internet, tarjetas
3. Considerar feature secundaria de deudas informales más adelante

**Value Prop refinada:**
```
Headline: "Nunca más pagues multas por olvidar tus cuentas"
Subheadline: "Payme te recuerda por WhatsApp 3 días antes de cada vencimiento"
```

---

### **Escenario 2: Opción A GANA** ✅

**Condiciones:**
- Pain_A_Promedio > Pain_B_Promedio (al menos 1.5 puntos diferencia)
- % Prioriza_A > 55%
- % Presta_Pide > 70%
- Incomodidad (P10) ≥ 7/10

**Decisión:**
→ **CONSTRUIR PARA DEUDAS INFORMALES (A)**

**Próximos pasos:**
1. Diseñar landing page enfocada en "Retomar confianzas"
2. Mantener flujo conversacional actual del código
3. Fix urgente del sistema de recordatorios automáticos

**Value Prop refinada:**
```
Headline: "Cobra sin incomodidad, paga sin olvidos"
Subheadline: "Payme te ayuda a gestionar deudas informales por WhatsApp"
```

---

### **Escenario 3: EMPATE TÉCNICO** ⚖️

**Condiciones:**
- Pain_B y Pain_A muy similares (diferencia < 1 punto)
- % Prioriza_B ≈ % Prioriza_A (ambos 40-50%)
- Alto % responde "Ambos igual de útiles" (>30%)

**Decisión:**
→ **CONSTRUIR MVP HÍBRIDO O A/B TEST**

**Opción 3A: MVP Híbrido**
- Construir sistema flexible que funcione para ambos casos
- Dejar que usuario elija qué quiere recordar (pagos o deudas)
- Medir engagement de cada segmento en primeros 30 días

**Opción 3B: A/B Test con Landing Pages**
- Crear 2 landing pages separadas
- Distribuir $50k ads en cada una
- El que convierta >2x mejor → Es el ganador

---

### **Escenario 4: NINGUNA VALIDA** ❌

**Condiciones:**
- Pain_B < 5/10 Y Pain_A < 5/10
- % No_Usaría > 50%
- % No_Pagaría > 70%
- % Prioriza "Ninguno útil" > 30%

**Decisión:**
→ **PIVOTAR PROPUESTA DE VALOR O PROBLEMA**

**Posibles causas:**
1. El pain no es real o no es suficientemente intenso
2. La solución (WhatsApp recordatorios) no calza
3. Segmento encuestado no es el target correcto
4. Pricing mal explicado o demasiado alto

**Próximos pasos:**
1. Hacer 10 entrevistas profundas 1-a-1 con respondentes
2. Entender por qué no resuena
3. Reformular hipótesis de valor
4. Considerar otras soluciones al problema (no solo recordatorios)

---

## 📈 META DE RESPUESTAS

**Mínimo para decisión confiable**: 50 respuestas
**Óptimo**: 100-150 respuestas
**Ideal**: 200+ respuestas

### Cómo Distribuir el Formulario

**Canales orgánicos (gratis):**
- ✅ WhatsApp: Grupos personales, laborales, comunidades
- ✅ Instagram Stories: "Ayúdame con una encuesta de 5 min"
- ✅ LinkedIn: Post orgánico en tu red
- ✅ Facebook: Grupos de emprendimiento, finanzas personales
- ✅ Email: Lista de contactos personales

**Canales pagados (opcional):**
- 💰 Ads de Instagram/Facebook: $20.000 CLP (target 150 respuestas)
- 💰 LinkedIn Ads: $30.000 CLP (target profesionales 30-50 años)
- 💰 Google Ads: $20.000 CLP (keywords: "olvidar pagar cuenta")

**Incentivo (opcional):**
```
Al final del formulario, sortear:
• 1 cupón Uber Eats $20.000
• 3 meses gratis de Payme cuando lance

Condición: Dejar email/WhatsApp en P16
```

---

## 🔬 HIPÓTESIS QUE RESUELVE ESTE CUESTIONARIO

### **Hipótesis Central**

> "Existe una demanda real y disposición a pagar por un servicio de recordatorios automáticos vía WhatsApp, ya sea para pagos recurrentes (B) o deudas informales (A)."

### **Sub-hipótesis a validar:**

#### **H1: Intensidad del Pain**
- **Hipótesis**: El problema de olvidar pagos/deudas genera estrés significativo (≥7/10)
- **Medido en**: P6 (pagos), P10-P11 (deudas)
- **Apunta a**: Si pain <5, el problema no existe o no duele suficiente

#### **H2: Frecuencia del Problema**
- **Hipótesis**: El problema ocurre regularmente (no es one-time)
- **Medido en**: P3 (cantidad cuentas), P4 (frecuencia olvidos), P8 (frecuencia préstamos)
- **Apunta a**: Si frecuencia baja, no habrá engagement recurrente

#### **H3: Consecuencias Tangibles**
- **Hipótesis**: Olvidar pagos tiene consecuencias reales (multas, cortes, estrés)
- **Medido en**: P5 (consecuencias), monto de multas
- **Apunta a**: Si consecuencias triviales, no hay urgencia para solución

#### **H4: Métodos Actuales Insuficientes**
- **Hipótesis**: Las soluciones actuales no funcionan bien (memoria, alarmas)
- **Medido en**: P7 (métodos actuales) cruzado con P4 (olvidos)
- **Apunta a**: Si ya tienen solución que funciona, no necesitan Payme

#### **H5: Preferencia de Segmento (A vs B)**
- **Hipótesis**: Uno de los dos segmentos (A o B) tiene mayor demanda
- **Medido en**: P12 (comparación directa), P17 (usaría primero para)
- **Apunta a**: Cuál segmento priorizar para MVP

#### **H6: Willingness to Pay**
- **Hipótesis**: Las personas pagarían por evitar el pain identificado
- **Medido en**: P15 (WTP declarado), P14+P14b (comportamiento actual), cruzado con P6/P10 (pain scores)
- **Apunta a**: Si WTP = $0, es un problema "nice-to-have", no "must-have"
- **Validación mejorada**: Cruzar WTP declarado (P15) con cuánto pagan HOY (P14b)

#### **H7: Intención de Adopción**
- **Hipótesis**: Existe interés real en probar el producto (no solo curiosidad)
- **Medido en**: P16 (intención uso), P19 (smoke test beta), P18 (dejar contacto)
- **Apunta a**: Si <30% probaría, hay problema con propuesta de valor
- **Validación mejorada**: Medir conversión de intención (P16) a acción (P19)

#### **H8: Canal Preferido** 🆕
- **Hipótesis**: WhatsApp es el canal preferido para recibir recordatorios
- **Medido en**: P13 (canal preferido)
- **Apunta a**: Si WhatsApp <50%, arquitectura actual está en riesgo
- **Decisión crítica**: Afecta diseño técnico completo del producto

---

## 🎯 A QUÉ SOLUCIÓN APUNTA CADA RESULTADO

### **Si B (Pagos Recurrentes) gana:**

**Construir:**
```
MVP enfocado en recordatorios de servicios recurrentes:

Features core:
1. Onboarding: "¿Qué pagas mensualmente?"
2. Configuración: Fecha de vencimiento + días de anticipación
3. Recordatorio WhatsApp: "Hola {nombre}, recuerda pagar {servicio} el {fecha}"
4. Confirmación: Usuario responde "Pagado ✅"
5. Reconfiguración automática: "¿Programo para próximo mes?"

Monetización:
• Freemium: 2 recordatorios gratis
• Plan Básico ($1.990/mes): Hasta 10 recordatorios
• Plan Pro ($2.990/mes): Ilimitado + reportes

Segmento target:
• Personas 26-50 años con familia
• Pagan 5-10 cuentas mensuales
• Han pagado multas en últimos 6 meses
```

**No construir (deprioritizar):**
- Flujo de confirmación bidireccional (no aplica a pagos)
- Sistema de borrower/lender (no hay 2da persona)
- Features de deudas informales (dejar para fase 2)

---

### **Si A (Deudas Informales) gana:**

**Construir:**
```
MVP enfocado en deudas P2P (fundamento original):

Features core:
1. Conversación: "¿A quién le prestas?" → "¿Cuánto?" → "¿Cuándo debe devolver?"
2. Solicitud de confirmación al borrower (vía WhatsApp)
3. Borrower acepta/rechaza
4. Recordatorios automáticos en fecha acordada
5. Confirmación de devolución

Monetización:
• Etapa 1: Gratis (validar product-market fit)
• Etapa 2: Freemium o modelo por transacción
  - Opción: $200 por préstamo gestionado
  - Opción: $1.990/mes ilimitado

Segmento target:
• Personas 25-40 años
• Prestan/piden dinero mensualmente
• Incomodidad de cobrar ≥7/10
• Han tenido experiencia negativa (no les devolvieron)
```

**No construir (deprioritizar):**
- Features de pagos recurrentes automáticos
- Integración con medios de pago (viene en Etapa 2)
- Reportería compleja (viene en Etapa 2)

---

### **Si EMPATE:**

**Construir MVP Flexible:**
```
Sistema de recordatorios genérico que funcione para ambos:

Onboarding:
"¿Qué quieres que Payme te recuerde?"
→ Opción 1: Una cuenta que pagas (luz, dividendo, etc.)
→ Opción 2: Dinero que prestaste o te prestaron

Flujo A (Pagos):
• Configuración simple: nombre + fecha + recurrencia
• Recordatorio WhatsApp directo (sin 2da persona)

Flujo B (Deudas):
• Configuración con 2da persona + confirmación bidireccional
• Recordatorio solo si borrower acepta

Motor de recordatorios compartido:
• Mismo scheduler_dispatch para ambos
• Misma tabla reminder_instances
• Distinguir por tipo: "payment" vs "debt"
```

**Medir en primeros 60 días:**
```sql
-- ¿Qué tipo de recordatorio usan más?
SELECT type, COUNT(*)
FROM agreements
GROUP BY type;

-- ¿Cuál tiene mayor engagement?
SELECT type, AVG(engagement_score)
FROM user_metrics
GROUP BY type;
```

**Decisión post-60 días:**
- Si tipo A > 70% del uso → Dejar solo A, deprecar B
- Si tipo B > 70% del uso → Dejar solo B, deprecar A
- Si 50/50 → Mantener ambos (producto más complejo pero mayor TAM)

---

## ✅ CHECKLIST PRE-LANZAMIENTO DEL FORMULARIO

Antes de distribuir masivamente, verificar:

- [ ] Formulario creado en Google Forms
- [ ] Todas las preguntas (P1-P16) agregadas con formato correcto
- [ ] Lógicas de salto configuradas (P4, P8, P14)
- [ ] Título y descripción atractivos
- [ ] Mensaje final con agradecimiento y CTA
- [ ] Test del formulario (responder como usuario y verificar flujo)
- [ ] Link acortado (bit.ly/payme-validacion)
- [ ] Decidir si ofrecer incentivo o no
- [ ] Planificar canales de distribución (WhatsApp, IG, LinkedIn)
- [ ] Meta de respuestas definida (50 mínimo, 100+ óptimo)

---

## 📊 SIGUIENTE PASO DESPUÉS DEL FORMULARIO

**Una vez tengas 50+ respuestas:**

1. ✅ Descargar respuestas en Excel/Google Sheets
2. ✅ Calcular métricas clave (ver sección "Análisis de Resultados")
3. ✅ Evaluar criterios de decisión (Escenarios 1-4)
4. ✅ **DECIDIR: A, B, Empate, o Pivotar**
5. ✅ Documentar decisión en `/docs/DECISION_SEGMENTO_PAYME.md`
6. ✅ Si decides A o B: Diseñar Experimento #3 (Landing page + ads)
7. ✅ Si decides Pivotar: Hacer 10 entrevistas profundas

---

## 📝 RESUMEN: ¿QUÉ MIDE CADA PREGUNTA?

### **SECCIÓN 1: Datos Demográficos**

1. ✅ **Edad** (P1) → Segmentación etaria
   - **Por qué**: Diferentes generaciones tienen diferentes pains (millennials vs boomers)

2. ✅ **Ocupación** (P2) → Segmentación por perfil laboral
   - **Por qué**: Independientes pueden tener más pain que empleados (menos estabilidad)

---

### **SECCIÓN 2: Pagos Recurrentes (Opción B)**

3. ✅ **Cantidad de cuentas** (P3) → Frecuencia del problema
   - **Por qué**: A más cuentas, mayor probabilidad de olvido → Mayor pain

4. ✅ **Olvidos en 6 meses** (P4) → Evidencia del problema
   - **Por qué**: Pain debe ser reciente y real, no hipotético

5. ✅ **Consecuencias** (P5) → Severidad del problema
   - **Por qué**: Multas reales = pain tangible = willingness to pay

6. ✅ **Pain score B** (P6) ⭐ → Intensidad del estrés por olvidar pagos
   - **Por qué**: Métrica cuantitativa comparable entre respondentes

7. ✅ **Métodos actuales** (P7) → Validación de insuficiencia
   - **Por qué**: Si métodos actuales funcionan, no necesitan Payme

---

### **SECCIÓN 3: Deudas Informales (Opción A)**

8. ✅ **Presta/pide dinero** (P8) → Segmento relevante
   - **Por qué**: Filtra personas fuera del target (nunca prestan/piden)

9. ✅ **Problemas con devolución** (P9) → Evidencia del problema
   - **Por qué**: Pain debe tener experiencia negativa real

10. ✅ **Incomodidad para cobrar** (P10) ⭐ → Pain emocional/social
    - **Por qué**: Factor diferenciador de A vs otras soluciones

11. ✅ **Pain score A** (P11) ⭐ → Intensidad del estrés por deudas informales
    - **Por qué**: Métrica cuantitativa comparable con Pain B

---

### **SECCIÓN 4: Comparación y Willingness to Pay**

12. ✅ **Comparación directa A vs B** (P12) ⭐⭐⭐ → **DECISIÓN CRÍTICA**
    - **Por qué**: Fuerza priorización entre las dos opciones
    - **Esta es LA pregunta más importante del formulario**

13. ✅ **Canal preferido** (P13) ⭐⭐ → **VALIDACIÓN DE CANAL CRÍTICA**
    - **Por qué**: Valida si WhatsApp es el canal preferido o hay que pivotar
    - **Decisión técnica**: Afecta arquitectura completa del producto

14. ✅ **Comportamiento pasado** (P14) ⭐⭐ → **VALIDACIÓN LEAN STARTUP**
    - **Por qué**: Valida qué hacen HOY (no qué harían mañana)
    - **Mejora del agente**: Diferencia intención de comportamiento real

15. ✅ **Monto actual apps** (P14b) → Benchmark de WTP real
    - **Por qué**: Valida cuánto pagan HOY por soluciones similares
    - **Condicional**: Solo si responde "Sí" en P14

16. ✅ **Willingness to Pay** (P15) ⭐⭐ → Viabilidad comercial
    - **Por qué**: Valida si el pain justifica pagar una solución

17. ✅ **Intención de uso** (P16) ⭐ → Product-market fit
    - **Por qué**: Diferencia interés real de curiosidad pasajera

18. ✅ **Usaría primero para** (P17) → Validación secundaria de prioridad
    - **Por qué**: Confirma P12 con contexto de primer uso real

---

### **SECCIÓN 5: Cierre y Smoke Test**

19. ✅ **Email/WhatsApp** (P18) → Beta users potenciales
    - **Por qué**: Convierte respondentes en leads calificados para MVP

20. ✅ **Smoke test beta** (P19) ⭐⭐⭐ → **CONVERSIÓN INTENCIÓN → ACCIÓN**
    - **Por qué**: Fuerza compromiso real (no solo cortesía)
    - **Mejora del agente**: Mide conversión real de intención a acción

---

### **Las 8 Preguntas CRÍTICAS (si tuvieras que quedarte con pocas):**

Si tuvieras que reducir este cuestionario al mínimo absoluto, estas son las que NO puedes eliminar:

1. **P6**: Pain score B (pagos recurrentes) → ¿Duele olvidar pagos?
2. **P11**: Pain score A (deudas informales) → ¿Duele gestionar deudas?
3. **P12**: Comparación directa ⭐⭐⭐ → ¿Cuál prefieren? (DECISIÓN A vs B)
4. **P13**: Canal preferido ⭐⭐ → ¿WhatsApp, email, app? (DECISIÓN TÉCNICA)
5. **P14**: Comportamiento pasado ⭐⭐ → ¿Pagan HOY por apps? (VALIDACIÓN REAL)
6. **P15**: Willingness to pay ⭐⭐ → ¿Pagarían por solución?
7. **P16**: Intención de uso ⭐ → ¿Lo usarían realmente?
8. **P19**: Smoke test beta ⭐⭐⭐ → ¿Quieren beta AHORA? (CONVERSIÓN REAL)

**El resto (P1-P5, P7-P10, P14b, P17-P18) son contexto valioso pero no crítico para decisiones fundamentales.**

**Nota**: P19 es especialmente crítica porque convierte intención (P16: "lo probaría") en acción (P19: "quiero beta AHORA"), eliminando sesgo de cortesía.

---

### **Flujo de Validación por Pregunta:**

```
DEMOGRÁFICOS (P1-P2)
    ↓
PAIN B - Contexto (P3-P5) → PAIN B Score (P6) → Métodos actuales (P7)
    ↓
PAIN A - Contexto (P8-P9) → PAIN A Scores (P10-P11)
    ↓
COMPARACIÓN DIRECTA (P12) ⭐⭐⭐ ← DECISIÓN CRÍTICA (A vs B)
    ↓
CANAL PREFERIDO (P13) ⭐⭐ ← DECISIÓN TÉCNICA (WhatsApp vs otros)
    ↓
COMPORTAMIENTO REAL (P14-P14b) ⭐⭐ ← ¿Pagan HOY por apps?
    ↓
VIABILIDAD (P15-P16) → Validar WTP e intención de uso
    ↓
CONFIRMACIÓN (P17) → Validar consistencia con P12
    ↓
LEAD CAPTURE (P18) → Convertir en beta users
    ↓
SMOKE TEST (P19) ⭐⭐⭐ ← CONVERSIÓN INTENCIÓN → ACCIÓN
```

---

### **Preguntas por Tipo de Insight:**

| Tipo de Insight | Preguntas | Para qué sirve |
|-----------------|-----------|----------------|
| **Segmentación** | P1, P2 | Entender quién es tu target |
| **Pain Discovery** | P4, P5, P6, P9, P10, P11 | Validar intensidad del problema |
| **Contexto** | P3, P7, P8 | Entender situación actual |
| **Decisión A vs B** | P12, P17 | **CORE:** Qué construir (segmento) |
| **Decisión de Canal** | P13 | **CORE:** Cómo entregarlo (canal) |
| **Comportamiento Real** | P14, P14b | **CORE:** Validar hábitos de pago actuales |
| **Viabilidad** | P15, P16 | Validar WTP e intención de uso |
| **Conversión** | P18, P19 | Leads para MVP + validación de compromiso real |

---

### **Cómo las Preguntas Responden las Hipótesis Clave:**

**H1: ¿El problema existe?**
- P4 (olvidaste pagar?) + P6 (cuánto duele?) → Valida problema B
- P9 (problemas devolver?) + P11 (cuánto duele?) → Valida problema A

**H2: ¿El problema es frecuente?**
- P3 (cuántas cuentas?) + P4 (frecuencia olvidos)
- P8 (frecuencia presta/pide)

**H3: ¿El problema tiene consecuencias?**
- P5 (multas, cortes, estrés)
- P9 (no devolvieron, fue incómodo)

**H4: ¿Soluciones actuales son insuficientes?**
- P7 (métodos actuales) cruzado con P6 (pain sigue alto)

**H5: ¿Cuál segmento priorizar?**
- **P12 (comparación directa) ← RESPUESTA DIRECTA**
- P17 (usaría primero para) → Confirmación secundaria

**H6: ¿Hay willingness to pay?**
- **P15 (WTP declarado) ← RESPUESTA DIRECTA**
- **P14 + P14b (comportamiento actual) ← VALIDACIÓN REAL**
- Cruzar: Si P14="Sí pago" + P14b="$3.990+", entonces P15 debería ser ≥$2.990

**H7: ¿Hay intención real de uso?**
- **P16 (intención) + P19 (smoke test) ← CONVERSIÓN INTENCIÓN → ACCIÓN**
- **P18 (dejar contacto) ← COMPROMISO REAL**
- Métrica clave: % que dice "Sí" en P16 vs % que dice "Sí AHORA" en P19

**H8: ¿WhatsApp es el canal preferido?** 🆕
- **P13 (canal preferido) ← RESPUESTA DIRECTA**
- Valida si WhatsApp >60% o hay que pivotar a email/app
- **CRÍTICA**: Afecta decisión de arquitectura completa

---

## 🎓 DIFERENCIA ENTRE CUESTIONARIO Y ENTREVISTAS

| Aspecto | Cuestionario (este doc) | Entrevistas 1-a-1 (doc anterior) |
|---------|------------------------|----------------------------------|
| **Tipo** | Cuantitativo | Cualitativo |
| **Escala** | 50-200 respuestas | 15-20 entrevistas |
| **Tiempo** | 5-7 min por respuesta | 25-30 min por entrevista |
| **Profundidad** | Superficial (métricas) | Profundo (insights) |
| **Costo** | Puede requerir ads ($20-50k) | Gratis (friends & family) |
| **Fortaleza** | Valida demanda a escala | Entiende el "por qué" |
| **Debilidad** | No captura matices | No es estadísticamente significativo |

### **Recomendación:**

**HACER AMBOS (secuencialmente):**

1. **Primero**: Entrevistas 1-a-1 (15-20 personas) → Entender problema profundamente
2. **Segundo**: Cuestionario masivo (50-150 personas) → Validar hallazgos a escala
3. **Tercero**: Cruzar datos → Decisión final con evidencia cualitativa + cuantitativa

**O si tienes prisa:**

**Solo cuestionario masivo** → Distribución rápida → Decisión en 7 días (pero menos profundidad)

---

**Última actualización**: 2025-11-03
**Versión**: 2.1 (incorpora mejoras del agente + diferenciación dinero/objetos)
**Próximo documento**: `/docs/DECISION_SEGMENTO_PAYME.md` (crear después de analizar resultados)

**Changelog v2.1:**
- ✅ Agregada P14: Comportamiento pasado (valida qué hacen HOY)
- ✅ Agregada P14b: Monto actual que pagan (benchmark WTP real)
- ✅ Agregada P8b: Diferenciación dinero vs objetos (separa señal del ruido) ← CRÍTICA
- ✅ Agregada P19: Smoke test beta (convierte intención → acción)
- ✅ Actualizado análisis de resultados con métricas de diferenciación dinero/objetos
- ✅ Actualizado resumen con 8 preguntas críticas (antes 6)
- ✅ Agregada H8: Canal preferido (validación crítica de WhatsApp)
- ✅ Actualizado: "dinero u objetos" en todas las preguntas de Opción A
- ✅ Total: 21 preguntas (17 obligatorias + 4 condicionales: P5, P8b, P14b, P17)
