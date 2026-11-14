# Memoria del proyecto para Codex

Última actualización: **14 de noviembre de 2026**, zona del usuario `America/Buenos_Aires`.

Este archivo reúne el estado acumulado del proyecto, los cambios realizados en las etapas trabajadas, las decisiones del usuario y las comprobaciones disponibles. Leerlo al retomar el trabajo junto con `README.md`, `LOOKUP.md` y el código relevante. Las fechas de los cálculos científicos se expresan en UTC.

## 1. Proyecto y contexto que se debe conservar

- Proyecto local: `Moon NASA Challenge`, presentado en la interfaz como **SPACE-MATE**.
- Aplicación en React 19, TypeScript, Vite y Three.js, con portada y explorador 3D.
- Rutas de interfaz: `#/` y `#/explorer`.
- Se utilizan los modelos STL y las texturas existentes en `Assets/`.
- La portada conserva el logo, las secciones del equipo y colaboradores, sus fotografías y los espacios provisionales que todavía existan. `src/team.ts` relaciona los assets con los perfiles.
- Hay cambios propios del usuario en assets y contenido. El estado de Git incluye modificaciones anteriores: no atribuir todo el diff a una sola sesión ni descartar cambios ajenos.
- El trabajo está en el workspace local; no se ha publicado el sitio ni se ha creado un commit para cerrar estas modificaciones.

## 2. Decisiones explícitas del usuario

1. Tierra y Luna deben compartir un sistema coherente de coordenadas, tanto en el visor como en los cálculos.
2. No se permite que el usuario rote manualmente los cuerpos sobre sus ejes; el arrastre mueve la cámara.
3. Debe existir un modo físico y un modo para público general con distancias visualmente más comprensibles.
4. El observador para obtener la trayectoria lunar debe ser el centro de la Tierra.
5. Se deben guardar los puntos de los 28 días siguientes y los datos usados para obtener la trayectoria.
6. Se incluyen centros de lanzamiento NASA, SpaceX y rusos habituales. Se excluyen los chinos.
7. El control de fecha debe seleccionar **aterrizaje**, no lanzamiento. Los días sin candidatos aceptados deben quedar bloqueados.
8. Los tiempos de vuelo se pueden aproximar con vuelos históricos de EE. UU., otras naciones y empresas, excluyendo China y considerando las coordenadas de salida y llegada.
9. La comunicación inicial es directa con la Tierra. Los repetidores quedan para una solicitud posterior.
10. Debe haber más de un día de comunicación y oportunidad de generación solar; mostrar duración o porcentaje y aclarar incertidumbre.
11. La simulación de rayos se ejecuta en el backend y no se dibuja para el usuario.
12. La evaluación debe detenerse al completar un ciclo de traslación lunar. Si todo ese ciclo queda despejado, indicar buena recepción geométrica durante el ciclo evaluado.
13. Para la cobertura espacial, el usuario eligió **barrido global aproximado y refinamiento de candidatos**. Esto no equivale a validar cada punto de la superficie lunar.

## 3. Evolución del modelo físico y del visor

### Primera etapa: escalas y movimiento de referencia

Se configuraron en `src/config.ts` las magnitudes SI solicitadas:

| Magnitud | Valor de referencia |
| --- | --- |
| Radio medio terrestre | 6.371.000 m |
| Radio medio lunar | 1.737.400 m |
| Distancia media Tierra–Luna | 384.400.000 m |
| Distancia Tierra–Sol de referencia | 149.597.870.700 m |
| Rotación terrestre | 7,2921 × 10⁻⁵ rad/s |
| Rotación lunar | 2,6617 × 10⁻⁶ rad/s |
| Traslación terrestre | 29.784,8 m/s |
| Traslación lunar | 1.022 m/s |

- La conversión física es `METERS_PER_SCENE_UNIT = 3.185.500`, por lo que el radio terrestre vale 2 unidades del visor.
- La órbita circular de muestra inicial utilizaba `r = v / ω` para compatibilizar la velocidad lunar con la rotación sincrónica solicitada.
- Se modeló la traslación terrestre respecto de una referencia solar y el transporte del sistema lunar con la Tierra.
- Las utilidades de esa etapa permanecen en `src/scene/math.ts` y sus pruebas como referencias históricas.

### Estado actual: movimiento obtenido de JPL

