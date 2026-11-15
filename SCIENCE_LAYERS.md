# Capas científicas de la superficie lunar

## Acceso y datos reales

El modo interno `real` conserva la escala física y ahora se llama **Público especializado** (Specialized public / Public spécialisé / Público especializado / Pubblico specializzato). No se añade un tercer modo. El público general conserva calendario, lanzamientos, coordenadas personalizadas, cámaras, reproducción, quiz y resultados anteriores.

Ambos públicos pueden ver potencial solar y madurez óptica por API. Sólo el público especializado tiene importación científica y capas de degradación del equipo y polvo. Estas dos capas permanecen deshabilitadas hasta aportar mediciones válidas. Los datos aportados no se suben ni se guardan: permanecen en memoria de la pestaña. Exigir una URL de procedencia no certifica la veracidad de un archivo aportado por el usuario.

El selector está en un panel flotante **dentro del visor 3D**, con centrado de la Luna y un desplegable para leyendas, fuentes, opacidad e importación. No ocupa la barra lateral. La capa solar indica cuándo falta elegir un lanzamiento, cuándo sigue calculándose el análisis y cuándo no hay puntos para la fecha elegida; no representa esos estados como una superficie sin explicación. Al terminar el análisis se centra la Luna y se muestra el número de puntos disponibles.

## Potencial solar

Se reutilizan los vectores del Sol y de la Tierra y la orientación lunar de **NASA/JPL Horizons**, así como las sombras del DEM numérico **LRO LOLA** y la detección conservadora de eclipses existentes. No se usa el brillo de la textura como dato científico. Para un plano paralelo al terreno:

```
μ(t) = max(0, n · (rSol(t) − rSitio)/|rSol(t) − rSitio|)
q(t) = μ(t) [149597870700 m / |rSol(t) − rSitio|]²
H = ∫ V(t) q(t) dt / 3600                [h equivalentes a 1 au]
```

`n` es la normal local obtenida del DEM; `V` representa visibilidad geométrica. El valor en metros de la unidad astronómica es una definición SI, no un parámetro ajustado. Se integra sobre **29,530589 días**, un mes sinódico medio, desde cada llegada: es el ciclo completo de día y noche en el lugar, de modo que el total no depende de la fase solar en el momento de la llegada. El mes sinódico real varía unas horas alrededor de esa media. Se usa integración exacta de la incidencia interpolada linealmente entre muestras de 30 min y se recortan exactamente los extremos temporales. Los prefijos permiten reutilizar la integración para distintas llegadas.

El resultado compara exposición solar potencial y no requiere inventar eficiencia, superficie de panel, irradiancia solar instantánea o consumo. **No es kWh eléctricos ni una medición radiométrica de energía.** Para calcularlos habría que aportar irradiancia y características reales del panel: `Eeléctrica = ∫ η(T, espectro, degradación) A G(t) μ(t) V(t) dt`.

Se exige visibilidad despejada en ambos extremos de cada intervalo; se mantiene el umbral conservador de 1° del análisis existente. Un eclipse parcial se excluye por completo. El resultado inferior usa sólo intervalos despejados; el superior añade intervalos con rayos sin resolver, es decir, los que pasan entre las envolventes superior e inferior del relieve global lejano. Estos límites sólo tratan la cobertura de rayos: **no son un intervalo de confianza ni acotan el error total**, las transiciones dentro de una muestra, el relieve no resuelto o la variabilidad solar. La normal usa diferencias de ±0,01°; el DEM local tiene ~237 m. No se ha inventado generación de energía para las zonas que no fueron evaluadas.

Cada punto usa el mejor resultado inferior entre sus llegadas del día elegido (o del mes cuando no se elige día). El mapa y su explicación indican esta agregación. Los símbolos se amplían para verlos: no representan un área certificada ni se interpolan entre ellos. Cambiar de mes o sitio elimina los resultados del análisis anterior mediante el ciclo de vida existente. Se cambian los identificadores de caché para no reutilizar informes sin la nueva integración.

Además del dibujo registrado en la textura, se renderizan marcas cartográficas de **8 píxeles**, ancladas al marco lunar, con profundidad y sin atenuación de tamaño con la distancia. Esto evita que los sitios desaparezcan al reducirse por debajo de un píxel de la textura proyectada. La separación visual respecto al STL sólo evita oclusión y no representa una altura real del terreno.

