# Correcciones

Se anotan acá y se aplican de a varias juntas (un solo build, un solo push, un solo reset del sorteo).

## Pendientes

_(vacío)_

## Aplicadas (tanda 1)

1. **Excepciones en Departamentales: elegir de una lista.** Al elegir "equipo/pareja" o "persona puntual", se abre un desplegable con los equipos/personas realmente inscriptos de esa departamental (con su categoría), en vez de tipear. Ya no hay errores de tipeo. (`/api/restricciones/opciones`, `listRestrictionOptions` en `lib/db.js`).
2. **Autoresolver respeta el orden de las rondas.** Un partido reprogramado no puede quedar antes de que termine la ronda anterior (ni antes de que termine la fase de grupos, si es playoff) ni después del comienzo de la ronda siguiente (ni del playoff, si es de grupos). Elige el horario válido más cercano al original en vez de mandarlo al final. También se corrigió que no aplicaba los cortes horarios por tipo de disciplina (le faltaba el id de disciplina).
3. **Fixture: filtros por categoría y por equipo**, y orden por día/hora, disciplina o categoría.
4. **Fixture: vistas de grilla** (por cancha con días en columnas; agenda con horas en vertical y días en horizontal), sobre todos los partidos filtrados o solo los seleccionados, con casillero de color por categoría, número de cancha, y descarga a **Excel (.xlsx)** que abre también en Google Sheets.

## Aplicadas (tanda 2)

5. **Botón "Resetear sorteo"** en Fixture y conflictos. Permite elegir el alcance (una categoría, una disciplina completa, o todo el sorteo) y borra SOLO el fixture de partidos de ese alcance (y los resultados ya cargados sobre esos partidos), dejando las categorías "sin sortear" para volver a correr el sorteo. NO toca la modalidad/tamaño de grupo/clasificados de cada categoría, ni las sedes/canchas, ni las inscripciones (equipos/personas). Antes de confirmar, muestra cuántos partidos y categorías se van a borrar.
6. **Aviso de incompatibilidades antes de resetear.** Si el alcance elegido tiene ahora mismo superposiciones horarias o restricciones sin respetar, el panel las lista con el detalle (quién, en qué partidos, qué día y hora), para decidir si conviene resetear o resolverlas a mano sin perder el resto del fixture ya sorteado.

## Aplicadas (tanda 3)

7. **Pantalla nueva "Base de datos"** (nuevo tab en el menú). Permite subir el CSV de inscriptos (`participante_id, nombre, apellido, departamental, disciplina, categoria, equipo, equipo_nro`) y hacer un **reemplazo total**: borra TODAS las personas, equipos (team_entries) e inscripciones (registrations) actuales y las reconstruye desde cero con lo que dice el CSV. Las departamentales que falten se crean solas por nombre. Una disciplina o categoría que el sistema todavía no tenga configurada NO se crea sola -- esas filas quedan afuera y se listan aparte, con cuántas inscripciones afecta y algunos nombres de ejemplo, para configurarla primero en "Disciplinas y sedes". No toca sedes/canchas, la modalidad/tamaño de grupo/clasificados de cada categoría, ni los partidos ya sorteados.
   - Primero muestra una vista previa (cuánto se va a cargar, qué se va a crear, qué queda afuera y por qué) y recién después pide confirmar. No se aplica nada hasta que confirmás.
   - Detecta filas repetidas (misma persona, misma categoría, dos veces) y filas con datos incompletos, y las lista por separado sin frenar el resto de la carga.

## Aplicadas (tanda 4)

8. **El matcheo del CSV ahora ignora también la puntuación** (guiones, puntos, paréntesis, "+"), no solo acentos/mayúsculas/espacios. Antes, "Avellaneda-Lanús" en la base y "AVELLANEDA LANUS" en el CSV se consideraban distintos y se ofrecía crear una departamental duplicada; ahora matchean. Mismo criterio para disciplinas y categorías (ej. "Senior (+42)" matchea con "Senior 42").

## Aplicadas (tanda 5)

9. **Mapeo a mano en la carga del CSV**, para cuando el nombre real del CSV no coincide con el configurado en el sistema (ej. CSV dice "Hockey" y el sistema tiene "Hockey (Seven)"; o CSV dice "Senior (+42)" y el sistema tiene "Más 40"). En cada fila de "no se van a cargar" que sea por disciplina o categoría no configurada, aparece un desplegable para elegir a cuál disciplina/categoría YA EXISTENTE corresponde, y se reanaliza solo. El mapeo no renombra nada del sistema, solo hace que esas filas del CSV entren ahí. Si la disciplina/categoría todavía no existe ni con otro nombre, no aparece nada para mapear -- hay que crearla primero en "Disciplinas y sedes".
   - Probado con el escenario real reportado (Hockey → "Hockey (Seven)", Fútbol Reducido "Senior (+42)" → "Más 40"): sin mapeo se omiten 307 filas correctamente clasificadas por tipo; con el mapeo aplicado, las 3450 filas del CSV real quedan válidas.