- La escena actual utiliza posiciones, velocidades y orientaciones de efemérides. Las constantes anteriores no fuerzan una velocidad uniforme sobre los resultados JPL.
- El sistema actual es geocéntrico: la Tierra ocupa `(0,0,0)` y el movimiento heliocéntrico común se cancela en esta descripción relativa.
- La órbita dibujada es el arco de posiciones consultado. No se fuerza a cerrar una elipse ni a repetir artificialmente los 28 días.
- El modo **Público general**, predeterminado, comprime la distancia media Tierra–Luna a 8,8 unidades visuales. El modo **Escala física** mantiene distancias y radios con la conversión uniforme.
- Cambiar de modo conserva el instante. La compresión visual nunca entra en los cálculos científicos.
- El usuario puede orbitar, desplazar y acercar la cámara, centrar Tierra/Luna/sistema y mostrar u ocultar la trayectoria.
- Hay pausa y velocidades `0,25×`, `1×`, `3×`, `60×`, `3.600×` y `86.400×`. Todos los movimientos usan el mismo tiempo simulado; la reproducción se detiene al final de la cobertura.
- Las coordenadas de lanzamiento admiten grados decimales o DMS mediante `Scripts/coordinates.ts`, además de altura elipsoidal.

## 4. Marcos de coordenadas y orientación

- Observador de la trayectoria lunar: **`500@399`**, centro terrestre; objetivo lunar: **`301`**. El baricentro Tierra–Luna (`3`) no sustituye ese observador.
- Estados geométricos en ICRF ecuatorial, `REF_PLANE=FRAME`, `VEC_CORR=NONE`, tiempo UT/UTC en el intervalo utilizado y unidades de salida `KM-S`.
- La conversión a metros y m/s se realiza una sola vez.
- Se consultan Greenwich ecuatorial y el polo norte terrestres para construir la base ortonormal terrestre y su derivada. Se transforma con ella la posición WGS84 del sitio y su velocidad.
- Para la orientación lunar se consultan meridiano 0° y polo norte lunares con observador `500@301`. La base lunar se utiliza tanto en el análisis como en la escena.
- Único cambio de ejes a Three.js: **`ICRF (X,Y,Z) → (X,Z,−Y)`**, centralizado en `src/scene/referenceFrame.ts`.
- Ejes locales del modelo/textura: `+X` longitud 0°, `+Y` norte y `−Z` longitud este.
- La orientación lunar actual incorpora libración JPL. Sustituye el anclaje idealizado inicial que mantenía exactamente `+X` apuntando al centro terrestre.
- Si falta la orientación lunar real, la interfaz espera o permite reintentar; no muestra el marcador con una orientación inventada.
- El cálculo de distancia mínima sigue utilizando el radio lunar medio. El análisis de visibilidad de aterrizajes utiliza el DEM. El relieve numérico no se aplica como deformación visible del STL.

## 5. Efemérides y aproximación de la trayectoria

Integración de NASA/JPL Horizons a partir de la documentación enlazada en `LOOKUP.md`:

- **8.065 estados** a intervalos de 300 segundos durante 28 días, incluidos ambos extremos.
- **29 puntos diarios**, con radio, ascensión recta y declinación calculados a partir de los mismos vectores geométricos.
- Interpolación cúbica de Hermite que usa posición y velocidad.
- Validación de marco, observador, unidades, fechas, continuidad y consistencia de las coordenadas esféricas.
- Se reutiliza una serie reciente que todavía cubra más de 27 días futuros. La actualización explícita obtiene una serie desde el minuto actual.
- La fecha de aterrizaje no cambia el inicio del dataset.
- Un fallo de red o de validación produce un error visible; no se sustituye por una órbita sintética.
- Las consultas auxiliares JPL comparten una cola y una caché persistente.

Persistencia principal: `data/horizons/<id>.json` y respuestas originales TXT. El JSON conserva metadatos, consultas, estados densos, coordenadas esféricas y muestras diarias.

## 6. Catálogo de centros de lanzamiento

Se incorporaron nueve entradas con coordenadas geodésicas públicas y enlaces de procedencia en `src/config.ts`:

