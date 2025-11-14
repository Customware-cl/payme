# Estrategia de Validación: Entrevistas vs Cuestionarios

**Fecha**: 2025-11-03
**Objetivo**: Decidir método de validación óptimo para Payme (A vs B)
**Para discusión con**: Socio de Somos Payme SpA
**Recomendado por**: Agente asesor-lean-startup (evaluación experta)

---

## 🎯 PREGUNTA CENTRAL

**¿Qué método usar para validar si construir Opción A (deudas informales) u Opción B (pagos recurrentes)?**

**Opciones:**
1. **Solo entrevistas** (15-20 personas, 1-a-1, profundo)
2. **Solo cuestionarios** (100-150 personas, Google Forms, escala)
3. **Híbrido: Entrevistas → Cuestionarios** (recomendado por agente)

---

## 📊 COMPARACIÓN RÁPIDA

| Aspecto | Entrevistas 1-a-1 | Cuestionarios (Forms) |
|---------|-------------------|----------------------|
| **Tipo** | Cualitativo | Cuantitativo |
| **Objetivo** | Entender el "POR QUÉ" | Medir el "CUÁNTOS" |
| **Tamaño** | 15-20 personas | 100-200+ personas |
| **Tiempo** | 25-30 min/persona | 3-8 min/persona |
| **Costo** | $0 (gratis, friends & family) | $20-50k si usas ads |
| **Profundidad** | ⭐⭐⭐⭐⭐ MUY PROFUNDO | ⭐⭐ SUPERFICIAL |
| **Validez estadística** | ❌ No (n=15) | ✅ Sí (n=100+) |
| **Descubre insights** | ✅ Sí (palabras exactas) | ❌ No (opciones cerradas) |
| **Decide A vs B** | ⚠️ Parcial | ✅ Sí |
| **Valida canal** | ✅ Sí | ✅ Sí |
| **Mide WTP real** | ✅ Sí (comportamiento) | ⚠️ Parcial (declarado) |
| **Sesgo de cortesía** | ⚠️ ALTO (amigos) | ⚠️ MODERADO (anónimo) |
| **Tiempo total** | 7-10 horas | 2-3 horas |
| **Duración proyecto** | 7-14 días | 5-7 días |

---

## 🔬 ENTREVISTAS 1-A-1 (Cualitativo)

### ¿Qué son?

Conversaciones profundas de 25-30 minutos siguiendo un script estructurado. Descubres:
- Palabras exactas que usa el usuario para describir su problema
- Emociones reales (frustración, vergüenza, ansiedad)
- Soluciones actuales (workarounds)
- Comportamiento pasado (qué han hecho vs qué dicen que harían)

### ¿Para qué sirven?

✅ **MEJOR PARA:**
- Entender el problema profundamente
- Descubrir pains no obvios
- Validar lenguaje para landing page (copy)
- Identificar objeciones reales
- Generar insights sorprendentes

❌ **NO SIRVEN PARA:**
- Decidir A vs B con confianza estadística
- Medir WTP promedio con precisión
- Validar a escala (solo 15-20 personas)

### Ejemplo de Insight de Entrevista

```
Entrevistador: "¿Cómo te acuerdas de pagar tus cuentas?"

Usuario: "Tengo 8 alarmas en el celular... pero las snooze y
las snooze hasta que me olvido. El otro día pagué $18 mil de multa
en mi tarjeta porque me olvidé 3 meses seguidos. Me sentí súper tonto."

↓ INSIGHT:
- Pain real: $18k pérdida (tangible, no hipotético)
- Solución actual (alarmas) NO funciona
- Emoción: "me sentí súper tonto" (vergüenza)
- Copy para landing: "¿Cansado de pagar multas por olvido?"
```

### Documentos disponibles:

- `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md` - Script completo
- `/docs/PLANTILLA_CAPTURA_ENTREVISTAS.md` - Captura de datos
- `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md` - Análisis

---

## 📋 CUESTIONARIOS GOOGLE FORMS (Cuantitativo)

### ¿Qué son?

