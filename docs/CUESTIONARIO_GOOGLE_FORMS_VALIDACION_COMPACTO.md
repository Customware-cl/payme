# Cuestionario Google Forms - Validación Payme (Versión Compacta)

**Versión**: 2.1 Ultra-Compacta (Mejorada + diferenciación dinero/objetos)
**Fecha**: 2025-11-03
**Objetivo**: Validar A vs B + canal preferido + smoke test real + diferenciación dinero/objetos
**Meta de respuestas**: 100+ (mayor tasa de completitud por brevedad)
**Total preguntas**: 10 (7 obligatorias + 3 condicionales: P1b, P2b, P7)
**Duración estimada**: 3-4 minutos

---

## 🎯 FILOSOFÍA DE ESTA VERSIÓN

**Sacrificar:**
- ❌ Profundidad de contexto (cuántas cuentas pagas, frecuencia exacta)
- ❌ Segmentación demográfica detallada
- ❌ Preguntas de validación cruzada

**Mantener:**
- ✅ Pain scores A y B (lo MÁS importante)
- ✅ Comparación directa (decisión A vs B)
- ✅ Willingness to pay (viabilidad)
- ✅ Intención de uso (engagement)
- ✅ Captura de lead

**Resultado:**
- Tasa de abandono: ~5% (vs 20-30% en versión larga)
- Tiempo: 2-3 minutos (vs 5-7 minutos)
- Respuestas: Potencial de 2-3x más volumen

---

## 📋 CUESTIONARIO DE 10 PREGUNTAS

### Configuración de Google Forms

**Título**: "3 minutos para ayudarme a validar una idea 💡"

**Descripción**:
```
Hola! Estoy validando una idea sobre recordatorios automáticos.

Son hasta 10 preguntas rápidas. No hay respuestas correctas.

⏱️ Tiempo: 3-4 minutos
🔒 Respuestas anónimas

¡Gracias! 🙏
```

---

## 🔢 LAS 10 PREGUNTAS CRÍTICAS

### P1: ¿Qué tan estresante es para ti OLVIDAR pagar cuentas mensuales? (dividendo, luz, agua, internet, tarjetas...)
**Tipo**: Escala lineal 0-10 (obligatoria)

```
0 = No me estresa nada / No me pasa / No aplica
10 = Me estresa muchísimo, olvido seguido y he pagado multas

[Escala 0 ──────────── 10]
```

**🎯 Qué mide**: Pain B (Pagos Recurrentes)

---

### P1b: [Solo si P1 ≥5] ¿Has pagado multas o intereses por olvidar pagos en los últimos 6 meses?
**Tipo**: Opción múltiple (opcional, solo aparece si P1 ≥5)

- [ ] Sí, he pagado multas/intereses ($2.000 - $10.000 total)
- [ ] Sí, he pagado multas/intereses ($10.000+ total)
- [ ] No, no he pagado multas (pero sí he olvidado pagos)
- [ ] He tenido corte de servicio (luz, agua, internet)

**Lógica de salto**: Solo aparece si P1 ≥ 5/10

**🎯 Qué mide**: Consecuencias tangibles (validación Lean Startup - comportamiento pasado real)

**Por qué es crítica**: Valida que el pain no es solo "estrés" hipotético, sino pérdidas reales de dinero.

---

### P2: ¿Qué tan incómodo o estresante es para ti GESTIONAR deudas informales? (dinero u objetos que prestas o te prestan entre amigos/familia)
**Tipo**: Escala lineal 0-10 (obligatoria)

```
0 = No me incomoda nada / No me pasa / No aplica
10 = Muy incómodo, he tenido problemas para cobrar/pedir de vuelta

[Escala 0 ──────────── 10]
```

**🎯 Qué mide**: Pain A (Deudas Informales - dinero u objetos)

---

### P2b: [Solo si P2 ≥ 5] ¿Cuál te genera MÁS incomodidad?
**Tipo**: Opción múltiple (opcional, solo aparece si P2 ≥ 5)

- [ ] Dinero prestado 💰
- [ ] Objetos prestados 📦
- [ ] Ambos por igual
- [ ] No aplica / Evito el conflicto

**Lógica de salto**: Solo aparece si P2 ≥ 5/10

**🎯 Qué mide**: Diferenciación crítica entre pain de dinero vs objetos