- NASA / SpaceX: Kennedy LC-39A.
- NASA: Kennedy LC-39B.
- SpaceX: Cape Canaveral SLC-40, Vandenberg SLC-4E y Starbase/Boca Chica.
- NASA: Wallops / MARS.
- Roscosmos/Rusia: Baikonur, Plesetsk y Vostochny 1S.

Algunos registros son referencias aproximadas del centro espacial, no levantamientos precisos de una plataforma. Cuando se desconoce la altura elipsoidal se usa `h=0` WGS84 y se explica esa limitación. El catálogo no representa disponibilidad ni programación diaria de lanzamientos.

## 7. Búsqueda de mínimos geométricos de distancia

Implementación en `src/science/windows.ts`, con ejecución local mediante Web Worker y resultados en `OrbitAnalysisPanel.tsx`:

1. Se calcula el sitio con el elipsoide WGS84, su altura y la orientación terrestre JPL.
2. Para cada intervalo se interpola el vector relativo Luna–sitio con Hermite cúbico.
3. Se minimiza `ρ(t) = ||r_Luna(t) − r_sitio(t)|| − R_Luna`.
4. Se buscan todas las raíces reales del polinomio de quinto grado `2 r_rel · v_rel`, incluidas raíces tangentes, mediante subdivisión por puntos críticos y refinamiento.
5. Se clasifican los mínimos por curvatura/signo y se comparan los extremos del intervalo para el mínimo absoluto.
6. Se calcula elevación sobre la normal geodésica; se distingue un mínimo interior de un límite temporal y se informa si está bajo el horizonte.

La tolerancia numérica de raíces de 0,01 s no representa precisión física. Estos mínimos son oportunidades geométricas, no una solución de transferencia para un vehículo. El análisis de aterrizajes utiliza los mínimos cuyo centro lunar está sobre el horizonte.

## 8. Estimación histórica de los vuelos

`src/science/flightHistory.ts` conserva ocho vuelos, fechas UTC, coordenadas terrestres/lunares y fuentes:

| Perfil | Referencias |
| --- | --- |
| Directo, usado por el estimador actual | Apollo 11, Apollo 17, Luna 9, Luna 13, IM-1 Odysseus |
| Baja energía, conservado por separado | Chandrayaan-3, SLIM, Blue Ghost 1 |

- No se incluyen misiones chinas.
- No se mezclan vuelos de varios meses con las cinco referencias del perfil directo.
- Se consultan estados JPL históricos en las fechas de lanzamiento y aterrizaje, incluidas las orientaciones de ambos cuerpos.
- Se construye una separación geométrica en un marco geocéntrico comóvil que considera las coordenadas de ambas superficies.
- Para cada referencia se relaciona esa separación con el tiempo histórico total de lanzamiento a aterrizaje.
- Para cada candidato se itera el instante de llegada usando la posición lunar prevista y la mediana de los tiempos históricos reescalados por separación.
- El margen mostrado es la máxima dispersión respecto de esa mediana. No es un intervalo estadístico de confianza.
- Los tiempos históricos incluyen estacionamiento, espera, maniobras y descenso sin reconstruirlos individualmente. Algunas coordenadas tienen precisión aproximada o corresponden al área objetivo según su fuente.

El resultado sigue siendo empírico: requiere validación de trayectoria, energía, vehículo y operaciones para convertirse en una ventana operativa.

## 9. Textura y geometría lunar

- El STL lunar original contiene dos componentes separados; el cargador aísla el cuerpo principal en memoria y conserva el archivo original.
- Se generan UV esféricos porque STL no incluye coordenadas de textura. Se corrigieron la costura longitudinal y la degeneración en triángulos polares.
- Convención de textura: longitud 0° en el centro, norte arriba, longitudes este hacia la derecha.
- Se configuró explícitamente el sentido vertical de la textura y el tratamiento de los bordes.
- La imagen local `Assets/Moon Texture.jpg` se comparó con la imagen oficial NASA SVS/LROC de 2048×1024 y resultó idéntica byte por byte.
- Procedencia y convención registradas en `Assets/Moon Texture.provenance.json`.
- SHA-256: `f7130a1822681fa7512d7dcfd40db8c10b9ba4f06777910348698260ed7a2170`.
- Fuente: <https://svs.gsfc.nasa.gov/4720/>.
- La textura de color nunca se interpreta como un mapa de alturas ni como una máscara de obstrucción.

