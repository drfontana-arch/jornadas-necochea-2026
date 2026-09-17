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

✅ App Next.js funcional conectada a Supabase: Departamentales, Disciplinas y
sedes, Inscripciones, Antecedentes, Sorteo (con asignación de horarios que
evita superposiciones), Fixture/Calendario con autoresolución de conflictos,
y el módulo Auditor completo (Resumen, Resultados, Asistencia, Incidencias).

🚧 Pendiente: detección de superposiciones a nivel de cada participante (hoy
es a nivel departamental) y la página del delegado — depende del export de
inscriptos que va a pasar Gonzalo Coelho. El artifact piloto original queda
como referencia en [`/pilot-artifact`](./pilot-artifact).

## Cómo correrlo localmente

```bash
npm install
cp .env.example .env.local   # completar con los valores reales
npm run dev
```

## Variables de entorno necesarias

| Variable | Qué es |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase (`jornadas-necochea-2026`) |
| `SUPABASE_ANON_KEY` | Clave anon/publishable de ese proyecto |
| `ACCESS_PASSPHRASE` | Contraseña compartida para entrar a la app |
| `SESSION_SECRET` | Cualquier cadena aleatoria, para firmar la cookie de sesión |

## Deploy

Pensado para desplegarse en Vercel (plan gratuito) conectando este repo
directamente — cada push a `main` dispara un deploy automático. Las cuatro
variables de entorno de arriba se cargan en Vercel → Project Settings →
Environment Variables.

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