## Aplicadas (tanda 6)

10. **Deshacer una división Copa Oro/Plata.** En "Inscripciones" aparece un panel arriba de todo, "Categorías ya divididas en Copa Oro/Plata", cuando hay alguna -- con un botón "Deshacer división" por cada una. Borra las dos categorías (Oro/Plata) con sus equipos, inscripciones y partidos si tenían, y reactiva la categoría única original (que hasta entonces queda oculta del selector, porque una categoría dividida se desactiva). Pensado para el caso real: se dividió con datos de prueba antes de tener el CSV real -- se deshace, se recarga el CSV sobre la categoría única, y recién con los números reales se vuelve a dividir.

## Aplicadas (tanda 7)

11. **Fix: `participants.id` es un uuid, no el número del CSV.** La carga fallaba con `invalid input syntax for type uuid: "2031"` porque se intentaba usar el `participante_id` del CSV (un número correlativo del padrón) directamente como id de la persona en la base. Ahora se genera un uuid propio para cada persona nueva y se usa ese id -- tanto al crearla como al vincular sus inscripciones -- sin depender de qué tipo de dato tenga esa columna.

## Aplicadas (tanda 8)

12. **Travesía 4x4 y Pesca ya no generan conflicto de horario.** Aunque una misma persona esté anotada en Travesía 4x4 o Pesca Y en otra disciplina al mismo tiempo, ya no aparece como superposición en "Fixture y conflictos" ni en el aviso de incompatibilidades al resetear el sorteo. Siguen apareciendo como filas normales en el Fixture. No cambia cómo el sorteo elige horarios (eso sigue evitando pisarlas); si también querés que el sorteo pueda asignar libremente encima de ellas, decímelo aparte.

## Aplicadas (tanda 9)

13. **Resetear sorteo: se manda en tandas chicas.** Con alcance "Todo el sorteo" (100+ categorías), antes se mandaba un solo pedido con todos los ids juntos -- se cambió a tandas de a 40/200 para no arriesgar el límite de largo de URL de Supabase. Mismo comportamiento, más robusto para alcances grandes.

## Aplicadas (tanda 10)

14. **Sorteo persona contra persona** (Ajedrez, Tenis Singles, Tenis de Mesa Singles -- 9 categorías en el CSV real). Antes, cualquier categoría sin equipos/parejas cargados daba "Menos de 2 equipos inscriptos" aunque hubiera gente anotada, porque el motor solo sabía sortear equipo vs equipo. Ahora, si una categoría no tiene ningún equipo cargado pero sí tiene personas inscriptas individualmente, arma la llave/grupos directamente con esas personas ("Juan Pérez (Necochea)" en vez de "Necochea"), con las mismas opciones de modalidad (llave directa/grupos/grupos+playoff) que ya se configuran hoy. El detector de conflictos también reconoce estos partidos por persona real (si alguien juega Ajedrez y además juega en un equipo a la misma hora, se detecta igual que antes). Las restricciones horarias de "toda la departamental" también aplican, porque `baseDept` ahora sabe extraer la departamental de una etiqueta de persona.
15. **Golf pasa a la lista de disciplinas individuales que no se sortean** (como Natación o Tiro): ocupa el horario de quien esté anotado, para el chequeo de conflictos, pero no arma partidos ni llave -- se juega por puntaje. Necesita tener sus sedes/horarios cargados en "Disciplinas y sedes" para aparecer en el Fixture.

## Aplicadas (tanda 11)

16. **Fix: las pantallas de vista previa/revisión no se habían enterado del sorteo por persona.** La tanda anterior arregló el MOTOR de sorteo, pero tres pantallas seguían mostrando "0 equipos" para Ajedrez y compañía porque contaban solo `team_entries`, sin el fallback a personas sueltas:
    - "Revisar y sortear todo lo pendiente" (`/api/sorteo-global`): ahora cuenta personas inscriptas cuando la categoría no tiene equipos, así deja de aparecer en rojo.
    - Pantalla **Sorteo**: el conteo y el botón "Sortear" ahora también consideran las personas sueltas.
    - Pantalla **Antecedentes** (orden de cabezas de serie): ahora también se pueden ordenar las personas de estas categorías, no solo equipos.
    No hacía falta recargar el CSV -- los datos ya estaban bien, era una cuenta que faltaba actualizar en estas 3 pantallas.

## Aplicadas (tanda 12)

17. **Conflictos uno por uno en la pantalla de Sorteo.** Al apretar "Sortear"/"Volver a sortear" o "Generar llave de playoff", si el sorteo dejó superposiciones horarias o restricciones sin respetar, aparece una tarjeta roja debajo del botón con el detalle de cada una (quién, en qué partidos, qué día y hora) -- ya no hace falta ir a "Fixture y conflictos" a buscarlas. Se limpia al cambiar de categoría.