## 10. Relieve Moon Trek, barrido y rayos del backend

Se integró el servicio numérico identificado en la configuración pública del portal Moon Trek enlazado en `LOOKUP.md`:

```text
https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer
```

- Se utiliza `exportImage` con `f=image`, GeoTIFF F32 de una banda y función de raster `None`; no se obtienen alturas de imágenes WMTS coloreadas.
- La descarga directa evita el enlace interno de salida que devuelve la variante JSON del servicio y que no es accesible por el proxy público.
- Parches de 4° × 4°, 512 × 512 píxeles: unos **237 m** por píxel norte–sur, frente al DEM nativo de 256 píxeles por grado.
- Se validan registro geográfico, dimensiones, formato numérico y alturas. Datos inválidos o ausentes excluyen el sector de la aceptación.
- El barrido predeterminado contiene 648 centros globales separados 10° y ocho sitios históricos: **656 sectores de búsqueda**.
- Se aplica un filtro geométrico inicial y, en los sectores candidatos, se evalúan el centro y cuatro puntos desplazados ±0,25° en latitud o longitud.
- Cada parche genera una malla curva lunar y un BVH mediante `three-mesh-bvh`. Se usa un origen local para conservar precisión de las coordenadas Float32.
- Los rayos hacia Tierra y Sol se intersectan con los triángulos del terreno. Se consideran normales locales e incidencia solar.
- Se usa una altura de referencia de 2 m para antena/panel y un umbral solar de más de 1° sobre la normal local.
- También se comprueba la ocultación del Sol por el disco terrestre.
- Esferas conservadoras interior/exterior de radio lunar ±20 km delimitan el volumen que puede obstruir un rayo.
- Si un rayo sale de la cobertura antes de abandonar ese volumen, el resultado es **desconocido**, no despejado. Los sectores de cráter que obstruyen una oportunidad de enlace no se aceptan para ese intervalo.
- Los rayos y la malla de análisis permanecen en el servidor, sin visualización de rayos en la escena.
- Dependencias añadidas: `geotiff` y `three-mesh-bvh`; se actualizó `package-lock.json`.

## 11. Comunicaciones, iluminación y aceptación

- Se obtienen posiciones de Tierra/Sol y orientación lunar durante **56 días**, a intervalos de **30 minutos**, para cubrir un ciclo posterior incluso a las llegadas del final del dataset principal.
- Se mantienen estados de comunicación e iluminación independientes; una falta de cobertura solar no altera las estadísticas de comunicación.
- Un intervalo se cuenta como despejado sólo si ambos extremos del muestreo están despejados y verificados.
- Se calcula continuidad desde el aterrizaje, porcentaje disponible y duración evaluada por separado para comunicación e iluminación.
- Se acepta un candidato si la continuidad conjunta supera **24,5 horas**, agregando un paso de margen al requisito de más de un día.
- La evaluación se limita a **27,321661 días**, un ciclo sidéreo medio. `fullCycleClear` indica que todo ese ciclo resultó despejado; no implica recepción indefinida.
- La incertidumbre temporal declarada es al menos ±30 min. Interrupciones más breves, relieve no resuelto y los presupuestos de enlace/potencia añaden errores que ese número no acota.
- La visibilidad directa al centro terrestre no valida una estación terrestre específica, su programación ni el presupuesto RF.
- La iluminación solar permite estimar una oportunidad de generación. Todavía no se calculan eficiencia del panel, potencia, consumo ni baterías.
- El contador `unverified` del informe representa sectores sin DEM utilizable; no cuenta todos los rayos con cobertura incompleta. La interfaz lo etiqueta conforme a esa definición.

## 12. Calendario y resultados en la interfaz

- Se sustituyó el control anterior por `landing-date`, con la etiqueta **Fecha de aterrizaje (estimada)**.
- Todo el selector permanece deshabilitado mientras falten resultados o la orientación lunar necesaria.
- Cada día UTC sin candidatos se deshabilita individualmente, incluidos los huecos entre días aceptados.
- `candidateForArrivalDay` también valida la selección antes de aplicarla; no basta con los atributos HTML.
- Cambiar el informe/sitio limpia la fecha y el marcador anteriores.
- Elegir una fecha o un candidato fija el instante de llegada, pausa la reproducción, coloca el marcador lunar y centra la cámara.
- `LandingPanel.tsx` muestra progreso, cobertura, combinaciones aceptadas, coordenadas, instante, vuelo con margen histórico y estadísticas de comunicación/iluminación.
- Se muestran hasta 60 resultados del día seleccionado; el JSON descargable conserva el informe completo.
- Los textos diferencian estimaciones de ventanas operativas y explican los límites de la cobertura.

