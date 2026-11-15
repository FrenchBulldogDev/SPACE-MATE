# Moon Mission Browser

Interfaz web adaptativa en React, TypeScript y Three.js. Incluye portada con fotos del equipo, fondo y logo de `Assets`, un explorador 3D con los modelos y texturas locales, y un quiz opcional durante el cálculo de aterrizajes.

## Ejecutar

```sh
npm install
npm run dev
```

Abrir `http://127.0.0.1:5173`. `Start` abre el explorador. El middleware de Vite incluye las APIs de efemérides, orientación lunar y candidatos de aterrizaje. Se necesita acceso saliente HTTPS a NASA/JPL y Moon Trek, y permiso de escritura en `data/horizons/`, `data/landing/` y `data/terrain/`.

```sh
npm run build
npm run preview
npm test
```

Para servir la compilación y la API en producción con Node 22+:

```sh
npm run build
npm start
```

Escucha en `http://127.0.0.1:4173` (`HOST` y `PORT` configurables). El runtime `tsx` debe estar instalado. El hosting exclusivamente estático ya no basta: hay que ejecutar este servidor o proporcionar las rutas equivalentes `/api/ephemeris`, `/api/ephemeris/latest`, `/api/lunar-frames` y `/api/landing-analysis` del mismo origen. No se expone un proxy abierto ni se necesitan claves API.

## Interacciones

El modo antes llamado «Escala física» ahora se llama **Público especializado**, conservando esa escala. Las nuevas **capas de superficie lunar** permiten comparar potencial solar calculado con JPL/LOLA y madurez óptica real Kaguya MI. Las capas de degradación del equipo y polvo sólo se habilitan en Público especializado al importar mediciones y calibraciones con procedencia. Consulta [modelos, fuentes, límites y formato de datos](SCIENCE_LAYERS.md). Las funciones anteriores del público general se conservan.

El panel de capas del visor se puede minimizar hasta mostrar sólo su icono; conserva la selección, los datos y el mapa activo. **Spacey**, basado en `EXAMPLE.html` y con la imagen `Assets/Spacy_WOBack.png`, sustituye el antiguo botón `?`. Ofrece preguntas sugeridas y búsqueda local por palabras clave sobre el uso, colores, modo especializado, JSON y navegación. Sus controles, preguntas y respuestas están traducidos a los cinco idiomas. La conversación se conserva al cerrar y reabrir durante la sesión del explorador, sin enviarse ni guardarse; no utiliza un servicio de IA. Al abrir Spacey se minimizan las capas y al desplegar las capas se cierra Spacey para evitar que los paneles se superpongan.

El lema de la portada y la descripción del documento son **ad astra per aspera**, fijos en latín en todos los idiomas.

- Arrastrar sobre un astro o el espacio: orbita únicamente la cámara. No se puede modificar manualmente la orientación de los cuerpos.
- Rueda: zoom al cuerpo debajo del cursor. En espacio vacío tiene prioridad el cuerpo más cercano a la cámara.
- Dos dedos: zoom. Botón derecho: desplazar cámara.
- Seleccionar sitio: marca la textura utilizando `Scripts/coordinates.ts`, coloca un pin y acerca la cámara al sitio sin modificar ni detener la rotación terrestre.
- Coordenadas personalizadas: grados decimales o formato DMS compatible con el parser existente.
- Centrar Tierra, Luna o sistema; pausar, cambiar velocidad y alternar la órbita.
- Con el canvas enfocado: `+`/`-` para zoom y `Home` para vista general.
- Velocidad `1×`: un segundo simulado por segundo real; `0,25×` y `3×` multiplican por igual todos los movimientos.
- Modo público general por defecto: la distancia media Tierra–Luna vuelve a ser 8,8 unidades visuales. Escala física: 3.185,5 km por unidad, para tamaños y distancias. Cambiar de modo conserva el instante; los cálculos no dependen de la compresión.
- Aceleraciones de `60×`, `3.600×` y `86.400×` permiten recorrer las efemérides. La reproducción se detiene al final del intervalo; no extrapola ni repite una órbita artificial.
- Seleccionar un sitio calcula todos los mínimos locales de distancia. «Ver este instante» sitúa y pausa el visor en un resultado. Los datos diarios y los cálculos pueden descargarse como JSON.
- La **fecha estimada de aterrizaje** se elige con tres listas: año, mes y día (UTC; febrero de 1962 a diciembre de 2100). Año y mes permanecen disponibles durante la carga. Cambiarlos limpia fecha, marcador, resultados y solicitudes anteriores; se calcula únicamente el período elegido. Los días sin candidatos aceptados, incluidos los huecos entre días disponibles, quedan deshabilitados. Un mes terminado sin candidatos indica explícitamente que no hay ventanas estimadas disponibles. Los fallos de adquisición se muestran como errores.