Fuentes: [JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [servicio numérico LOLA](https://trek.nasa.gov/moon/trekarcgis/rest/services/LRO_LOLA_DEM_Global_256ppd_v06/ImageServer).

## Meteorización espacial: madurez óptica observada

Se utiliza el producto **Kaguya MI Derived Optical Maturity OMAT**, distribuido por NASA Moon Trek, con procedencia científica USGS / Lemelin et al. / JAXA. OMAT es un índice adimensional derivado de reflectancias observadas y corregidas topográficamente. Un OMAT menor corresponde a mayor madurez óptica relativa. No equivale a edad absoluta, tasa de erosión, polvo suspendido, probabilidad de fallo ni peligro operativo. La composición también influye en la interpretación.

Se usa el producto calibrado ya publicado: no se aplican indiscriminadamente los coeficientes de Clementine a las bandas de Kaguya. El servicio consultado tiene píxeles de 0,25° y cobertura de **50°S a 50°N**. Para el visor se exporta un GeoTIFF F32 de una banda a **720 × 200 (0,5°)**, mediante vecino más próximo y `rasterFunction: None`; no se reconstruyen valores a partir de imágenes RGB. No se atribuye al visor la resolución de 59 m del producto original de USGS. Se conservan todos los valores numéricos del raster exportado, incluidos los atípicos; no se han aplicado criterios de calidad adicionales no documentados por el servicio.

Para **50°–90° norte y sur** se añaden los mapas numéricos **Kaguya Spectral Profiler + LOLA** de **Lemelin, Lucey y Camon (2022), versión 2**, [DOI 10.5281/zenodo.7108163](https://zenodo.org/records/7108163), licencia CC BY 4.0. Se verifica cada ZIP con el MD5 publicado y se conservan SHA-256 del archivo, TIFF y rejilla derivada. No se extiende el producto ecuatorial a los polos. Los archivos originales están en `data/surface-layers/polar-source/` (excluidos de Git por su tamaño); las rejillas compactas, metadatos y huellas se incluyen en `data/surface-layers/`.

La versión 2 corrige la georreferencia de la versión 1. Los TIFF polares tienen 2529 × 2529 valores F32 y describen su transformación en archivos `.aux.xml`. Se comprueban sus puntos de control, unidades de imagen y WKT (Moon 2000 esférica, radio 1.737.400 m, meridiano 0°, paralelos ±90°). La relación publicada resulta en unos 1002,35 m por píxel. La reproyección usa `ρ = 2R tan(π/4 ∓ φ/2)`, `x = ρ sin λ`, `y = ∓ρ cos λ`, con los signos de cada polo. El visor muestra rejillas equirectangulares de 720 × 80 valores por polo (0,5°), tomando únicamente la celda original correspondiente; no interpola ni rellena huecos. Los negativos (incluido el relleno −10, incompatible con una norma OMAT) se mantienen como ausentes.

La escala de colores usa los percentiles 2 y 98 para evitar que valores extremos oculten el contraste. Esta saturación sólo afecta al color, nunca a los valores consultados o descargados. **El producto MI y el producto polar SP/LOLA tienen calibraciones diferentes y sus OMAT absolutos no deben equipararse.** Se usa una escala ecuatorial propia y otra común para ambos polos, con tres leyendas identificadas en el visor. La advertencia se muestra incluso con los detalles cerrados. Esta distinción sigue la discusión de los autores en [Lemelin et al., 2022, sección 6.2](https://doi.org/10.3847/PSJ/ac532c). Los NoData declarados y los valores no finitos permanecen sin dato.

El servidor conserva el TIFF ecuatorial original, los metadatos del servicio, la consulta completa, la fecha de adquisición y el SHA-256 en `data/surface-layers/`. Comprueba la huella y la geometría antes de servirlo. `/api/surface-layer?layer=weathering` mantiene el producto ecuatorial compatible; `&coverage=global` devuelve los tres productos en una respuesta de versión 2. Sólo accede a estas fuentes permitidas; no es un proxy arbitrario. Si no puede verificar u obtener los datos, devuelve 503; no genera datos de sustitución.

Fuentes: [descripción del producto USGS](https://astrogeology.usgs.gov/search/map/kaguya_lunar_multiband_imager_mi_derived_optical_maturity_omat_50n50s_512ppd_59mpp), [servicio oficial NASA](https://trek.nasa.gov/moon/trekarcgis/rest/services/Lunar_Kaguya_MIMap_MineralDeconv_OpticalMaturityIndex_50N50S/ImageServer), [guía de JAXA sobre madurez óptica y calibración de Kaguya](https://vp.darts.isas.jaxa.jp/guide_en.html).

## Degradación térmica del equipo

La temperatura de superficie lunar medida por Diviner **no es la temperatura de un dispositivo**. Inferir daño a partir de latitud, horas al Sol o temperatura del suelo sin conocer el equipo sería injustificado. Una predicción de temperatura requiere resolver el balance de energía de sus nodos:

```
Ci dTi/dt = Qsolar,i + Qalbedo,i + QIR,i + Pinterna,i
            + Σj Gij (Tj − Ti) + Σj Qradiación,ji − Qradiación,i→espacio
```

Hacen falta absorptancia/emisividad, áreas y orientación, capacidad térmica, conductancias, factores de vista, condiciones iniciales, cargas y control térmico, medidos y validados para ese equipo. No se han puesto valores genéricos ni se ha sustituido la temperatura del equipo por una temperatura de equilibrio inventada. Para esta implementación se elige la entrada más directamente verificable: **historia temporal de temperatura del propio equipo** y calibración experimental de un mecanismo de degradación. Una futura simulación térmica validada puede producir esa historia, pero la aplicación no la certifica.

Con una calibración Arrhenius apropiada:

```
AF(T) = exp[(Ea/kB) (1/Tref − 1/T)]
hequivalentes = ∫ AF(T(t)) dt / 3600
D = hequivalentes / Lref
vida de referencia consumida = 100 D       [%]
kB = 8,617333262145 × 10⁻⁵ eV/K
```

Se exige energía de activación experimental específica del mecanismo, vida hasta un criterio de degradación documentado a la temperatura de referencia, intervalo de calibración, URL del ensayo, mecanismo y separación temporal máxima justificada por la instrumentación. No hay energía de activación ni vida útil predeterminadas.

Se interpola linealmente la historia medida y se integra por punto medio compuesto con pasos de hasta 60 s y cambios de hasta 0,25 K. Se rechazan tiempos desordenados, huecos superiores al máximo justificado y temperaturas fuera del intervalo de calibración, incluida la temperatura de referencia. Se limita la carga numérica de importaciones. Todas las localizaciones de un mapa deben compartir calibración, mecanismo y extremos temporales para permitir la comparación.

**D no es probabilidad de fallo ni porcentaje universal de destrucción**, y puede superar 1. La acumulación lineal de daño es una hipótesis de ese modelo, válida únicamente si el ensayo y mecanismo la justifican. No cubre fatiga por ciclos, choque térmico, transiciones de fase, daños por frío ni mecanismos no Arrhenius. Para fatiga se necesitan datos de ciclos y curvas de vida específicas; no se inventaron coeficientes Coffin–Manson.

Fuente del modelo: [NIST/SEMATECH Engineering Statistics Handbook, Arrhenius](https://www.itl.nist.gov/div898/handbook/apr/section1/apr151.htm).

## Nivel de polvo

No se convierte la abundancia de rocas, el albedo, la madurez OMAT o la iluminación en una concentración ficticia de polvo. Una medida reproducible de polvo del suelo es la fracción másica de una muestra por debajo de un umbral granulométrico documentado:

```
fpolvo(d*) = Σ masas de intervalos con diámetro superior ≤ d* / masa total
```

La entrada requiere muestra identificada, coordenadas, fecha, informe original, umbral medido en µm y fracciones másicas de **toda la muestra**, ordenadas, contiguas desde 0 µm, no superpuestas y con suma 1 (tolerancia 10⁻⁶). Si el umbral corta un intervalo se rechaza el cálculo: no se presupone una distribución uniforme o lognormal. Todos los puntos del mapa usan el mismo umbral. El resultado es porcentaje en masa de material fino en esas muestras, no profundidad de regolito, densidad de partículas en suspensión ni deposición sobre el equipo. No se extiende una muestra Apollo al resto de la Luna.

La deposición exigiría flujos medidos y eficiencias de captura específicas; el transporte por plumas exigiría datos del motor y del suelo. No se asignan valores sin ellos. La definición de polvo depende del estudio; NASA señala que no existe un único límite superior formal y trata 10–20 µm en su documento de referencia. Por eso el visor mantiene visible el umbral de la muestra, en lugar de fijar uno universal.

Fuente: [NASA/TP-20220018746, Lunar Dust Mitigation: A Guide and Reference, apéndice B](https://ntrs.nasa.gov/citations/20220018746).

## Uso y comprobación

En Público especializado, «Descargar especificación de entrada» documenta los campos JSON sin introducir datos de ejemplo en el producto. «Importar JSON científico» valida todos los registros antes de habilitar sus capas. Los valores importados son únicamente los que aporta el archivo, y se exige igualdad de umbral o de calibración/período para comparar localizaciones. El control de archivos no aparece en Público general; al cambiar a ese modo se retira inmediatamente cualquier capa restringida.

```
node --import tsx Scripts/cache-surface-layers.ts
npm test
npm run build
npm run analyze:landing -- --month=2026-11 --smoke
```

Las pruebas usan casos analíticos sintéticos aislados del producto (ley coseno, inverso del cuadrado, historia térmica constante/rampa, tamices) y contrastan la integridad del TIFF auténtico. No se sirven esos valores de prueba a los usuarios. La prueba reducida de aterrizajes no certifica toda la superficie.