## 13. Persistencia y cálculo completo conservado

| Ubicación | Contenido |
| --- | --- |
| `data/horizons/` | Efemérides geocéntricas, respuestas originales y verificaciones geométricas |
| `data/landing/jpl-<hash>.json` y `.txt` | Estados auxiliares de orientación, Tierra/Sol e historia de misiones, con respuestas originales |
| `data/landing/report-<id>.json` | Combinaciones de sitio/llegada, márgenes, estadísticas, resolución, fuentes y limitaciones |
| `data/landing/verification-<id>.json` | Resumen de verificaciones y días habilitados/bloqueados |
| `data/terrain/` | GeoTIFF originales y rejillas JSON de elevación |
| `artifacts/trek-research/` | Artefactos auxiliares de inspección del servicio y textura |

Los datos fueron guardados por solicitud del usuario. `data/terrain/` y `artifacts/` están excluidos de Git por su volumen; conservarlos localmente. No interpretar su exclusión como autorización para borrarlos.

### Informe global terminado para Kennedy LC-39A

- ID: **`fb8952d365a48f4007eb9087`**.
- Archivo completo: `data/landing/report-fb8952d365a48f4007eb9087.json`.
- Verificación: `data/landing/verification-fb8952d365a48f4007eb9087.json`.
- Intervalo de efemérides utilizado: **2026-11-14 19:39 UTC → 2026-12-12 19:39 UTC**.
- **656** sectores procesados.
- **752** sitios muestreados distintos aceptados.
- **5.759** combinaciones de punto y llegada aceptadas. No son 5.759 sitios diferentes.
- **5.422** combinaciones con comunicación geométrica despejada durante todo el ciclo evaluado.
- No hubo sectores con DEM inutilizable en esa ejecución; eso no significa que todos los rayos o zonas lunares hayan quedado verificados.
- Días de llegada habilitados: **19–24 y 26–30 de noviembre, y 1–3 de diciembre de 2026**, UTC.
- Días bloqueados dentro del dataset: **14–18 y 25 de noviembre, y 4–12 de diciembre de 2026**, UTC.

Estos resultados corresponden a Kennedy y a ese dataset concreto. No generalizarlos a otros centros, fechas o algoritmos.

Existe además un informe de prueba reducido, `report-5f9489cbe53ef4a0b4e4e503.json`, generado con `--smoke`. No usarlo como sustituto del barrido global ni como referencia científica principal.

Los identificadores de los informes dependen de parámetros del sitio/dataset y una versión de cálculo. Si cambia el algoritmo científico, actualizar la versión de caché y regenerar los resultados afectados sin confundirlos con informes anteriores.

## 14. Idiomas, privacidad y seguridad conservados

- Selector con español, francés, portugués, italiano e inglés. Español predeterminado; cambiar idioma conserva la configuración de misión.
- Preferencia en `localStorage`, clave `moon-mission.language`, sólo tras elección explícita, con vigencia de 180 días.
- Recuperación segura ante datos inválidos, caducados o almacenamiento bloqueado; borrado manual de la preferencia sin borrar otros datos del navegador.
- Panel nativo **Privacidad y almacenamiento**, traducido, con cierre por teclado y estado de la preferencia.
- Public Sans se sirve localmente con licencia SIL OFL. Imágenes, modelos y fuentes se sirven desde el mismo origen.
- No se añadieron analítica, publicidad, perfiles de usuario ni cookies de aplicación.
- Las coordenadas y altura del lanzamiento se envían al backend del mismo origen para calcular aterrizajes. No se envían a NASA/JPL; las consultas externas utilizan referencias públicas y puntos lunares.
- El nombre personalizado permanece en la interfaz. Los informes persistentes no incluyen las coordenadas terrestres en texto; los parámetros participan en el hash identificador.
- Las URL de consulta al propio backend pueden contener coordenadas; los logs del hosting requieren revisión y minimización antes de publicar.
- Cabeceras en `config/securityHeaders.ts`: CSP, Referrer-Policy, X-Content-Type-Options, X-Frame-Options y Permissions-Policy. Las excepciones de HMR se limitan al desarrollo.
- Se mantienen etiquetas accesibles, foco visible, pausa, navegación por teclado y respeto de movimiento reducido; no se ha certificado conformidad WCAG completa.
- `PRIVACY_REVIEW.md` documenta la revisión técnica y los pendientes del operador/hosting. No representa una certificación legal.