## Banderas de alunizajes históricos

Los ocho sitios del catálogo histórico se marcan en la Luna con `Assets/Flag.PNG`, ancladas a sus coordenadas y ocultas cuando quedan detrás de la superficie. Se muestran al acercarse a la Luna. El selector **Sitios de alunizaje históricos** permite acceder también a lugares fuera de la vista; **Ver banderas en la Luna** centra la cámara.

Al pulsar una bandera se pausa la reproducción, se centra el sitio y se abre su ficha en **Configuración actual**. `/api/historical-site` utiliza las efemérides del período elegido y el DEM LOLA para calcular visibilidad terrestre, iluminación solar, elevaciones y distancia al centro de la Tierra en ese punto exacto, aunque no sea un candidato aceptado. El instante evaluado aparece explícitamente; **Actualizar al instante del visor** permite actualizarlo si se reanuda la animación. Las llegadas estimadas se toman únicamente de candidatos en las mismas coordenadas y respetan el filtro de día y el sitio de lanzamiento actual.

El switch **Ver datos históricos** muestra la misión, país, fecha y hora UTC del alunizaje y del lanzamiento, duración real del vuelo y fuentes del catálogo, conservando la configuración del explorador. La ficha y los controles están traducidos a los cinco idiomas, admiten teclado y se adaptan a pantallas pequeñas. La visibilidad sin cobertura suficiente se conserva como desconocida.

## Variables para editar

- `src/config.ts`: radios y velocidades en SI, conversión uniforme a unidades del visor, inclinaciones y catálogo inicial de sitios.
- `src/App.tsx`: estructura de las páginas, portada y explorador.
- `src/i18n/translations.ts` y `src/science/messages.ts`: textos en los cinco idiomas.
- `Assets/Fondo.jpeg`: imagen del fondo de Inicio; `HOME_EARTH_IMAGE` en `src/config.ts` la incorpora a la compilación.
- `src/team.ts`: fotos de los seis perfiles; `Assets/Space Mate.svg`: logo de la portada y el encabezado.
- `src/scene/referenceFrame.ts`: único cambio de ejes entre ICRF y Three.js, orientación terrestre y lunar, y compresión visual.
- `src/science/`: interpolación, marcos terrestres, búsqueda de mínimos y panel de resultados.
- `server/horizons.ts`: consulta, validación y almacenamiento persistente de efemérides.
- `src/scene/assets.ts`: carga, aislamiento y UV de assets.

Los assets están excluidos de Git por la configuración original. Deben permanecer en `Assets` con sus nombres actuales al compilar; Vite los empaqueta en la compilación.

## Quiz durante los cálculos

Mientras se calculan los posibles sitios de aterrizaje, el explorador ofrece **Hacer el quiz**. Incluye las 23 preguntas de `Assets/txt/txt/` con su ilustración del mismo número en `Assets/quiz fotos 23/quiz fotos 23/`; la opción con asterisco define la respuesta correcta. Muestra corrección inmediata, puntuación y reinicio, sin detener el cálculo. Se puede cerrar y reabrir conservando el avance durante la sesión del explorador y terminarlo aunque el análisis ya esté listo.

Las preguntas se conservan en español; los controles están traducidos a los cinco idiomas. El contenido del quiz se carga al abrirlo y las imágenes al mostrar cada pregunta. Las respuestas y la puntuación no se guardan en almacenamiento persistente.

## Idiomas de la interfaz

El selector del encabezado ofrece Español, Francés, Portugués, Italiano e Inglés, con los nombres de cada idioma en su propia lengua. La preferencia se guarda únicamente después de una selección explícita en `localStorage`, con la clave `moon-mission.language`, sin identificadores de usuario. Tiene una vigencia de 180 días; si caduca, se elimina en la siguiente visita. El panel «Privacidad y almacenamiento» permite borrarla conservando el idioma de la sesión actual. Si el almacenamiento no está disponible, la selección sigue funcionando durante la sesión. Cambiar de idioma no reinicia la escena ni borra la configuración de la misión.