**Por qué es crítica:** Separa señal del ruido. Si ≥70% dice "dinero" → construir MVP para dinero primero.

---

### P3: Imagina que existe "Payme": un servicio que te envía recordatorios automáticos. ¿Cuál de estos dos usos te sería MÁS ÚTIL?
**Tipo**: Opción múltiple (obligatoria)

**Texto explicativo previo**:
```
Payme puede recordarte:

🔵 OPCIÓN A: Pagar tus cuentas recurrentes
   Ejemplo: "Juan, recuerda pagar dividendo el 5 de noviembre 💡"

🟢 OPCIÓN B: Deudas informales con amigos/familia (dinero u objetos)
   Ejemplos:
   • "María, recuerda devolver $20.000 a Pablo el viernes 💰"
   • "Pedro, recuerda devolver el taladro que te prestó Luis 🔧"
```

**Opciones:**
- [ ] Opción A (recordar cuentas) me sería MÁS útil
- [ ] Opción B (recordar deudas informales: dinero/objetos) me sería MÁS útil
- [ ] Ambas me parecen igual de útiles
- [ ] Ninguna me parece útil

**🎯 Qué mide**: Comparación directa A vs B (DECISIÓN CRÍTICA)

---

### P4: ¿Por qué medio preferirías recibir estos recordatorios? (marca hasta 2 opciones)
**Tipo**: Casillas de verificación (obligatoria, máximo 2 selecciones)

- [ ] WhatsApp
- [ ] Email / Correo electrónico
- [ ] App móvil con notificaciones
- [ ] SMS (mensaje de texto)
- [ ] No me importa el canal, cualquiera sirve
- [ ] Prefiero gestionarlo yo mismo (calendario/alarmas)

**🎯 Qué mide**: Canal preferido (DECISIÓN TÉCNICA - WhatsApp vs otros)

---

### P5: Si este servicio te ahorra multas, estrés o incomodidad, ¿cuánto pagarías mensualmente?
**Tipo**: Opción múltiple (obligatoria)

- [ ] $0 - Solo lo usaría si es 100% gratis
- [ ] $990/mes (precio de un café al mes)
- [ ] $1.990/mes (precio de un Netflix)
- [ ] $2.990/mes o más
- [ ] No lo usaría ni gratis

**🎯 Qué mide**: Willingness to Pay (viabilidad comercial)

---

### P6: Si Payme estuviera disponible HOY, ¿lo probarías?
**Tipo**: Opción múltiple (obligatoria)

- [ ] Sí, definitivamente
- [ ] Tal vez / Tendría que verlo
- [ ] No me interesa

**🎯 Qué mide**: Intención de adopción (product-market fit)

---

### P7: [OPCIONAL] ¿Quieres probar Payme cuando lance? Déjanos tu WhatsApp o email:
**Tipo**: Respuesta corta (OPCIONAL)

```
Ej: +56912345678 o nombre@email.com

[Campo de texto libre]
```

**🎯 Qué captura**: Leads calificados (beta users potenciales)

---

### P8: 🚀 [SMOKE TEST] Payme lanzará su beta en 2 semanas
**Tipo**: Opción múltiple (obligatoria)

**Texto explicativo:**
```
Los primeros 50 usuarios tendrán acceso prioritario con:
• 30 días GRATIS (sin tarjeta)
• Recordatorios ilimitados
• Soporte directo del equipo

Después del trial: $2.990/mes (cancela cuando quieras)
```

**¿Quieres reservar tu cupo para la beta?**

- [ ] Sí, quiero probar la beta AHORA (dejaré mi contacto arriba en P7)
- [ ] Tal vez más adelante, avísame cuando lance
- [ ] No me interesa probar la beta

**🎯 Qué mide**: Conversión de INTENCIÓN → ACCIÓN (mejora crítica del agente)

**Por qué es crítica**: Diferencia entre quien dice "me interesa" (P6) vs quien dice "quiero AHORA" (P8). Solo los comprometidos dirán "Sí".

**Métrica clave**: % que dice "Sí" en P6 vs % que dice "Sí AHORA" en P8 = Tasa de conversión real

---

### MENSAJE FINAL (página de confirmación)