Los textos principales de aterrizaje están completos en español e inglés. Los de francés, portugués e italiano incorporan traducciones parciales y todavía heredan algunos detalles en inglés desde `landingMessages.ts`.

## 15. Archivos principales para continuar

| Archivo o carpeta | Responsabilidad |
| --- | --- |
| `src/App.tsx` | Portada, explorador, estado de misión, calendario y conexión entre análisis y escena |
| `src/config.ts` | Constantes SI y catálogo de centros |
| `src/scene/SpaceScene.tsx` | Escena, cámara, reproducción y marcadores |
| `src/scene/referenceFrame.ts` | Transformación ICRF/Three.js, orientaciones y compresión visual |
| `src/scene/bodyUV.ts`, `src/scene/assets.ts` | UV, carga y aislamiento de geometría, texturas |
| `src/scene/math.ts` | Utilidades físicas de referencia de la etapa inicial |
| `src/science/ephemeris.ts`, `vectors.ts` | Interpolación, validación y bases de coordenadas |
| `src/science/windows.ts`, `proximity.worker.ts` | Mínimos de distancia y cálculo local |
| `src/science/flightHistory.ts` | Vuelos históricos y estimación empírica |
| `src/science/landingWindows.ts`, `landingTypes.ts` | Validación del calendario y tipos de resultados |
| `src/science/useEphemeris.ts`, `useLandingAnalysis.ts` | Carga, seguimiento y reintentos de datos/análisis |
| `src/science/OrbitAnalysisPanel.tsx`, `LandingPanel.tsx` | Presentación y descarga de resultados |
| `src/science/messages.ts`, `landingMessages.ts` | Textos científicos de la interfaz |
| `server/horizons.ts` | API, validación y persistencia de efemérides principales |
| `server/jplStates.ts`, `jplQueue.ts` | Consultas auxiliares y cola JPL |
| `server/lunarEnvironment.ts` | Orientación lunar, Tierra/Sol y geometría histórica |
| `server/lunarTerrain.ts` | GeoTIFF, malla, BVH y línea de visión |
| `server/landingSimulation.ts` | Cronologías de visibilidad e iluminación |
| `server/landingAnalysis.ts`, `landingApi.ts` | Barrido, trabajos, caché, informes y endpoints |
| `server/index.ts`, `vite.config.ts` | Servidor de producción y middleware de desarrollo/vista previa |
| `src/i18n/`, `src/privacy/` | Idiomas, almacenamiento y panel de privacidad |
| `README.md`, `PRIVACY_REVIEW.md`, `LOOKUP.md` | Documentación, revisión y fuentes proporcionadas |

## 16. Ejecución, APIs y herramientas

Se necesita Node 22+, dependencias instaladas, escritura en las carpetas de datos y acceso HTTPS saliente a NASA/JPL y Moon Trek. No se necesitan claves API.

```sh
npm install
npm run dev
npm test
npm run build
npm run preview
```

- Desarrollo: `http://127.0.0.1:5173`.
- Producción con backend: ejecutar `npm run build` y `npm start`; escucha por defecto en `http://127.0.0.1:4173`, con `HOST`/`PORT` configurables.
- El hosting exclusivamente estático no proporciona el cálculo científico. No publicar Vite en modo desarrollo.
- Endpoints del mismo origen: `/api/ephemeris`, `/api/ephemeris/latest`, `/api/lunar-frames` y `/api/landing-analysis`.
- El análisis se inicia al elegir sitio, informa progreso, permite reintento y reutiliza los informes persistentes disponibles.

Comandos auxiliares:

```sh
npm run cache:ephemeris
npm run cache:ephemeris -- 2026-11-14T19:39:00Z
npm run verify:science -- ea770d664ee922b8485d91d8
npm run verify:science -- ea770d664ee922b8485d91d8 --online
npm run inspect:trek
npm run analyze:landing
npm run analyze:landing -- --smoke
npm run verify:landing -- fb8952d365a48f4007eb9087
```