## Privacidad y publicación

La fuente Public Sans se aloja en `public/fonts/`, junto con su licencia SIL OFL. No se utiliza Google Fonts desde el navegador. No se añade analítica, publicidad ni cookies. El navegador envía las coordenadas y la altura seleccionadas a la API del mismo origen para calcular aterrizajes; el servidor las utiliza temporalmente y no las envía a NASA/JPL. Los informes persistentes no incluyen esas coordenadas terrestres en texto; su identificador incorpora un hash de los parámetros. Sí se guardan efemérides públicas, relieve lunar, respuestas originales y resultados en `data/horizons/`, `data/terrain/` y `data/landing/`. Las descargas solicitadas por el usuario pueden incluir su sitio y altura. El hosting debe minimizar y revisar sus registros de peticiones, cuyas URL pueden contener las coordenadas.

`config/securityHeaders.ts` aplica CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options y Permissions-Policy en Vite y en la vista previa. `public/_headers` contiene la política para proveedores compatibles; otros servidores necesitan configurar las mismas cabeceras. El servidor de desarrollo conserva las excepciones locales necesarias para HMR. No debe publicarse el servidor Vite de desarrollo.

El hosting definitivo requiere HTTPS, revisión de sus logs, cookies e integraciones, identificación del responsable y política de privacidad adaptada a su estado de EE. UU. y a sus públicos internacionales. La revisión técnica no constituye certificación legal ni conformidad completa WCAG. Consulta `PRIVACY_REVIEW.md`.

## Alcance científico

La integración sigue la API enlazada en `LOOKUP.md`: [NASA/JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html). La Luna es `301`; el observador es **`500@399`, centro de la Tierra**, no el baricentro Tierra–Luna (`3`). Se solicitan estados geométricos, sin correcciones de propagación de luz ni aberración, en ICRF ecuatorial (`REF_PLANE=FRAME`), con tiempo UT —UTC en el rango admitido— y salida km/s. Se convierten a metros y m/s una sola vez. Las esféricas se derivan de esos mismos vectores: radio, ascensión recta y declinación geométricas; no se mezclan con coordenadas aparentes.

El explorador carga el **mes civil elegido**, con estados cada 300 segundos y diez días previos para incluir los vuelos que llegan a principios de mes. Ese margen se comprueba contra la velocidad efectiva mediana histórica y una separación conservadora de 510 millones de metros. Sólo se aceptan llegadas desde el primer día del mes hasta el inicio del siguiente, excluido. El número de muestras y marcadores diarios se muestra dinámicamente. «Actualizar datos NASA/JPL» vuelve a consultar el intervalo elegido. La API y las herramientas originales de series de 28 días siguen disponibles. La trayectoria dibujada conserva las posiciones JPL y no fuerza una elipse repetida.

**Vínculo de ejes:** se consultan también los estados ICRF de dos puntos de la superficie terrestre (Greenwich ecuatorial y polo norte), con el mismo observador geocéntrico y los mismos tiempos. Sus vectores proporcionan una base terrestre ortonormal y su derivada. Esto incorpora la orientación terrestre de JPL y sus EOP en lugar de inventar un ángulo inicial o usar una rotación sidérea aislada. La posición WGS84 del sitio se transforma con esa base. El visor utiliza la misma orientación y el mismo cambio de ejes, `ICRF (X,Y,Z) → Three.js (X,Z,−Y)`, para Tierra y Luna. La Tierra está en `(0,0,0)` porque el marco es geocéntrico; su movimiento heliocéntrico común se cancela en esta descripción relativa. La orientación lunar procede de los estados JPL de su meridiano 0° y polo norte en el marco ME: mantiene la cara próxima hacia la Tierra e incorpora la libración.

La esfera visual terrestre conserva su radio medio de 6.371 km; el cálculo del sitio utiliza el elipsoide WGS84, no esa esfera de dibujo. La Luna se modela como esfera de radio medio 1.737,4 km. No hay un modelo de relieve lunar. Las velocidades ahora proceden de las efemérides y varían con el tiempo: las constantes y utilidades circulares de la primera etapa permanecen como referencia/pruebas, sin intervenir en la escena ni en los resultados actuales.

Para un sitio con latitud geodésica φ, longitud este λ y altura elipsoidal h:

1. Se calcula su posición ECEF WGS84 con achatamiento y altura; se transforma a ICRF con la base de JPL y se obtiene también su velocidad.
2. En cada intervalo se construye un polinomio cúbico de Hermite de la posición relativa Luna–sitio, usando posiciones **y velocidades** de ambos extremos.
3. Se minimiza `ρ(t) = ||r_Luna(t) − r_sitio(t)|| − R_Luna`. Se resuelven **todas las raíces reales** de `d(||r_rel||²)/dt = 2 r_rel·v_rel` en cada intervalo. Este polinomio de quinto grado se divide recursivamente por sus puntos críticos; se incluyen raíces tangentes y se clasifican los mínimos por curvatura/signo. No se busca solamente el día más cercano ni se congela la rotación terrestre.
4. Se conservan todos los mínimos interiores y se comparan ambos extremos temporales para hallar el mínimo absoluto. Si este cae en un extremo, se etiqueta como límite del intervalo, no como mínimo local.
5. Se calcula la elevación geométrica respecto a la normal geodésica del sitio y se informa si el centro lunar está sobre el horizonte. Los resultados bajo el horizonte se muestran, no se ocultan. La tolerancia de raíces de 0,01 s es numérica, no una promesa de exactitud física.

Estos son **instantes de mínima distancia geométrica**, no ventanas operativas garantizadas para un cohete. Minimizar la distancia instantánea no resuelve el problema de llegada a una Luna que seguirá moviéndose: faltan tiempo de vuelo, energía, transferencia, azimut, plano orbital, vehículo y restricciones del rango. No se han supuesto esos parámetros ausentes. La precisión física queda limitada por los EOP (predichos en fechas futuras), las coordenadas del sitio y el modelo de superficie. La altura inicial de catálogo es 0 m WGS84; algunos centros tienen un punto de referencia aproximado, indicado en la interfaz y enlazado a su fuente.

El catálogo incluye Kennedy LC‑39A/39B, Cape Canaveral SLC‑40, Vandenberg SLC‑4E, Starbase, Wallops, Baikonur, Plesetsk y Vostochny; no representa actividad ni programación diaria. Los datos de centros y plataformas provienen de NASA, SpaceX, FAA, ESA, Virginia Space y Launch Library 2; cada entrada conserva su fuente.

## Persistencia y comprobación científica

```sh
npm run cache:ephemeris
npm run cache:ephemeris -- 2026-11-14T18:34:00Z
npm run verify:science
npm run verify:science -- --online
```

`data/horizons/<id>.json` guarda metadatos, consultas, marco, unidades, coordenadas esféricas, estados densos y puntos diarios. Tres archivos TXT preservan las respuestas originales. Un fallo de red o validación no se sustituye por una órbita sintética. La caché existente se reutiliza para ese intervalo y hay un control explícito para actualizarla.

`verify:science` comprueba todos los centros y compara la interpolación de 5 minutos con otra de 10 minutos. `--online` contrasta el primer mínimo, el absoluto y el último de LC‑39A con vectores topocéntricos consultados directamente a Horizons. Los resultados y la respuesta de contraste se guardan junto al dataset. El verificador acepta un ID de dataset como argumento. Las pruebas habituales no requieren red y contienen una pequeña muestra auténtica de JPL, casos analíticos y validaciones de integridad.

El STL lunar suministrado contiene dos objetos separados. El cargador filtra el componente lejano en memoria, manteniendo intactos los archivos originales. Como STL no incluye UV, el cargador genera UV esféricos (Greenwich/lunar 0° en el centro de las texturas), corrige la costura y el caso degenerado de los polos. `Assets/Moon Texture.provenance.json` registra la fuente NASA SVS 4720 y el SHA-256: la textura local es idéntica byte por byte a la versión LROC oficial, con norte arriba y longitudes este hacia la derecha. No se usa la imagen de color para inferir alturas.

## Aterrizajes estimados y zonas ciegas

`src/science/flightHistory.ts` reúne Apollo 11/17, Luna 9/13, IM-1, Chandrayaan-3, SLIM y Blue Ghost 1, sin misiones chinas. Se distinguen referencias de transferencia rápida y baja energía: no se mezclan vuelos de varios meses con el perfil rápido. El perfil actual usa las cinco referencias rápidas; los otros vuelos se conservan con su categoría y fuentes. Las coordenadas Apollo proceden del catálogo NASA ME/PA DE421; las de otras misiones tienen la precisión indicada por sus fuentes y algunas son aproximadas o del área objetivo.