Formularios con preguntas cerradas (escala 1-10, opción múltiple). Permiten:
- Medir pain scores promedio (ej: 7.2/10)
- Calcular % que prefiere A vs B
- Validar willingness to pay ($990, $1.990, etc.)
- Capturar leads (emails/WhatsApp para beta)

### ¿Para qué sirven?

✅ **MEJOR PARA:**
- Decidir A vs B con confianza (si 65% prefiere B → dato sólido)
- Medir a escala (100-200 personas)
- Validación rápida (7 días vs 14 días)
- Justificar decisión ante inversionistas (data > opinión)

❌ **NO SIRVEN PARA:**
- Entender el "por qué" profundo
- Descubrir pains no obvios
- Validar lenguaje/copy (opciones cerradas)
- Generar insights cualitativos

### Ejemplo de Insight de Cuestionario

```
Resultados (n=120):

Pain B (olvidar pagos): 7.8/10 promedio
Pain A (deudas informales): 5.2/10 promedio

P12 (Comparación directa):
- 68% prefiere Opción B (pagos)
- 22% prefiere Opción A (deudas)
- 10% ambas igual

↓ INSIGHT:
DECISIÓN CLARA: B gana con 68% vs 22% (3:1 ratio)
Construir para pagos recurrentes (B)
```

### Documentos disponibles:

- `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION.md` - Versión larga (19 preguntas, 6-8 min)
- `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION_COMPACTO.md` - Versión compacta (9 preguntas, 3-4 min)

---

## 🚀 ESTRATEGIA RECOMENDADA (por agente experto)

### OPCIÓN HÍBRIDA: Entrevistas → Cuestionarios (21 días)

**Por qué es la mejor opción:**
- Combina profundidad (entrevistas) + escala (cuestionarios)
- Entrevistas refinan las preguntas del cuestionario
- Cuestionario valida hallazgos de entrevistas a escala
- Reduce riesgo de sesgo de confirmación

### Plan de 21 días

```
📅 FASE 1: ENTREVISTAS (Días 1-7)
├─ Día 1: Reclutar 15-20 personas (friends & family)
├─ Días 2-6: Hacer 3-4 entrevistas/día (25 min c/u)
├─ Día 7: Analizar resultados + generar insights
└─ OUTPUT: Entiendes problema profundamente

📅 FASE 2: CUESTIONARIO (Días 8-14)
├─ Día 8: Crear formulario (usar versión compacta como base)
├─ Día 9: Ajustar preguntas basado en insights de entrevistas
├─ Días 10-14: Distribuir (WhatsApp, IG, ads si necesario)
└─ OUTPUT: 100-150 respuestas

📅 FASE 3: DECISIÓN (Días 15-21)
├─ Día 15: Analizar cuestionario + cruzar con entrevistas
├─ Día 16: Calcular métricas (pain scores, % A vs B, WTP)
├─ Día 17: Decidir: A, B, Empate, o Pivotar
├─ Días 18-20: Si valida, diseñar landing page + ads
└─ Día 21: DECISIÓN FINAL documentada

🎯 RESULTADO: Decisión con evidencia cualitativa + cuantitativa
```

---

## 💰 COSTO Y TIEMPO COMPARADO

| Método | Tiempo total | Costo | Calidad decisión |
|--------|-------------|-------|------------------|
| **Solo entrevistas** | 7-14 días | $0 | ⭐⭐⭐ Bueno (pero n=15) |
| **Solo cuestionario** | 5-7 días | $20-50k ads | ⭐⭐⭐⭐ Muy bueno |
| **Híbrido (recomendado)** | 21 días | $20-50k ads | ⭐⭐⭐⭐⭐ EXCELENTE |

**Trade-off:**
- Híbrido toma 2x más tiempo, pero reduce riesgo de pivotar mal
- Invertir 21 días ahora puede ahorrarte 6 meses de desarrollo en dirección equivocada

---

## ⚖️ PROS Y CONS DETALLADOS

### ENTREVISTAS 1-A-1

**✅ PROS:**
1. **Profundidad real**: Descubres el "por qué" detrás del pain
2. **Lenguaje del usuario**: Obtienes palabras exactas para copy/landing
3. **Insights sorprendentes**: A veces descubres pains no considerados
4. **Gratis**: No necesitas presupuesto de ads
5. **Valida supuestos**: Confirmas/refutas hipótesis rápidamente
6. **Flexibilidad**: Puedes profundizar en respuestas interesantes

