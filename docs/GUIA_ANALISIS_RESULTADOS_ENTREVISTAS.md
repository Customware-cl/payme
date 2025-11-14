# Guía de Análisis de Resultados - Entrevistas Payme

**Versión**: 1.0
**Objetivo**: Consolidar datos de 15-20 entrevistas y decidir próximo paso (A, B, o pivotar)

---

## 📊 PASO 1: CONSOLIDACIÓN DE DATOS CUANTITATIVOS

### 1.1 Crear Tabla Resumen en Excel/Google Sheets

Crea una hoja con las siguientes columnas:

```
| ID | Nombre | Edad | Ocupación | Pain_B | Pain_A | Método_B_funciona | Incomodidad_A | Olvidos_6m | Presta/Pide | Prioridad | WTP | Usaría | Primero_para |
```

**Ejemplo de fila:**
```
| 1 | Juan P. | 32 | Ingeniero | 8 | 3 | 4 | 7 | Sí (3x) | No | B | $1990 | Sí | B |
```

### 1.2 Convertir Datos Textuales a Numéricos

**Olvidos en 6 meses:**
- Nunca = 0
- 1-2 veces = 1.5
- 3-5 veces = 4
- +5 veces = 6

**Presta/Pide dinero:**
- No = 0
- Rara vez = 1
- Mensualmente = 2
- Semanalmente = 3

**Prioridad:**
- A = 1
- B = 2
- Empate = 1.5
- Ninguno = 0

**Willingness to Pay:**
- $0 = 0
- $990 = 990
- $1.990 = 1990
- $2.990 = 2990
- $4.990+ = 4990
- No usaría = -1

**Usaría:**
- Sí = 2
- Tal vez = 1
- No = 0

---

## 📈 PASO 2: CALCULAR MÉTRICAS CLAVE

### 2.1 Métricas de Pain (scores sobre 10)

Calcula promedios de toda la muestra:

```
Pain B promedio = PROMEDIO(columna Pain_B)
Pain A promedio = PROMEDIO(columna Pain_A)
```

**Interpretación:**
- ≥ 7.0 = Pain **fuerte** (validado)
- 5.0 - 6.9 = Pain **moderado** (requiere más investigación)
- < 5.0 = Pain **débil** (no validado)

### 2.2 Comparación Directa

Cuenta cuántas personas priorizaron cada opción:

```
Priorizan B = CONTAR.SI(columna Prioridad, "B")
Priorizan A = CONTAR.SI(columna Prioridad, "A")
Empate = CONTAR.SI(columna Prioridad, "Empate")
Ninguno = CONTAR.SI(columna Prioridad, "Ninguno")
```

**Calcula porcentajes:**
```
% Prioriza B = (Priorizan B / Total entrevistas) * 100
% Prioriza A = (Priorizan A / Total entrevistas) * 100
```

### 2.3 Willingness to Pay

```
WTP promedio = PROMEDIO(columna WTP, excluyendo -1)
% Pagaría algo = (Personas con WTP > 0 / Total) * 100
% No pagaría ni gratis = (Personas con WTP = -1 / Total) * 100
```

**Distribución de pricing:**
```
% Solo gratis = CONTAR.SI(WTP, 0) / Total * 100
% $990 = CONTAR.SI(WTP, 990) / Total * 100
% $1.990 = CONTAR.SI(WTP, 1990) / Total * 100
% $2.990+ = CONTAR.SI(WTP, >=2990) / Total * 100
```

### 2.4 Intención de Uso

```
% Usaría definitivamente = CONTAR.SI(Usaría, "Sí") / Total * 100
% Tal vez = CONTAR.SI(Usaría, "Tal vez") / Total * 100
% No usaría = CONTAR.SI(Usaría, "No") / Total * 100
```

### 2.5 Engagement con Pain (indicador de urgencia)