Se consultan las posiciones JPL históricas en las fechas de salida y llegada, la orientación terrestre y la orientación lunar. Se forma una separación geométrica de referencia usando ambas coordenadas de superficie en un marco geocéntrico comóvil, y una velocidad efectiva `separación / tiempo total histórico`. Para cada nuevo punto se itera la llegada usando la mediana de los tiempos reescalados a su separación 3D actual. El margen mostrado es la dispersión máxima de esas referencias, **no** un intervalo estadístico de confianza. Incluye los efectos históricos de estacionamiento, maniobras y espera sin intentar reconstruirlos. No es un cálculo de transferencia balística ni asegura que un vehículo pueda llegar ese día.

El backend ejecuta un barrido global de 10° (648 centros), añade ocho lugares históricos y refina cada candidato en cinco posiciones separadas 0,25°. Es una búsqueda de puntos a esa resolución, no una certificación continua de todas las superficies entre ellos. La API utilizada es el servicio numérico LOLA v06 `ImageServer/exportImage` de Moon Trek, identificado en la configuración pública del portal enlazado en `LOOKUP.md`; no se interpretan los píxeles de las teselas WMTS como elevaciones. Se descargan parches GeoTIFF F32 de 512×512 sobre 4°, con unos 237 m por píxel en dirección norte-sur. Se preservan TIFF y metadatos en `data/terrain/`, excluidos de Git por su volumen y conservados localmente.

Los rayos permanecen exclusivamente en el backend. Se construye una malla de elevaciones y un BVH; cada rayo Tierra/superficie o Sol/superficie se intersecta con los triángulos en 3D, con curvatura lunar. Las caras de cráter que obstruyen el enlace se excluyen para ese instante. Si un rayo abandona la cobertura antes de salir de la envolvente potencial de relieve, su resultado es **desconocido**, nunca despejado. El modelo también prueba la ocultación del Sol por la Tierra y el ángulo de incidencia sobre la normal local del terreno; exige más de 1° de elevación efectiva solar y usa altura de antena/panel de referencia de 2 m.

Las direcciones Tierra/Sol y el marco lunar ME se obtienen de JPL cada 30 minutos, con interpolación de posiciones y velocidades. En el explorador se cubre hasta un ciclo lunar completo después del final del mes elegido; las herramientas originales conservan su intervalo predeterminado de 56 días. Se usa la misma orientación lunar para el mapa, el marcador y el cálculo; incorpora la libración real y sustituye el anclaje idealizado sin libraciones de la primera etapa. Si no está disponible, el visor espera o informa del fallo en vez de colocar marcadores con un marco inventado.

## Cálculo mensual y reutilización eficiente

### Optimización sin cambiar el modelo

La malla global de 10°, el refinamiento de 0,25°, el DEM de 512×512, los pasos de 5/30 minutos, las efemérides JPL, el ciclo lunar y el requisito de más de 24,5 horas conjuntas se conservan.