- `cache:ephemeris`: obtiene/preserva la serie principal.
- `verify:science`: verifica mínimos en todos los centros y convergencia de interpolación a 5/10 min. `--online` contrasta tres mínimos de Kennedy con vectores topocéntricos directos de Horizons.
- `inspect:trek`: inspección reproducible de configuración pública, DEM numérico y procedencia de textura; puede requerir red.
- `analyze:landing`: barrido para Kennedy y la serie más reciente, o un ID de efemérides pasado como argumento. `--smoke` reduce la malla para diagnóstico.
- `verify:landing`: verifica coherencia del informe indicado y genera su resumen de días y resultados. No certifica una misión operativa.
- `Scripts/save-science-fixture.ts` mantiene las muestras de pruebas científicas.

## 17. Verificaciones realizadas hasta esta actualización

- Último `npm test`: **33 pruebas aprobadas, cero fallos**.
- Último `npm run build`: TypeScript y Vite completados correctamente.
- `git diff --check`: sin errores de espacios; Git informa normalización LF/CRLF en algunos archivos de Windows.
- Vite avisa de un bundle superior a 500 kB; la compilación termina correctamente. La optimización de carga puede abordarse posteriormente.
- Las pruebas cubren idiomas/privacidad, magnitudes de referencia, coordenadas y UV, interpretación de respuestas JPL, bases y Hermite, búsqueda de mínimos, cráter sintético, cobertura desconocida, eclipse solar, límite de ciclo y bloqueo de días no contiguos.
- Existen verificaciones geométricas guardadas en `data/horizons/ea770d664ee922b8485d91d8-verification.json` y su contraste topocéntrico original TXT.
- La comprobación completa del informe global de aterrizajes verificó rangos de fechas, coherencia vuelo/llegada, continuidad mayor de 24,5 h, límite de ciclo, porcentajes y procedencia/resolución del terreno.
- Navegador: selector bloqueado sin resultados, informe de Kennedy cargado y selección válida del **19 de noviembre de 2026**, con llegada mostrada **02:26:18 UTC**, pausa y marcador lunar.
- Intentar seleccionar el **25 de noviembre de 2026** fue rechazado porque la opción estaba deshabilitada, pese a estar entre días habilitados.
- Se observó la textura lunar y el marcador en el visor después de la selección.

Esta petición de crear `codex.md` sólo añade documentación. Las pruebas y la compilación anteriores corresponden al último cambio funcional; no es necesario recalcular el barrido para editar esta memoria.

## 18. Límites y próximos trabajos

- Implementar repetidores únicamente cuando el usuario lo solicite; mantener por ahora comunicación directa.
- La búsqueda es una cobertura global por muestreo y refinamiento local. No afirmar que se han encontrado o certificado todos los sitios de la superficie continua.
- El DEM de unos 237 m no resuelve paredes pequeñas, bloques ni todos los obstáculos locales. Ampliar cobertura/refinar con datos de mayor resolución será necesario para estudios detallados.
- El modelo de llegada es histórico y empírico. Faltan una transferencia dinámica resuelta y restricciones concretas de cohete, energía, plano orbital, azimut y rango.
- Faltan presupuestos de enlace RF, estaciones terrestres y sus horarios, parámetros de antena, paneles, cargas y baterías.
- No afirmar exactitud temporal total de ±30 min: es la escala del muestreo de visibilidad, con errores adicionales no acotados.
- Mantener separados resultados geométricos, candidatos estimados y ventanas operativas validadas.
- Completar las traducciones parciales del panel de aterrizajes cuando corresponda.
- Antes de publicar, revisar los pendientes de hosting, HTTPS, logs, responsable y licencias señalados en `PRIVACY_REVIEW.md`.
- Algunas frases antiguas del README describen la esfera de la primera etapa; el análisis de aterrizajes actual sí utiliza DEM en el backend. Mantener clara esa diferencia al actualizar la documentación.
- Preservar cachés, informes y respuestas originales; no regenerar el barrido costoso sin un cambio que lo justifique.
- Actualizar esta memoria con cada cambio relevante y diferenciar lo implementado, lo verificado y lo pendiente.