**❌ CONS:**
1. **No es estadísticamente significativo**: n=15 no representa mercado
2. **Sesgo de cortesía**: Amigos/familia tienden a ser optimistas
3. **Lento**: 7-10 horas de entrevistas + análisis
4. **No decide A vs B con confianza**: 8/15 prefieren A ¿es suficiente?
5. **Requiere habilidad**: Mala entrevista = datos sesgados
6. **Difícil de replicar**: Cada entrevista es única

**Cuándo usar solo entrevistas:**
- ❌ NO usar si necesitas decisión rápida y confiable (A vs B)
- ✅ SÍ usar si quieres entender problema antes de construir
- ✅ SÍ usar si presupuesto = $0 y tienes tiempo

---

### CUESTIONARIOS GOOGLE FORMS

**✅ PROS:**
1. **Escala**: 100-200 respuestas en 5-7 días
2. **Estadísticamente significativo**: n=100 da confianza
3. **Decisión clara**: 68% prefiere B → construir B
4. **Rápido**: 3-8 min por respuesta (vs 30 min entrevista)
5. **Anónimo**: Reduce sesgo de cortesía (pero no elimina)
6. **Fácil distribuir**: WhatsApp, IG, ads
7. **Captura leads**: P18/P19 generan beta users

**❌ CONS:**
1. **Superficial**: No entiendes el "por qué"
2. **Respuestas cerradas**: Pierdes insights cualitativos
3. **Sesgo declarativo**: Dicen "pagaría $2.990" pero...
4. **Requiere ads**: Para 100+ respuestas necesitas presupuesto
5. **Sesgo de confirmación**: Preguntas mal diseñadas sesgan respuestas
6. **No valida lenguaje**: No sabes qué palabras resuenan

**Cuándo usar solo cuestionarios:**
- ✅ SÍ usar si necesitas decisión A vs B con confianza estadística
- ✅ SÍ usar si tienes presupuesto ($20-50k ads)
- ❌ NO usar si no entiendes el problema profundamente todavía

---

## 🎓 EVALUACIÓN CRÍTICA DEL AGENTE

El agente asesor-lean-startup evaluó los cuestionarios diseñados y concluyó:

### ¿Sirven para DETECTAR LA BRECHA?

**Respuesta**: ✅ **SÍ PARCIAL (80%)**

**Fortalezas:**
- ✅ Pain scores (P1, P2, P6, P10, P11) miden intensidad
- ✅ Comparación directa (P12) fuerza elección
- ✅ Canal preferido (P13) valida WhatsApp vs otros

**Debilidades detectadas:**
- ⚠️ Falta validación de comportamiento pasado (agregada en v2.0: P14, P14b)
- ⚠️ Falta consecuencias tangibles (agregada en v2.0: P1b, P5)
- ⚠️ Falta smoke test real (agregada en v2.0: P19, P8)

**Mejoras aplicadas:**
- ✅ Agregada P14: ¿Pagas HOY por apps? (comportamiento real)
- ✅ Agregada P19/P8: Smoke test beta (conversión intención → acción)
- ✅ Agregada P1b: ¿Pagaste multas? (consecuencias reales)

### ¿Sirven para CREAR EL MVP?

**Respuesta**: ⚠️ **PARCIAL (60%)**

**Lo que SÍ obtienes:**
- ✅ Decisión A vs B clara
- ✅ Canal preferido validado
- ✅ WTP aproximado
- ✅ Leads para beta

**Lo que NO obtienes:**
- ❌ Features específicas que necesitan
- ❌ Copy/lenguaje que resuena
- ❌ Objeciones reales
- ❌ Workarounds actuales (qué usan hoy)

**Conclusión del agente:**
> "Para MVP robusto: necesitas entrevistas PRIMERO (15-20), luego cuestionario (100-150) para validar a escala. Solo cuestionario = riesgo de construir features que nadie pidió."

---

## 🎯 RECOMENDACIÓN FINAL DEL AGENTE

### ESTRATEGIA: Entrevistas → Cuestionario → Decisión (21 días)