**Para Pain B:**
```
% Olvidó pagos en 6m = CONTAR.SI(Olvidos_6m, ">0") / Total * 100
Frecuencia promedio olvidos = PROMEDIO(Olvidos_6m)
```

**Para Pain A:**
```
% Presta/pide dinero = CONTAR.SI(Presta/Pide, ">0") / Total * 100
```

---

## 🎯 PASO 3: ANÁLISIS DE SEGMENTOS

### 3.1 Segmentación por Intensidad de Pain

Divide tu muestra en grupos:

**Grupo 1: Pain B Dominante**
- Pain B ≥ 7 AND Pain A < 5

**Grupo 2: Pain A Dominante**
- Pain A ≥ 7 AND Pain B < 5

**Grupo 3: Ambos Pains**
- Pain A ≥ 7 AND Pain B ≥ 7

**Grupo 4: Sin Pain Significativo**
- Pain A < 5 AND Pain B < 5

**Analiza cada grupo:**
- Tamaño del grupo
- Características demográficas (edad, ocupación)
- WTP promedio del grupo
- ¿Cuál es el grupo más grande?

### 3.2 Segmentación por Edad

```
18-25 años: ___% prioriza B, ___% prioriza A
26-35 años: ___% prioriza B, ___% prioriza A
36-50 años: ___% prioriza B, ___% prioriza A
51+ años: ___% prioriza B, ___% prioriza A
```

**Insight:** ¿Hay un segmento etario donde B o A resuena más?

### 3.3 Segmentación por Ocupación

```
Independientes/Emprendedores: ___% prioriza B, ___% prioriza A
Empleados corporativos: ___% prioriza B, ___% prioriza A
Otros: ___% prioriza B, ___% prioriza A
```

**Insight:** ¿Alguna ocupación tiene pain más fuerte?

---

## 🚦 PASO 4: CRITERIOS DE DECISIÓN

### 4.1 Matriz de Decisión: Opción B (Pagos Recurrentes)

Marca ✅ o ❌ según tus resultados:

| Criterio | Objetivo | Tu Resultado | ✅/❌ |
|----------|----------|--------------|-------|
| Pain B promedio | ≥ 7.0 | ___ | |
| % Prioriza B | ≥ 60% | ___% | |
| % Olvidó pagos 6m | ≥ 50% | ___% | |
| WTP promedio | ≥ $990 | $___ | |
| % Pagaría algo | ≥ 40% | ___% | |
| % Usaría (Sí+Tal vez) | ≥ 70% | ___% | |

**Decisión B:**
- Si ≥ 5 criterios cumplen → **✅ VALIDADO: Construir para B**
- Si 3-4 criterios cumplen → **⚠️ VALIDADO PARCIAL: Iterar messaging y repetir**
- Si ≤ 2 criterios cumplen → **❌ NO VALIDADO: Considerar A o pivotar**

---

### 4.2 Matriz de Decisión: Opción A (Deudas Informales)

| Criterio | Objetivo | Tu Resultado | ✅/❌ |
|----------|----------|--------------|-------|
| Pain A promedio | ≥ 7.0 | ___ | |
| % Prioriza A | ≥ 60% | ___% | |
| % Presta/pide dinero | ≥ 60% | ___% | |
| Incomodidad recordar | ≥ 7.0 | ___ | |
| WTP promedio | ≥ $990 | $___ | |
| % Usaría (Sí+Tal vez) | ≥ 70% | ___% | |

**Decisión A:**
- Si ≥ 5 criterios cumplen → **✅ VALIDADO: Construir para A**
- Si 3-4 criterios cumplen → **⚠️ VALIDADO PARCIAL: Iterar messaging**
- Si ≤ 2 criterios cumplen → **❌ NO VALIDADO: Considerar B o pivotar**

---

### 4.3 Escenarios Posibles

#### Escenario 1: B gana claramente ✅
**Condición**: B cumple ≥5 criterios, A cumple ≤3