## Aplicadas (tanda 13)

18. **Nombre de archivo al exportar el póster a PDF.** El botón "Descargar SVG" ya guardaba con el nombre de disciplina y categoría; "Imprimir / exportar PDF" no, porque el navegador usa el título de la pestaña como nombre sugerido, y era siempre el mismo genérico. Ahora, al abrir el póster de una categoría, el título de la pestaña pasa a ser "Disciplina — Categoría" (y en el póster por día, "Cronograma — Día"), así el PDF ya se guarda con ese nombre por defecto, sin tener que renombrarlo a mano.

## Aplicadas (tanda 14)

19. **Casilleros sin definir en las llaves quedan en blanco, no "A definir".** En el dibujo de la llave (usado en el póster de cada categoría), un casillero sin equipo asignado todavía ya no imprime el texto "A definir" -- queda en blanco, para completar el nombre del ganador a mano en el póster impreso. El BYE sigue mostrando "BYE (pasa directo)", porque ahí no hay nada que completar. No toqué la tabla de Fixture ni el Excel exportado, que siguen mostrando "A definir vs A definir" (ahí es información de pantalla, no algo para escribir a mano).

## Aplicadas (tanda 15)

20. **Evitar que dos equipos (o personas) de la misma departamental se crucen en primera ronda de una llave**, cuando sea posible. Aplica a "Llave directa" y a la llave de playoff de "Grupos + playoff" (ambas usan el mismo armado de llave). Es un "si es posible": si sortea un intercambio que separa a los dos sin generar un cruce nuevo en otro lado, lo hace; si es matemáticamente inevitable (ej. más de la mitad de los anotados son de la misma departamental), deja el mínimo posible de cruces sin tocar nada más. No aplica a la fase de grupos (round robin), donde no hay "primera ronda" en el mismo sentido.
    - Probado: cruce forzado se resuelve a 0; con 4 de 8 del mismo departamento (evitable) da 0; con 5 de 8 (matemáticamente inevitable) da exactamente 1, el mínimo teórico; con 32 equipos resuelve en 1ms sin choques; funciona igual con nombres de persona (Ajedrez, Tenis Singles).

## Aplicadas (tanda 16)

21. **En las llaves de Ajedrez, Tenis Singles y Tenis de Mesa Singles, el casillero muestra la departamental (no el nombre de la persona), con una línea punteada debajo para completar el nombre a mano.** Si dos personas de la misma departamental están anotadas en la misma categoría, los dos casilleros dicen lo mismo ("Necochea"), sin numerar -- se distinguen recién al completar el nombre. El recuadro de la llave se agranda un poco para estas categorías, para que entre la línea de abajo. El BYE sigue mostrando "BYE (pasa directo)" sin tocar. Las llaves de equipo (Vóley, Básquet, etc.) no cambian en nada.

## Aplicadas (tanda 17)

22. **Cancha y horario ocultos en el póster de cada categoría (PDF y SVG), por ahora.** Ni la llave ni la tabla de grupos muestran día/hora/cancha mientras esos datos todavía no están confirmados. Es una bandera (`SHOW_SCHEDULE_IN_POSTER` en `lib/bracketLayout.js`) que se puede volver a activar apenas estén listos, sin tener que rehacer nada. No toqué el póster por día (el de "Cronograma"), porque ese documento es justamente el horario -- ocultarlo ahí lo dejaría vacío.

## Aplicadas (tanda 18)

23. **Fix: la primera ronda de la llave quedaba fuera de la hoja cuando había muchos equipos.** El póster tenía un ancho fijo (1400px); con muchas rondas (16+ equipos) la llave necesitaba más ancho que eso, y al centrarla la ronda 1 quedaba en una posición negativa -- literalmente fuera del dibujo, ilegible (afectaba tanto al PDF como al SVG, y también se veía así en pantalla). Ahora el ancho del póster crece para siempre poder contener la llave completa. Para categorías chicas (hasta 16 equipos aprox.) el póster queda exactamente igual que antes.
    - Probado con 8/16/32/64 equipos: antes, 32 equipos ya rompía (ronda 1 en x=-50); ahora entra siempre con margen (x=80 con 32 equipos, x=80 con 64), y 8/16 equipos no cambian ni un píxel.

## Notas / limitaciones conocidas

- Las restricciones **individuales por persona** se guardan bien, pero todavía **no se aplican solas** al sortear ni al autoresolver (solo las de departamental y equipo). Pendiente de decidir si se construye.
- Las restricciones de **equipo** ahora se eligen por equipo Y categoría (el desplegable agrupa por categoría) y valen solo para esa categoría. Se guardan como `Nombre::idCategoria` en `team_label`. Las que se cargaron antes (solo nombre) siguen valiendo para ese nombre en cualquier categoría.
- El botón manual **"Reprogramar este partido"** no valida el orden de las rondas: quien reprograma a mano decide el horario.