- La malla 3D usa buffers numéricos preasignados y calcula la trigonometría una vez por fila y columna. Conserva exactamente los vértices Float32 y todos los triángulos originales.
- Se construye una sola estructura de conectividad por tamaño de rejilla (caché acotada a dos tamaños). Cada parche recibe índices y límites independientes, que se ajustan íntegramente a sus alturas reales mediante [`MeshBVH.refit`](https://github.com/gkjohnson/three-mesh-bvh/blob/master/API.md#refit-1). No se reutilizan alturas ni obstrucciones entre lugares.
- Las muestras de visibilidad se evalúan a demanda. Si una llegada ya incumple el intervalo conjunto inicial, se descarta sin trazar el resto del ciclo. Los candidatos que superan ese filtro se comprueban con los mismos rayos y cobertura completa.
- Los porcentajes y continuidades se obtienen con sumas acumuladas y el siguiente intervalo fallido, evitando recorrer repetidamente las mismas muestras. Los estados desconocidos siguen impidiendo aceptar una ventana.
- Los coeficientes de Hermite del entorno lunar se reutilizan. La búsqueda de mínimos omite sólo polinomios cuya cota matemática demuestra que no contienen raíces en el intervalo; los casos próximos al límite conservan el aislador completo.
- Antes de leer una serie antigua completa se consulta su cabecera; las series sin cobertura útil se omiten. Las solicitudes de progreso reutilizan la validación ya hecha de las series temporales internas. El visor pausado reutiliza la solución astronómica del mismo instante.

La comparación con datos reales de noviembre de 2026 conservó idénticas las 286 combinaciones del barrido reducido de 16 sectores, incluyendo todos los valores numéricos de cada candidato. Las pruebas adicionales contrastan la malla y los rayos con el algoritmo anterior, las continuidades con el recorrido completo y el aislamiento entre parches. Las mediciones se resumen en `artifacts/performance/summary.json`; no representan una garantía de tiempo para otros equipos o para la malla global.

Para capturar y comparar mediciones bajo demanda:

```sh
npm run analyze:landing -- --month=2026-11 --smoke --benchmark=referencia
npm run analyze:landing -- --month=2026-11 --smoke --benchmark=comparacion --compare=referencia
```

Estos comandos escriben perfiles y resultados de prueba únicamente cuando se solicita `--benchmark`; el explorador mantiene sus datos mensuales temporales.

Se aprovechan primero los estados JPL existentes que se solapen con el intervalo solicitado. Si la fase de las muestras antiguas difiere de la nueva, se interpola con Hermite **dentro de su cobertura**; se consultan a JPL sólo los tramos faltantes. No se avanza mes a mes para llegar a un año lejano. Las referencias históricas y el DEM lunar se reutilizan; la posición terrestre de cada oportunidad de salida se calcula una sola vez.

Conocer la forma de la órbita inicial ayuda a interpolar localmente y a reutilizar posiciones y velocidades. Repetir esa órbita en otros meses o años omitiría los cambios orbitales, de orientación terrestre/lunar y de iluminación. Por eso los tramos sin cobertura usan nuevas efemérides, sin extrapolar ni interpretar un fallo como una ventana viable. Referencia: [manual de NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html).

Los cálculos mensuales son temporales: las series, resultados, respuestas nuevas y estados auxiliares no se acumulan en archivos. Al cambiar de mes/año se cancelan consultas y barridos anteriores y se libera su memoria. Se conserva como máximo una serie anterior durante hasta 60 segundos para transferir datos solapados; se descarta al completar la siguiente carga. Las pestañas comparten un cálculo del mismo período y la cancelación de una no interrumpe a otra. Las sesiones abandonadas expiran. Los archivos originales de `data/horizons/`, los informes guardados previamente y el relieve reutilizable se conservan.

Para comprobar un mes con datos reales sin guardar un informe mensual intermedio:

```sh
npm run analyze:landing -- --month=2026-11 --smoke
```

`--smoke` reduce la malla únicamente para verificación; el explorador conserva el barrido global de 10°. Las ventanas mostradas siguen siendo estimaciones del modelo histórico y geométrico, no ventanas operativas certificadas para un vehículo.

Por llegada se consideran como máximo **27,321661 días**, un ciclo sidéreo medio. Si la comunicación se mantiene todo el ciclo se marca como despejada durante el ciclo y se detiene la evaluación; no se afirma visibilidad eterna. Se muestran continuidad inicial y porcentaje durante el ciclo para comunicación e iluminación por separado. Para aceptar un candidato se exige más de 24 horas conjuntas, incluyendo un margen conservador de un paso temporal (30 minutos). La incertidumbre temporal declarada es al menos ±30 minutos: puede haber interrupciones más cortas que el muestreo, relieve subpíxel y errores adicionales no acotados. La iluminación es una oportunidad de generación, no un presupuesto eléctrico: no se inventan baterías, eficiencia de paneles ni consumos. La visibilidad al centro terrestre no garantiza una estación concreta ni un presupuesto RF. No se implementan repetidores.

`npm run analyze:landing` ejecuta el barrido para Kennedy LC-39A y la serie más reciente. `--smoke` usa una malla reducida únicamente para comprobaciones. Los informes completos quedan en `data/landing/report-<id>.json`; las consultas JPL y respuestas originales se guardan junto a ellos. La interfaz inicia el trabajo para el sitio elegido, muestra progreso y sólo habilita días que tengan candidatos aceptados por el escenario estimado. La selección vuelve a validarse antes de mover el visor. Los sectores sin DEM utilizable se contabilizan por separado; los rayos de cobertura insuficiente no producen candidatos.