**Acción recomendada:**
→ Proceder con **Experimento #2: Landing Page B**
→ Preparar smoke test enfocado 100% en pagos recurrentes
→ Considerar A como feature secundaria para más adelante

---

#### Escenario 2: A gana claramente ✅
**Condición**: A cumple ≥5 criterios, B cumple ≤3

**Acción recomendada:**
→ Proceder con **Experimento #2: Landing Page A**
→ Smoke test enfocado en deudas informales
→ Reconsiderar fundamento original (estaba correcto)

---

#### Escenario 3: Empate técnico ⚖️
**Condición**: Ambos cumplen 4-5 criterios

**Acción recomendada:**
→ **Experimento #2 con A/B test**: Landing page A vs Landing page B
→ $50k ads cada una
→ Dejar que el mercado decida con su engagement

**Criterio de desempate:**
- Medir CTR y conversion rate
- El que tenga >2x mejor performance → Es el ganador
- Si empatan en ads también → Elegir el de mayor WTP promedio

---

#### Escenario 4: Ninguno valida ❌
**Condición**: Ambos cumplen ≤2 criterios

**Acción recomendada:**
→ **PIVOTAR** messaging o propuesta de valor

**Posibles problemas:**
1. **Pain no es fuerte**: Tal vez el problema no duele tanto como pensábamos
2. **Solución no calza**: WhatsApp recordatorios no es la solución correcta
3. **Segmento equivocado**: Entrevistamos a personas fuera del target
4. **Pricing mal comunicado**: No explicamos bien el valor

**Siguiente paso:**
- Hacer 5 entrevistas más profundas con los que mostraron mayor pain
- Reformular hipótesis de valor
- Considerar soluciones alternativas al problema

---

## 💡 PASO 5: ANÁLISIS CUALITATIVO

### 5.1 Revisión de Citas Textuales

Lee todas las citas textuales que capturaste. Agrúpalas por temas:

**Temas comunes en Pain B:**
- [ ] Multas y costos financieros
- [ ] Estrés mental por recordar
- [ ] Vergüenza por cortes de servicio
- [ ] Falta de tiempo para gestionar
- [ ] Otro: _________________

**Temas comunes en Pain A:**
- [ ] Incomodidad social
- [ ] Pérdida de dinero
- [ ] Daño en relaciones
- [ ] Desconfianza generada
- [ ] Otro: _________________

### 5.2 Identificar Objecciones Recurrentes

¿Qué objeciones mencionaron varias personas?

**Ejemplos:**
- "Prefiero pago automático"
- "No confío en bots con mi información financiera"
- "WhatsApp me parece invasivo"
- "Ya uso el calendario de mi celular"
- Otra: _________________

**Para cada objeción:**
- ¿Cuántas personas la mencionaron? (__/__)
- ¿Es un show-stopper o solo una preocupación menor?
- ¿Cómo podríamos mitigarla en el MVP?

### 5.3 Descubrir Jobs-to-be-Done

Más allá de A o B, ¿qué "trabajo" están contratando realmente?

**Ejemplos de JTBD:**
- "Quiero estar tranquilo que no se me olvidará nada importante"
- "Quiero evitar conflictos sociales por plata"
- "Quiero que alguien/algo me cuide financieramente"
- "Quiero demostrar que soy responsable con mis compromisos"

**¿Hay un JTBD dominante que aparece en >50% de entrevistas?**

Si sí, ESE es tu core value proposition real.

---

## 📊 PASO 6: REPORTE EJECUTIVO

### 6.1 Template de Resumen

Completa esto después de analizar todo:

---

# RESUMEN EJECUTIVO: Análisis de [__] Entrevistas

**Fecha**: __________
**Muestra**: [__] personas (describir brevemente el perfil)

## Hallazgo Principal

[En 2-3 oraciones, cuál es el insight más importante que descubriste]

## Métricas Clave