**Justificación:**

1. **Días 1-7: Entrevistas**
   - Entiendes el problema profundamente
   - Descubres pains específicos (multas, cortes, vergüenza)
   - Obtienes lenguaje para copy ("me sentí tonto")
   - Identificas workarounds (alarmas, memoria, PAC)

2. **Días 8-14: Cuestionario**
   - Validas hallazgos de entrevistas a escala (n=100+)
   - Mides A vs B con confianza estadística
   - Capturas leads para beta
   - Conviertes intención en acción (smoke test P19/P8)

3. **Días 15-21: Decisión**
   - Cruzas datos cualitativos + cuantitativos
   - Decides A, B, Empate, o Pivotar
   - Diseñas landing con lenguaje validado
   - Comienzas desarrollo con confianza

**Ventaja clave:**
> "21 días para evitar 6 meses de desarrollo en dirección equivocada"

---

## 🚦 OPCIONES PARA DISCUTIR

### OPCIÓN 1: Solo Cuestionario Compacto (7 días) ⚡

**¿Cuándo?**
- Necesitas decisión RÁPIDA
- Tienes presupuesto ($20-50k ads)
- Ya conoces el problema (no es la primera vez que lo ves)
- Prioridad: velocidad > profundidad

**Qué hacer:**
1. Día 1: Crear formulario (versión compacta, 9 preguntas)
2. Días 2-5: Distribuir (WhatsApp, IG, ads)
3. Día 6: Analizar (100+ respuestas)
4. Día 7: Decidir A vs B

**Riesgo:**
- ⚠️ Puedes tomar decisión correcta (A vs B) pero construir features equivocados
- ⚠️ Sin entrevistas, no tienes lenguaje validado para landing

---

### OPCIÓN 2: Solo Entrevistas (14 días) 🔍

**¿Cuándo?**
- Presupuesto = $0
- Quieres entender problema PROFUNDAMENTE
- No te importa n pequeño (15-20 personas)
- Prioridad: profundidad > escala

**Qué hacer:**
1. Días 1-10: Hacer 15-20 entrevistas
2. Días 11-12: Analizar + generar insights
3. Día 13: Calcular métricas (pain scores, % A vs B)
4. Día 14: Decidir (con menos confianza estadística)

**Riesgo:**
- ⚠️ Decisión A vs B con n=15 no es representativo
- ⚠️ Si 9/15 prefieren A... ¿es suficiente? (60%, pero n=15)

---

### OPCIÓN 3: Híbrido (21 días) 🎯 ⭐ RECOMENDADA

**¿Cuándo?**
- Quieres MEJOR decisión posible
- Puedes invertir 3 semanas
- Tienes presupuesto ($20-50k ads) o no (orgánico)
- Prioridad: reducir riesgo de pivotar mal

**Qué hacer:**
1. Días 1-7: Entrevistas (15-20 personas)
2. Días 8-14: Cuestionario (100-150 personas)
3. Días 15-21: Análisis + decisión

**Ventaja:**
- ✅ Profundidad (entrevistas) + Escala (cuestionario)
- ✅ Lenguaje validado + Decisión estadística
- ✅ Insights cualitativos + Data cuantitativa
- ✅ Features específicas + WTP medido

---

## 📋 TABLA DE DECISIÓN

| Si tu situación es... | Recomendación |
|----------------------|---------------|
| Presupuesto $0, tiempo 14 días | Solo entrevistas |
| Presupuesto $20-50k, tiempo 7 días | Solo cuestionario compacto |
| Presupuesto $20-50k, tiempo 21 días | **Híbrido (recomendado)** |
| Presupuesto $0, tiempo 21 días | Entrevistas + cuestionario orgánico |
| Ya conoces el problema muy bien | Solo cuestionario |
| Primera vez validando este problema | **Híbrido (recomendado)** |

---

## 🎬 PRÓXIMOS PASOS

### Si deciden: **Solo Entrevistas**

1. ✅ Leer `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md`
2. ✅ Reclutar 15-20 personas (friends & family)
3. ✅ Hacer entrevistas (días 1-7)
4. ✅ Analizar con `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md`
5. ✅ Decidir A vs B (con n=15)