```
¡Listo! Gracias por tu tiempo 🙌

Tus 8 respuestas me ayudan un montón a entender si voy por buen camino.

Si quieres probar la beta, asegúrate de haber dejado tu contacto en P7 ⬆️

Si conoces a alguien más que pueda ayudarme (toma solo 3 min),
comparte este link: [URL corta del formulario]

---

¿Quieres seguir el progreso?
Instagram: @payme.chile
Web: payme.cl

🚀 ¡Nos vemos pronto!
```

---

## 📊 ANÁLISIS DE RESULTADOS (Versión Simplificada)

Una vez tengas **50+ respuestas**, analiza:

### 1. Calcular Pain Scores Promedio

```excel
Pain_B_Promedio = PROMEDIO(P1)
Pain_A_Promedio = PROMEDIO(P2)

Diferencia = Pain_B_Promedio - Pain_A_Promedio
```

**Interpretación:**
- Si diferencia ≥ 2 puntos → Hay un ganador claro
- Si diferencia < 1 punto → Empate técnico

---

### 2. Diferenciación Dinero vs Objetos (P2b - CRÍTICA) 🆕

```excel
% Pain_Dinero = CONTAR.SI(P2b, "Dinero prestado") / TOTAL_P2b * 100
% Pain_Objetos = CONTAR.SI(P2b, "Objetos prestados") / TOTAL_P2b * 100
% Pain_Ambos = CONTAR.SI(P2b, "Ambos por igual") / TOTAL_P2b * 100
```

**Decisión CRÍTICA para MVP:**
- Si % Pain_Dinero ≥ 70% → **Construir MVP solo para dinero** (objetos en fase 2)
- Si % Pain_Objetos ≥ 70% → Considerar MVP enfocado en objetos
- Si % Pain_Ambos ≥ 40% → Pain distribuido, validar separadamente

---

### 3. Comparación Directa (P3)

```excel
% Prioriza_A = CONTAR.SI(P3, "Opción A") / TOTAL * 100
% Prioriza_B = CONTAR.SI(P3, "Opción B") / TOTAL * 100
% Ambas = CONTAR.SI(P3, "Ambas") / TOTAL * 100
% Ninguna = CONTAR.SI(P3, "Ninguna") / TOTAL * 100
```

**Señal clara:**
- Si % Prioriza_B > 60% → **B gana**
- Si % Prioriza_A > 60% → **A gana**
- Si % Ambas > 30% → **Empate**
- Si % Ninguna > 40% → **Problema** (no hay demanda)

---

### 4. Willingness to Pay (P5)

```excel
% Pagaría_Algo = (Respuestas ≥ $990) / TOTAL * 100
% Solo_Gratis = CONTAR.SI(P5, "$0") / TOTAL * 100
WTP_Promedio = PROMEDIO numérico (excluyendo $0 y "No usaría")
```

**Viabilidad:**
- % Pagaría_Algo ≥ 40% → ✅ Viable comercialmente
- % Pagaría_Algo < 25% → ⚠️ Modelo freemium o pricing bajo
- % Solo_Gratis > 60% → ❌ No hay WTP real

---

### 5. Intención de Uso (P6)

```excel
% Usaría = (CONTAR.SI(P6, "Sí") + CONTAR.SI(P6, "Tal vez")) / TOTAL * 100
```

**Product-Market Fit:**
- % Usaría ≥ 70% → ✅ Alto interés
- % Usaría 50-70% → ⚠️ Interés moderado
- % Usaría < 50% → ❌ Problema con value prop

---

### 6. Consecuencias Tangibles (P1b - mejora agente)

```excel
% Pagó_Multas = CONTAR.SI(P1b, "Sí, he pagado multas") / TOTAL_P1b * 100
Monto_Promedio_Multas = Calcular promedio de rangos seleccionados
% Corte_Servicio = CONTAR.SI(P1b, "corte de servicio") / TOTAL_P1b * 100
```

**Validación de pain real:**
- % Pagó_Multas ≥ 50% → ✅ Pain con consecuencias reales ($$$)
- % Pagó_Multas < 20% → ⚠️ Pain más emocional que tangible
- Monto_Promedio ≥ $10k → ✅ Justifica pagar por solución

---

### 7. Captura de Leads (P7)

```excel
Tasa_Conversión_Lead = (Respuestas P7 con datos) / TOTAL * 100
```