| Métrica | Opción B (Pagos) | Opción A (Deudas) |
|---------|------------------|-------------------|
| Pain promedio | ___/10 | ___/10 |
| % Prioriza | ___% | ___% |
| WTP promedio | $___ | $___ |
| % Usaría | ___% | ___% |

## Decisión

☐ **Opción B validada** - Construir para pagos recurrentes
☐ **Opción A validada** - Construir para deudas informales
☐ **Empate** - A/B test en landing pages
☐ **Ninguna validada** - Pivotar

**Justificación (3 razones principales):**
1.
2.
3.

## Segmento Target Identificado

**Descripción del early adopter ideal:**
- Edad: ___-___
- Ocupación: ___________
- Pain dominante: ___________
- WTP: $_______
- Características comunes: ___________

## Propuesta de Valor Refinada

Basado en las entrevistas, nuestra value prop debería ser:

**Headline**: "_______________________________"

**Subheadline**: "_______________________________"

## Objecciones Principales a Mitigar

1. _______________________________
2. _______________________________
3. _______________________________

## Próximo Paso Recomendado

[Describir exactamente qué hacer en Experimento #2]

---

### 6.2 Compartir con Equipo/Asesores

Usa este reporte ejecutivo para:
- Alinear con co-founders o equipo
- Validar decisión con mentores/asesores
- Documentar aprendizaje para futuras iteraciones

---

## 🚀 PASO 7: PREPARAR EXPERIMENTO #2

Una vez que tienes la decisión clara, pasar a:

### Si elegiste B (Pagos Recurrentes):
1. Diseñar landing page enfocada en pain de olvidar pagos
2. Crear ads con copy que resuene con ese segmento
3. Definir formulario de captura con preguntas relevantes

### Si elegiste A (Deudas Informales):
1. Diseñar landing page enfocada en incomodidad social
2. Crear ads con copy que resuene con ese pain
3. Definir formulario que capture contexto de préstamos

### Si elegiste A/B test:
1. Crear DOS landing pages paralelas
2. Distribuir $50k ads c/u
3. Definir KPIs de comparación claros

---

## ✅ CHECKLIST FINAL

Antes de dar por completado el análisis:

- [ ] Tabla resumen con todas las entrevistas creada
- [ ] Métricas cuantitativas calculadas
- [ ] Criterios de decisión evaluados (matrices B y A)
- [ ] Citas textuales revisadas y agrupadas por temas
- [ ] Objecciones recurrentes identificadas
- [ ] JTBD dominante descubierto
- [ ] Reporte ejecutivo completado
- [ ] Decisión tomada y justificada
- [ ] Segmento target definido
- [ ] Value prop refinada
- [ ] Experimento #2 diseñado (al menos a alto nivel)

---

## 🎓 PRINCIPIOS LEAN STARTUP APLICADOS

### Build-Measure-Learn
✅ **Aprendiste** qué problema duele más ANTES de construir solución completa

### Validated Learning
✅ Datos > opiniones. Decisión basada en evidencia, no intuición

### Innovation Accounting
✅ Métricas claras (pain scores, WTP, prioridad) para medir progreso

### Pivotar o Perseverar
✅ Criterios objetivos para decidir si cambiar de dirección

---

## 📚 RECURSOS ADICIONALES

### Lecturas recomendadas:
- "The Mom Test" - Rob Fitzpatrick (sobre cómo hacer entrevistas)
- "The Lean Startup" - Eric Ries (metodología completa)
- "Running Lean" - Ash Maurya (validación paso a paso)

### Herramientas:
- Google Sheets / Excel: Para consolidar datos cuantitativos
- Notion / Airtable: Para organizar citas cualitativas
- Miro / FigJam: Para mapear patrones visuales

---

**Última actualización**: 2025-11-02
**Versión**: 1.0
**Autor**: Análisis Lean Startup Payme

---

## ⏭️ SIGUIENTE DOCUMENTO

Una vez completes este análisis:
→ Leer `docs/EXPERIMENTO_2_LANDING_PAGES.md` (próximo entregable)