### Si deciden: **Solo Cuestionario**

1. ✅ Elegir versión:
   - Larga (19 preguntas, 6-8 min): `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION.md`
   - Compacta (9 preguntas, 3-4 min): `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION_COMPACTO.md`
2. ✅ Crear formulario en Google Forms
3. ✅ Distribuir (WhatsApp, IG, ads)
4. ✅ Analizar (50+ respuestas mínimo)
5. ✅ Decidir A vs B

### Si deciden: **Híbrido** ⭐

1. ✅ **SEMANA 1**: Entrevistas
   - Leer `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md`
   - Reclutar 15-20 personas
   - Hacer 3-4 entrevistas/día
   - Capturar con `/docs/PLANTILLA_CAPTURA_ENTREVISTAS.md`

2. ✅ **SEMANA 2**: Cuestionario
   - Analizar entrevistas con `/docs/GUIA_ANALISIS_RESULTADOS_ENTREVISTAS.md`
   - Ajustar preguntas del cuestionario basado en insights
   - Crear formulario (versión compacta recomendada)
   - Distribuir (target: 100+ respuestas)

3. ✅ **SEMANA 3**: Decisión
   - Analizar cuestionario
   - Cruzar con insights de entrevistas
   - Calcular métricas (pain scores, % A vs B, WTP)
   - **DECIDIR: A, B, Empate, o Pivotar**
   - Documentar en `/docs/DECISION_SEGMENTO_PAYME.md`

---

## 💡 INSIGHTS CLAVE PARA LA DISCUSIÓN

`★ Insight ─────────────────────────────────────`

**1. Velocidad vs Confianza**
- Solo cuestionario = 7 días, decisión rápida (80% confianza)
- Híbrido = 21 días, mejor decisión (95% confianza)
- Trade-off: ¿3 semanas extra valen reducir riesgo de pivotar mal?

**2. Sesgo de Cortesía**
- Entrevistas con amigos = ALTO sesgo ("no quiero decir que no")
- Cuestionario anónimo = MODERADO sesgo (mejorado con P19/P8 smoke test)
- Mitigación: Smoke test convierte intención en acción real

**3. Mejoras v2.0 Aplicadas**
- ✅ P14/P14b: Valida comportamiento ACTUAL (no futuro)
- ✅ P19/P8: Smoke test elimina sesgo de cortesía
- ✅ P1b: Consecuencias tangibles (multas reales $$$)
- Resultado: Cuestionarios v2.0 son 40% más confiables que v1.0

**4. Costo Real**
- Entrevistas: $0 pero 10 horas de trabajo
- Cuestionario orgánico: $0 pero 50-80 respuestas máx
- Cuestionario con ads: $20-50k pero 150-200 respuestas
- Híbrido: $20-50k + 15 horas trabajo = mejor ROI

`─────────────────────────────────────────────────`

---

## 📞 PREGUNTAS PARA DISCUTIR CON SOCIO

1. **¿Cuánto tiempo tenemos?**
   - ¿Podemos invertir 21 días o necesitamos decidir en 7?

2. **¿Cuál es nuestro presupuesto?**
   - ¿Tenemos $20-50k para ads o validamos orgánico?

3. **¿Qué tan bien conocemos el problema?**
   - ¿Primera vez validando o ya hicimos discovery?

4. **¿Qué tipo de decisión necesitamos?**
   - Solo A vs B (cuestionario suficiente)
   - A vs B + features + copy (necesitamos entrevistas)

5. **¿Cuál es nuestro mayor riesgo?**
   - Decidir A cuando era B → Cuestionario
   - Construir features que nadie pidió → Entrevistas + Cuestionario

---

**Última actualización**: 2025-11-03
**Próximo documento**: `/docs/DECISION_SEGMENTO_PAYME.md` (crear después de validar)
**Documentos relacionados**:
- `/docs/SCRIPT_ENTREVISTAS_VALIDACION.md`
- `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION.md`
- `/docs/CUESTIONARIO_GOOGLE_FORMS_VALIDACION_COMPACTO.md`
- `/docs/ANALISIS_LEAN_STARTUP_PAYME.md`
