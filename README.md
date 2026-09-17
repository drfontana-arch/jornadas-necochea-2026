# Jornadas Necochea 2026 — Sistema interno

Herramienta interna de la comisión organizadora de las **Jornadas Deportivas
Interdepartamentales del Colegio de Magistrados y Funcionarios del Poder
Judicial de la Provincia de Buenos Aires — Necochea 2026**.

No reemplaza la plataforma oficial de inscripción/resultados
([jornadasdeportivasnecochea.com.ar](https://www.jornadasdeportivasnecochea.com.ar/),
desarrollada por Gonzalo Coelho) — es un sistema complementario, de uso
interno de la organización, para:

- **Sorteo de fixtures**: arma el fixture de cada disciplina/categoría
  (grupos, grupos + playoff, o llave directa), con siembra por antecedentes
  y asignación de horarios que intenta evitar que un mismo participante
  quede jugando dos cosas a la vez.
- **Auditor de jornadas**: carga de resultados, asistencia por
  departamental, registro de incidencias, y detección de superposiciones
  horarias.
- **Agente de supervisión 24/7**: revisa periódicamente la plataforma
  oficial de resultados contra el cronograma y el Reglamento (Anexo I de
  puntajes), y avisa por Telegram/mail ante inconsistencias o demoras.
- **Página del delegado**: un link fijo por departamental donde el
  delegado ve las superposiciones de sus participantes y responde si se
  mantienen o se modifican.

## Estado del proyecto

🚧 En construcción. Este repo arranca con el artifact piloto (React, pensado
originalmente para correr dentro de Claude.ai) como punto de partida y
referencia de la lógica de sorteo ya validada — ver
[`/pilot-artifact`](./pilot-artifact). La migración a una app propia
(Next.js en Vercel + Supabase + GitHub Actions) está en desarrollo.

## Arquitectura prevista

- **Frontend/API**: Next.js, desplegado en Vercel (plan gratuito).
- **Base de datos**: Supabase (Postgres) — proyecto `jornadas-necochea-2026`.
- **Agente de supervisión**: GitHub Actions programado, navega la
  plataforma oficial y dispara alertas.
- **Alertas**: Telegram (bot) + mail (Gmail dedicado con contraseña de
  aplicación).

## Privacidad

Los datos de inscripción por persona (nombre, departamental, disciplina,
categoría, equipo) se usan únicamente para detectar superposiciones
horarias de participantes y armar el fixture. No se procesan datos de pago,
acreditación (DNI, QR, pulseras) ni contacto (teléfono/email) de los
participantes.