**Engagement real:**
- Tasa ≥ 30% → ✅ Compromiso fuerte
- Tasa 15-30% → ⚠️ Interés tibio
- Tasa < 15% → ❌ Solo curiosidad

---

### 8. Smoke Test Real (P8 - mejora crítica agente)

```excel
% Beta_Ahora = CONTAR.SI(P8, "Sí, quiero AHORA") / TOTAL * 100
% Beta_Tal_Vez = CONTAR.SI(P8, "Tal vez") / TOTAL * 100
% Beta_No = CONTAR.SI(P8, "No me interesa") / TOTAL * 100

Conversion_Rate = % Beta_Ahora / % Usaría (P6) * 100
```

**Compromiso real (no solo cortesía):**
- % Beta_Ahora ≥ 15% → ✅ Hay early adopters reales
- % Beta_Ahora < 5% → ❌ Alto sesgo de cortesía, intención ≠ acción
- Conversion_Rate ≥ 40% → ✅ Buena conversión intención → acción
- Conversion_Rate < 20% → ❌ Demasiado sesgo, validar con experimentos externos

**Métrica más importante**: La diferencia entre P6 ("lo probaría") y P8 ("quiero AHORA") revela el sesgo real.

---

## 🎯 MATRIZ DE DECISIÓN ULTRA-RÁPIDA

### ESCENARIO 1: B (Pagos) GANA ✅

**Condiciones:**
```
✅ Pain_B_Promedio ≥ 7/10
✅ Pain_B > Pain_A (al menos +1.5 puntos)
✅ % Prioriza_B ≥ 55%
✅ % Pagaría_Algo ≥ 40%
```

**Decisión:**
→ **CONSTRUIR PARA PAGOS RECURRENTES**

**Value Prop:**
```
"Nunca más pagues multas por olvidar tus cuentas"
```

**Features MVP:**
- Onboarding: "¿Qué pagas mensualmente?"
- Recordatorio WhatsApp 3 días antes
- Confirmación: "Pagado ✅"
- Reconfiguración automática mes siguiente

---

### ESCENARIO 2: A (Deudas) GANA ✅

**Condiciones:**
```
✅ Pain_A_Promedio ≥ 7/10
✅ Pain_A > Pain_B (al menos +1.5 puntos)
✅ % Prioriza_A ≥ 55%
✅ % Pagaría_Algo ≥ 40%
```

**Decisión:**
→ **CONSTRUIR PARA DEUDAS INFORMALES**

**Value Prop:**
```
"Cobra sin incomodidad, paga sin olvidos"
```

**Features MVP:**
- Flujo: ¿A quién? → ¿Cuánto? → ¿Cuándo?
- Confirmación bidireccional (borrower acepta)
- Recordatorio solo si acepta
- Confirmación de devolución

---

### ESCENARIO 3: EMPATE ⚖️

**Condiciones:**
```
⚠️ Pain_A ≈ Pain_B (diferencia < 1 punto)
⚠️ % Prioriza_A ≈ % Prioriza_B
⚠️ % Ambas ≥ 30%
```

**Decisión:**
→ **A/B TEST con Landing Pages**

**Acción:**
- Crear 2 landing pages (una para A, otra para B)
- $50k ads en cada una
- El que convierta >2x mejor → Ganador
- Si empatan en landing → Construir MVP híbrido

---

### ESCENARIO 4: NINGUNO VALIDA ❌

**Condiciones:**
```
❌ Pain_A < 5 Y Pain_B < 5
❌ % Ninguna útil > 40%
❌ % Solo_Gratis > 60%
❌ % No usaría > 50%
```

**Decisión:**
→ **PIVOTAR propuesta de valor**

**Acción:**
- Hacer 10 entrevistas profundas
- Entender por qué no resuena
- Reformular problema a resolver

---

## 🧮 TABLA RESUMEN DE ANÁLISIS

Copia esta tabla en Excel después de recopilar respuestas:

| Métrica | Fórmula | Tu Resultado | Benchmark | ✅/❌ |
|---------|---------|--------------|-----------|-------|
| **Pain B** | PROMEDIO(P1) | ___ | ≥7 | |
| **Pain A** | PROMEDIO(P2) | ___ | ≥7 | |
| **Ganador Pain** | MAX(Pain_A, Pain_B) | ___ | Diferencia ≥1.5 | |
| **% Pagó Multas** 🆕 | CONTAR.SI(P1b, "multas") / TOTAL_P1b | ___% | ≥50% | |
| **% Pain Dinero** 🆕 | CONTAR.SI(P2b, "Dinero") / TOTAL_P2b | ___% | ≥70% | |
| **% Prioriza B** | CONTAR.SI(P3, "A") / TOTAL | ___% | ≥55% | |
| **% Prioriza A** | CONTAR.SI(P3, "B") / TOTAL | ___% | ≥55% | |
| **% WhatsApp** | CONTAR.SI(P4, "WhatsApp") / TOTAL | ___% | ≥60% | |
| **% Pagaría Algo** | Respuestas ≥$990 / TOTAL | ___% | ≥40% | |
| **WTP Promedio** | PROMEDIO numérico | $___ | ≥$990 | |
| **% Usaría** | (Sí + Tal vez) / TOTAL | ___% | ≥70% | |
| **Tasa Lead** | Respuestas P7 / TOTAL | ___% | ≥20% | |
| **% Beta AHORA** 🆕 | CONTAR.SI(P8, "Sí AHORA") / TOTAL | ___% | ≥15% | |
| **Conversion Rate** 🆕 | % Beta AHORA / % Usaría | ___% | ≥40% | |

**DECISIÓN FINAL:** ______________

**🎯 Métricas críticas nuevas (v2.1):**
- **% Pagó Multas**: Valida pain con consecuencias reales ($$$)
- **% Pain Dinero**: Diferencia pain de dinero vs objetos → decide foco del MVP
- **% Beta AHORA**: Convierte intención en acción (elimina sesgo de cortesía)
- **Conversion Rate**: Revela diferencia entre "me interesa" vs "quiero AHORA"

---

## 💡 POR QUÉ ESTA VERSIÓN FUNCIONA

`★ Insight ─────────────────────────────────────`
**Principio de Pareto (80/20) aplicado:**

Las 16 preguntas originales capturaban:
- Pain scores (crítico) ✅
- Contexto detallado (útil pero no crítico)
- Validación cruzada (bueno tener)
- Demografía (segmentación)

Esta versión de 6 preguntas captura **el 80% del valor** con **35% del esfuerzo**.

**Trade-offs aceptables:**
- ❌ No sabes cuántas cuentas pagan → Pero sabes si el pain existe
- ❌ No sabes frecuencia exacta de olvidos → Pero sabes intensidad
- ❌ No sabes edad/ocupación → Pero puedes segmentar leads en P6

**Ganancia clave:**
- ✅ Tasa de completitud: 90-95% (vs 70-80% largo)
- ✅ Shares: Más gente comparte ("solo 2 min")
- ✅ Volumen: 2-3x más respuestas en mismo tiempo
`─────────────────────────────────────────────────`

---

## 🚀 VENTAJAS DE LA VERSIÓN COMPACTA

### **Tasa de Completitud**
- Versión larga (16 preguntas): ~70-80% terminan
- **Versión compacta (6 preguntas): ~90-95% terminan**
- → +20-25% más datos válidos

### **Distribución Viral**
- Más gente comparte porque "son solo 2 minutos"
- Menos fricción para pedir a friends & family
- → Mayor alcance orgánico

### **Velocidad de Decisión**
- Necesitas menos respuestas para decisión (50 suficiente)
- Llegas a 50 respuestas en ~3-5 días (vs 7-10 días)
- → Aprendes más rápido

### **Costo de Adquisición**
- Si usas ads, costo por respuesta completa es menor
- Menos abandono = mejor ROI en ads
- → Más eficiente presupuesto

---

## ⚠️ LIMITACIONES A CONSIDERAR

### **Lo que NO sabrás con esta versión:**

❌ **Segmentación demográfica detallada**
- No sabes edad, ocupación exacta
- **Mitigación**: Inferir de leads en P6 o agregar P7 opcional "Edad: __"

❌ **Contexto profundo del problema**
- No sabes cuántas cuentas pagan, frecuencia exacta
- **Mitigación**: Hacer 5 entrevistas 1-a-1 post-encuesta con top leads

