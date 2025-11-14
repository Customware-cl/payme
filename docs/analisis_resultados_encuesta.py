#!/usr/bin/env python3
"""
Análisis de resultados encuesta de validación Payme
89 respuestas - Validación Lean Startup para decidir entre:
- Opción A: Deudas informales (dinero u objetos prestados)
- Opción B: Pagos recurrentes (cuentas, dividendos, etc.)
"""

import csv
import statistics
from collections import Counter

# Leer CSV
csv_path = '/home/customware/Descargas/Encuesta 1 - -qt-Ayúdame a validar una idea 💡-qt-.csv'

with open(csv_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    responses = list(reader)

print(f"=" * 80)
print(f"ANÁLISIS DE RESULTADOS - ENCUESTA VALIDACIÓN PAYME")
print(f"=" * 80)
print(f"Total respuestas: {len(responses)}\n")

# ============================================================================
# MÉTRICAS PAIN B (PAGOS RECURRENTES)
# ============================================================================
print("📊 MÉTRICAS PAIN B (PAGOS RECURRENTES)")
print("-" * 80)

# Q10: Pain score (1-10)
pain_b_scores = []
for r in responses:
    val = r['Q10. ¿Qué tan estresante es para ti acordarte de pagar todas tus cuentas a tiempo?']
    if val and val != '-':
        try:
            pain_b_scores.append(int(val))
        except:
            pass

pain_b_promedio = statistics.mean(pain_b_scores) if pain_b_scores else 0
pain_b_mediana = statistics.median(pain_b_scores) if pain_b_scores else 0

print(f"Pain B Promedio: {pain_b_promedio:.2f}/10")
print(f"Pain B Mediana: {pain_b_mediana:.1f}/10")
print(f"Pain B ≥7 (pain alto): {sum(1 for s in pain_b_scores if s >= 7)} ({sum(1 for s in pain_b_scores if s >= 7)/len(pain_b_scores)*100:.1f}%)")
print(f"Pain B ≥5 (pain moderado): {sum(1 for s in pain_b_scores if s >= 5)} ({sum(1 for s in pain_b_scores if s >= 5)/len(pain_b_scores)*100:.1f}%)")

# Q8: Olvidó pagos
olvido_pagos = 0
nunca_olvido = 0
for r in responses:
    val = r['Q8. En los últimos 6 meses, ¿has olvidado pagar alguna cuenta a tiempo?']
    if 'Nunca' in val:
        nunca_olvido += 1
    elif val and val != '-':
        olvido_pagos += 1

print(f"\n% Olvidó Pagos (últimos 6 meses): {olvido_pagos}/{len(responses)} ({olvido_pagos/len(responses)*100:.1f}%)")
print(f"% Nunca Olvidó: {nunca_olvido}/{len(responses)} ({nunca_olvido/len(responses)*100:.1f}%)")

# ============================================================================
# MÉTRICAS PAIN A (DEUDAS INFORMALES)
# ============================================================================
print(f"\n{'='*80}")
print("📊 MÉTRICAS PAIN A (DEUDAS INFORMALES)")
print("-" * 80)

# Q17: Incomodidad
pain_a_incomodidad = []
for r in responses:
    val = r['Q17. ¿Qué tan incómodo te resulta recordarle a alguien que te debe dinero o un objeto prestado?']
    if val and val != '-':
        try:
            pain_a_incomodidad.append(int(val))
        except:
            pass

# Q18: Estrés
pain_a_estres = []
for r in responses:
    val = r['Q18. ¿Qué tan estresante es para ti gestionar estas deudas informales?']
    if val and val != '-':
        try:
            pain_a_estres.append(int(val))
        except:
            pass

pain_a_incomodidad_promedio = statistics.mean(pain_a_incomodidad) if pain_a_incomodidad else 0
pain_a_estres_promedio = statistics.mean(pain_a_estres) if pain_a_estres else 0
pain_a_promedio = (pain_a_incomodidad_promedio + pain_a_estres_promedio) / 2

print(f"Pain A Incomodidad: {pain_a_incomodidad_promedio:.2f}/10")
print(f"Pain A Estrés: {pain_a_estres_promedio:.2f}/10")
print(f"Pain A Promedio: {pain_a_promedio:.2f}/10")
print(f"Pain A ≥7 (pain alto): {sum(1 for s in pain_a_incomodidad if s >= 7) + sum(1 for s in pain_a_estres if s >= 7)} mediciones")

# Q14: Experiencia con préstamos
experiencia_prestamos = Counter()
for r in responses:
    val = r['Q14. En el último año, ¿has prestado o te han prestado dinero u objetos de forma informal?']
    if val:
        experiencia_prestamos[val] += 1

print(f"\nExperiencia con préstamos informales:")
for k, v in experiencia_prestamos.most_common():
    print(f"  {k}: {v} ({v/len(responses)*100:.1f}%)")

# ============================================================================
# 🔥 CRÍTICO: DIFERENCIACIÓN DINERO VS OBJETOS (Q15)
# ============================================================================
print(f"\n{'='*80}")
print("🔥 CRÍTICO: DIFERENCIACIÓN DINERO VS OBJETOS (Q15)")
print("-" * 80)
print("⚠️  Esta métrica es LA MÁS IMPORTANTE para decidir qué MVP construir")
print("-" * 80)

diferenciacion = Counter()
for r in responses:
    val = r['Q15. ¿En cuál de estas situaciones has experimentado MÁS incomodidad al recordar o que te recuerden?']
    if val and val != '-':
        diferenciacion[val] += 1

total_q15 = sum(diferenciacion.values())
print(f"\nTotal respuestas Q15: {total_q15}")

for k, v in sorted(diferenciacion.items(), key=lambda x: x[1], reverse=True):
    porcentaje = v/total_q15*100 if total_q15 > 0 else 0
    print(f"  {k}: {v} ({porcentaje:.1f}%)")

# Análisis crítico
dinero_count = diferenciacion.get('Dinero prestado 💰 (me incomoda más recordar/pedir plata)', 0)
objetos_count = diferenciacion.get('Objetos prestados 📦 (me incomoda más recordar/pedir objetos de vuelta)', 0)
ambos_count = diferenciacion.get('Ambos por igual', 0)
evita_conflicto = diferenciacion.get('Nunca he hecho el recordatorio (evito el conflicto)', 0)

if total_q15 > 0:
    dinero_pct = dinero_count/total_q15*100
    objetos_pct = objetos_count/total_q15*100
    ambos_pct = ambos_count/total_q15*100
    evita_pct = evita_conflicto/total_q15*100

    print(f"\n🎯 DECISIÓN CRÍTICA:")
    print(f"   % Pain Dinero: {dinero_pct:.1f}%")
    print(f"   % Pain Objetos: {objetos_pct:.1f}%")
    print(f"   % Ambos: {ambos_pct:.1f}%")
    print(f"   % Evita Conflicto: {evita_pct:.1f}%")

    print(f"\n📊 RECOMENDACIÓN SEGÚN DATOS:")
    if dinero_pct >= 70:
        print(f"   ✅ CONSTRUIR MVP SOLO PARA DINERO ({dinero_pct:.1f}% ≥ 70%)")
    elif objetos_pct >= 70:
        print(f"   ✅ CONSTRUIR MVP SOLO PARA OBJETOS ({objetos_pct:.1f}% ≥ 70%)")
    elif ambos_pct >= 40:
        print(f"   ⚠️  PAIN DISTRIBUIDO - MVP híbrido o experimentar separadamente")
    else:
        print(f"   ℹ️  PAIN MIXTO - Dinero {dinero_pct:.1f}%, Objetos {objetos_pct:.1f}%, Ambos {ambos_pct:.1f}%")

# ============================================================================
# 🎯 COMPARACIÓN DIRECTA A vs B (Q21) - PREGUNTA DECISIVA
# ============================================================================
print(f"\n{'='*80}")
print("🎯 COMPARACIÓN DIRECTA A vs B (Q21) - PREGUNTA DECISIVA")
print("-" * 80)

comparacion = Counter()
for r in responses:
    val = r['Q21. De estos dos usos, ¿cuál te resultaría MÁS ÚTIL?']
    if val:
        comparacion[val] += 1

print(f"Total respuestas Q21: {len(responses)}\n")

opcion_a = comparacion.get('Opción 2: Recordatorios para deudas informales (dinero u objetos prestados a amigos/familia)', 0)
opcion_b = comparacion.get('Opción 1: Recordatorios para cuentas recurrentes (dividendo, luz, agua, internet, etc.)', 0)
ambos = comparacion.get('Ambos me parecen igual de útiles', 0)
ninguno = comparacion.get('Ninguno me parece útil', 0)

print(f"Opción B (Pagos recurrentes): {opcion_b} ({opcion_b/len(responses)*100:.1f}%)")
print(f"Opción A (Deudas informales): {opcion_a} ({opcion_a/len(responses)*100:.1f}%)")
print(f"Ambos por igual: {ambos} ({ambos/len(responses)*100:.1f}%)")
print(f"Ninguno útil: {ninguno} ({ninguno/len(responses)*100:.1f}%)")

print(f"\n🏆 GANADOR SEGÚN COMPARACIÓN DIRECTA:")
if opcion_b > opcion_a:
    print(f"   ✅ OPCIÓN B (PAGOS RECURRENTES) - {opcion_b} vs {opcion_a}")
elif opcion_a > opcion_b:
    print(f"   ✅ OPCIÓN A (DEUDAS INFORMALES) - {opcion_a} vs {opcion_b}")
else:
    print(f"   ⚖️  EMPATE - {opcion_a} vs {opcion_b}")

# Incluyendo "Ambos" como señal de interés
interes_b = opcion_b + ambos
interes_a = opcion_a + ambos
print(f"\nInterés total (incluyendo 'Ambos'):")
print(f"   Interés en B: {interes_b} ({interes_b/len(responses)*100:.1f}%)")
print(f"   Interés en A: {interes_a} ({interes_a/len(responses)*100:.1f}%)")

# ============================================================================
# 📱 CANAL PREFERIDO (Q22)
# ============================================================================
print(f"\n{'='*80}")
print("📱 CANAL PREFERIDO (Q22)")
print("-" * 80)

canales = []
for r in responses:
    val = r['Q22. ¿Por qué medio te gustaría recibir estos recordatorios? (puedes marcar más de uno)']
    if val:
        # Split por comas (respuesta múltiple)
        for canal in val.split(','):
            canales.append(canal.strip())

canal_counter = Counter(canales)
total_menciones = len(canales)

print(f"Total menciones de canales: {total_menciones}\n")
for canal, count in canal_counter.most_common(10):
    print(f"  {canal}: {count} ({count/len(responses)*100:.1f}% de respuestas)")

whatsapp_count = sum(1 for c in canales if 'WhatsApp' in c)
print(f"\n✅ WhatsApp mencionado: {whatsapp_count} veces ({whatsapp_count/len(responses)*100:.1f}% de respuestas)")

# ============================================================================
# 💰 WILLINGNESS TO PAY (Q25)
# ============================================================================
print(f"\n{'='*80}")
print("💰 WILLINGNESS TO PAY (Q25)")
print("-" * 80)

wtp = Counter()
for r in responses:
    val = r['Q25. Si este servicio te ahorrara multas, estrés o incomodidad, ¿cuánto estarías dispuesto a pagar mensualmente?']
    if val:
        wtp[val] += 1

print(f"\nDistribución WTP:\n")
for k, v in sorted(wtp.items(), key=lambda x: x[1], reverse=True):
    print(f"  {k}: {v} ({v/len(responses)*100:.1f}%)")

gratis = wtp.get('$0 - Solo lo usaría si es 100% gratis', 0)
pagarian = len(responses) - gratis
print(f"\n✅ Pagarían algo (>$0): {pagarian} ({pagarian/len(responses)*100:.1f}%)")
print(f"⚠️  Solo gratis: {gratis} ({gratis/len(responses)*100:.1f}%)")

# ============================================================================
# 🚀 INTENCIÓN vs SMOKE TEST
# ============================================================================
print(f"\n{'='*80}")
print("🚀 INTENCIÓN (Q26) vs SMOKE TEST (Q30)")
print("-" * 80)

# Q26: Intención
intencion = Counter()
for r in responses:
    val = r['Q26. Si PayMe estuviera disponible HOY, ¿lo probarías?']
    if val:
        intencion[val] += 1

print(f"Intención de uso (Q26):\n")
si_definitivamente = intencion.get('Sí, definitivamente lo probaría', 0)
tal_vez = intencion.get('Tal vez, dependería de cómo funcione', 0)
no_interesa = intencion.get('No, no me interesa', 0)

print(f"  Sí, definitivamente: {si_definitivamente} ({si_definitivamente/len(responses)*100:.1f}%)")
print(f"  Tal vez: {tal_vez} ({tal_vez/len(responses)*100:.1f}%)")
print(f"  No me interesa: {no_interesa} ({no_interesa/len(responses)*100:.1f}%)")

# Q30: Smoke test
smoke_test = Counter()
for r in responses:
    val = r['Q30. Payme lanzará su beta en 2 semanas']
    if val:
        smoke_test[val] += 1

print(f"\nSmoke test beta (Q30):\n")
for k, v in sorted(smoke_test.items(), key=lambda x: x[1], reverse=True):
    print(f"  {k}: {v} ({v/len(responses)*100:.1f}%)")

quiere_beta = smoke_test.get('Sí, quiero probar la beta AHORA (deje mi contacto arriba)', 0)
conversion_rate = (quiere_beta / si_definitivamente * 100) if si_definitivamente > 0 else 0

print(f"\n📊 CONVERSIÓN INTENCIÓN → ACCIÓN:")
print(f"   {si_definitivamente} dijeron 'Sí definitivamente'")
print(f"   {quiere_beta} dejaron contacto para beta")
print(f"   Conversion Rate: {conversion_rate:.1f}%")

if conversion_rate < 60:
    print(f"   ⚠️  SESGO DE CORTESÍA DETECTADO (conversión <60%)")
elif conversion_rate >= 80:
    print(f"   ✅ ALTA INTENCIÓN REAL (conversión ≥80%)")
else:
    print(f"   ℹ️  INTENCIÓN MODERADA (conversión 60-80%)")

# ============================================================================
# 📋 RESUMEN EJECUTIVO
# ============================================================================
print(f"\n{'='*80}")
print("📋 RESUMEN EJECUTIVO - DECISIÓN DE MVP")
print("="*80)

print(f"\n1️⃣  PAIN SCORES:")
print(f"   Pain B (Pagos): {pain_b_promedio:.2f}/10")
print(f"   Pain A (Deudas): {pain_a_promedio:.2f}/10")

print(f"\n2️⃣  COMPARACIÓN DIRECTA (Q21):")
print(f"   Prefieren B: {opcion_b} ({opcion_b/len(responses)*100:.1f}%)")
print(f"   Prefieren A: {opcion_a} ({opcion_a/len(responses)*100:.1f}%)")
print(f"   Ambos: {ambos} ({ambos/len(responses)*100:.1f}%)")

if total_q15 > 0:
    print(f"\n3️⃣  DIFERENCIACIÓN DINERO vs OBJETOS (Q15) - CRÍTICO:")
    print(f"   Dinero: {dinero_pct:.1f}%")
    print(f"   Objetos: {objetos_pct:.1f}%")
    print(f"   Ambos: {ambos_pct:.1f}%")

print(f"\n4️⃣  CANAL:")
print(f"   WhatsApp preferido: {whatsapp_count/len(responses)*100:.1f}%")

print(f"\n5️⃣  WTP:")
print(f"   Pagarían algo: {pagarian/len(responses)*100:.1f}%")
print(f"   Solo gratis: {gratis/len(responses)*100:.1f}%")

print(f"\n6️⃣  SMOKE TEST:")
print(f"   Intención alta: {si_definitivamente} ({si_definitivamente/len(responses)*100:.1f}%)")
print(f"   Dejaron contacto: {quiere_beta} ({quiere_beta/len(responses)*100:.1f}%)")
print(f"   Conversion Rate: {conversion_rate:.1f}%")

print(f"\n{'='*80}")
print(f"🎯 RECOMENDACIÓN FINAL")
print(f"{'='*80}\n")

# Lógica de decisión
if pain_b_promedio >= 7 and opcion_b > opcion_a:
    print("✅ CONSTRUIR MVP PARA OPCIÓN B (PAGOS RECURRENTES)")
    print(f"   Razones:")
    print(f"   - Pain B alto ({pain_b_promedio:.2f} ≥ 7)")
    print(f"   - {opcion_b} personas prefieren B vs {opcion_a} prefieren A")
    print(f"   - {olvido_pagos/len(responses)*100:.1f}% olvidó pagos en últimos 6 meses")
elif pain_a_promedio >= 7 and opcion_a > opcion_b:
    print("✅ CONSTRUIR MVP PARA OPCIÓN A (DEUDAS INFORMALES)")
    print(f"   Razones:")
    print(f"   - Pain A alto ({pain_a_promedio:.2f} ≥ 7)")
    print(f"   - {opcion_a} personas prefieren A vs {opcion_b} prefieren B")
    if total_q15 > 0 and dinero_pct >= 70:
        print(f"   - {dinero_pct:.1f}% del pain es por DINERO (construir MVP solo para dinero)")
    elif total_q15 > 0 and objetos_pct >= 70:
        print(f"   - {objetos_pct:.1f}% del pain es por OBJETOS (considerar MVP de objetos)")
elif ambos/len(responses) >= 0.40:
    print("⚖️  AMBAS OPCIONES SON VALIOSAS")
    print(f"   Razones:")
    print(f"   - {ambos/len(responses)*100:.1f}% dicen que ambos son igual de útiles")
    print(f"   - Pain B: {pain_b_promedio:.2f}, Pain A: {pain_a_promedio:.2f}")
    print(f"\n   Estrategia recomendada:")
    print(f"   1. MVP inicial: La opción con mayor pain score")
    print(f"   2. Validar con early adopters")
    print(f"   3. Agregar segunda opción en fase 2")
else:
    print("ℹ️  RESULTADOS MIXTOS - REQUIERE ANÁLISIS CUALITATIVO")
    print(f"   Pain B: {pain_b_promedio:.2f}, Pain A: {pain_a_promedio:.2f}")
    print(f"   Preferencia B: {opcion_b}, Preferencia A: {opcion_a}, Ambos: {ambos}")

print(f"\n{'='*80}\n")