❌ **Validación cruzada**
- No puedes verificar consistencia de respuestas
- **Mitigación**: Confiar en volumen (50+ respuestas promedia sesgos)

❌ **Consecuencias específicas**
- No sabes monto exacto de multas pagadas
- **Mitigación**: Pain score captura severidad indirectamente

---

## 🎯 CUÁNDO USAR CADA VERSIÓN

### **Usa versión COMPACTA (6 preguntas) si:**
- ✅ Necesitas decisión RÁPIDA (7-10 días)
- ✅ Priorizas VOLUMEN de respuestas (100-200+)
- ✅ Quieres distribución viral orgánica
- ✅ Presupuesto de ads limitado
- ✅ Tu segmento es general (no nichoso)

### **Usa versión LARGA (16 preguntas) si:**
- ✅ Necesitas PROFUNDIDAD y segmentación
- ✅ Tienes presupuesto para ads (~$50k)
- ✅ Tu segmento es específico (ej: solo emprendedores)
- ✅ Necesitas justificar decisión ante inversionistas
- ✅ Tienes más tiempo (2-3 semanas)

### **Usa AMBAS versiones (híbrido) si:**
- ✅ Fase 1: Compacta para validación rápida (días 1-7)
- ✅ Fase 2: Si valida, larga para profundizar (días 8-21)
- **Ventaja**: Aprendes rápido + profundizas después

---

## 📋 CHECKLIST PARA LANZAMIENTO

Antes de distribuir:

- [ ] Formulario creado en Google Forms
- [ ] Las 6 preguntas agregadas en orden correcto
- [ ] P6 configurada como OPCIONAL
- [ ] Título atractivo: "2 minutos para ayudarme..."
- [ ] Descripción clara del tiempo: "SOLO 6 preguntas"
- [ ] Mensaje final con agradecimiento + share link
- [ ] Test del formulario (responder como usuario)
- [ ] Link acortado (bit.ly/payme-2min)
- [ ] Copy para distribución:
  ```
  "Necesito tu ayuda para validar una idea 💡
   Son SOLO 6 preguntas (2 minutos, prometo)
   Link: bit.ly/payme-2min
   ¡Gracias! 🙏"
  ```

---

## 🎓 EJEMPLO DE DISTRIBUCIÓN EFECTIVA

### **Mensaje para WhatsApp (amigos/familia):**

```
Hola! 👋

Necesito tu ayuda para validar una idea de negocio.

Son SOLO 6 preguntas rápidas (2 minutos reales):
🔗 [link]

No hay respuestas correctas, solo quiero saber tu experiencia.

Si puedes compartirlo con alguien más, sería increíble 🙏

¡Gracias de antemano! 🚀
```

### **Mensaje para Instagram Stories:**

```
Slide 1:
"Necesito tu ayuda 💡
Desliza →"

Slide 2:
"6 preguntas sobre pagos y deudas
⏱️ 2 minutos reales
🔗 Link en bio
Gracias 🙏"

Slide 3:
"Si ya respondiste, comparte con amigos 🔄
Necesito 100 respuestas esta semana"
```

---

## 📊 META DE RESPUESTAS (Versión Compacta)

**Debido a la brevedad, puedes ser más ambicioso:**

- ~~Mínimo: 50~~ → **100 respuestas**
- ~~Óptimo: 100~~ → **150 respuestas**
- ~~Ideal: 150~~ → **200+ respuestas**

**Proyección realista:**
- Orgánico (WhatsApp, IG, LinkedIn): 50-80 respuestas en 7 días
- Con $20k en ads: +100-150 respuestas adicionales
- **Total alcanzable: 150-230 respuestas en 7 días**

---

## ⏭️ DESPUÉS DE RECOPILAR RESPUESTAS

Una vez tengas 100+ respuestas:

1. ✅ Descargar datos en Excel
2. ✅ Calcular tabla resumen (ver sección anterior)
3. ✅ Aplicar matriz de decisión (Escenarios 1-4)
4. ✅ **DECIDIR: A, B, Empate, o Pivotar**
5. ✅ Si decides A o B: Crear landing page + ads
6. ✅ Contactar leads de P6 para concierge MVP

---

## 🔗 DOCUMENTOS RELACIONADOS

Este es uno de varios métodos de validación:

1. `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md` - Método cualitativo profundo
2. `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION.md` - Versión larga (16 preguntas)
3. **`/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION_COMPACTO.md`** - Este documento (6 preguntas)
4. `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md` - Análisis de datos

---

## 🎯 RESUMEN: ¿POR QUÉ 10 PREGUNTAS ES SUFICIENTE?

**Las únicas preguntas que REALMENTE necesitas para decisiones críticas:**

1. ✅ **Pain B** (P1) → ¿Duele el problema de olvidar pagos?
2. ✅ **Consecuencias B** (P1b) ⭐ 🆕 → ¿Pagaron multas reales? (valida pain tangible)
3. ✅ **Pain A** (P2) → ¿Duele el problema de deudas informales (dinero/objetos)?
4. ✅ **Diferenciación A** (P2b) ⭐⭐ 🆕 → ¿Dinero o objetos? (separa señal del ruido)
5. ✅ **Comparación** (P3) → ¿Cuál prefieren? (decisión A vs B)
6. ✅ **Canal preferido** (P4) ⭐ → ¿WhatsApp, email o app? (decisión técnica)
7. ✅ **WTP** (P5) → ¿Pagarían por la solución?
8. ✅ **Intención** (P6) → ¿Lo usarían realmente?
9. ✅ **Lead capture** (P7) → ¿Quién quiere probarlo?
10. ✅ **Smoke test** (P8) ⭐⭐⭐ 🆕 → ¿Quieren beta AHORA? (conversión real)

**Todo lo demás es contexto útil pero no crítico para las decisiones fundamentales.**

**P1b (consecuencias) es CRÍTICA porque:**
- Diferencia "estrés" hipotético de pérdidas reales de dinero
- Valida que el pain tiene consecuencias tangibles ($$$)
- Si nadie ha pagado multas → Pain no es tan grave como dicen

**P2b (diferenciación dinero/objetos) es LA MÁS CRÍTICA DE OPCIÓN A porque:**
- Separa la señal del ruido: ¿pain es por dinero o por objetos?
- Sin esta pregunta, datos de Opción A son inútiles (no sabes qué construir)
- Si ≥70% dice "dinero" → construir MVP solo para dinero
- Si ≥70% dice "objetos" → considerar MVP de objetos
- Si 50/50 → pain no está claro, necesitas experimentos separados
- **Recomendación agente asesor-lean-startup**: Sin P2b, violas principio "una hipótesis, un experimento"

**P4 (canal preferido) es CRÍTICA porque:**
- Valida si WhatsApp (arquitectura actual) es viable
- Si email/app ganan → Requiere pivotar tecnología completa
- Afecta costos operacionales (WhatsApp API no es gratis)

**P8 (smoke test) es LA MÁS CRÍTICA porque:**
- Convierte intención ("me interesa") en acción ("quiero AHORA")
- Elimina sesgo de cortesía y sesgo de confirmación
- Solo los realmente comprometidos dirán "Sí AHORA"
- Métrica clave: Conversion rate = P8 / P6 (debería ser ≥40%)

---

**Última actualización**: 2025-11-03
**Versión**: 2.0 Ultra-Compacta (incorpora mejoras del agente asesor-lean-startup)
**Tiempo estimado de respuesta**: 3-4 minutos
**Tasa de completitud esperada**: 80-85%
**Recomendación**: Usar esta versión para validación rápida + conversión real, profundizar después si valida.

**Changelog v2.1:**
- ✅ Agregada P1b: Consecuencias tangibles (multas pagadas - valida pain real con $$$)
- ✅ Agregada P2b: Diferenciación dinero vs objetos (separa señal del ruido) ← CRÍTICA
- ✅ Agregada P8: Smoke test beta (convierte intención → acción, elimina sesgo)
- ✅ Actualizado análisis con métricas de conversión real y diferenciación
- ✅ Agregada métrica Conversion Rate (P8/P6) - mide sesgo de cortesía
- ✅ Agregada métrica % Pain Dinero (P2b) - decide foco del MVP
- ✅ Actualizada tabla resumen con nuevas métricas clave
- ✅ Cambio de 7 → 10 preguntas (7 obligatorias + 3 condicionales: P1b, P2b, P7)
- ✅ Actualizado: "dinero u objetos" en todas las preguntas de Opción A
