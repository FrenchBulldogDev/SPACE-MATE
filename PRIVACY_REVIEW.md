# Revisión técnica de privacidad y seguridad

Responsable indicado por el usuario: Estados Unidos. Público: internacional.

## Resultado y alcance

Se reforzó la aplicación local y su compilación estática. Esta revisión no acredita el cumplimiento de todas las leyes de todos los países ni constituye asesoramiento jurídico o una certificación WCAG. El sitio no está publicado y todavía faltan datos del responsable y del hosting definitivo.

## Inventario de la aplicación actual

| Elemento | Finalidad / tratamiento | Estado |
| --- | --- | --- |
| Cookies de aplicación | El código no crea cookies | Sin analítica ni publicidad incorporadas |
| `moon-mission.language` en localStorage | Idioma elegido explícitamente; JSON con versión, idioma y caducidad | Vigencia de 180 días; borrado al volver a visitar tras caducar; borrado manual disponible |
| Coordenadas, altura y nombre del sitio | Mínimos geométricos locales en Web Worker; coordenadas y altura enviadas al servidor del mismo origen para candidatos de aterrizaje | El nombre permanece en la interfaz. Coordenadas y altura se usan temporalmente en el backend, no se envían a NASA/JPL ni se guardan en texto en los informes; su hash identifica el cálculo. Las URL de petición pueden aparecer en logs del hosting. Una descarga solicitada puede incluirlos |
| Intervalo de efemérides | Consulta del navegador a `/api/ephemeris` y del servidor a NASA/JPL Horizons | Se guardan efemérides públicas, fechas, metadatos y respuestas originales en `data/horizons/`; no se envía el sitio del usuario |
| Relieve y candidatos de aterrizaje | JPL para los marcos Tierra/Luna/Sol y posiciones históricas públicas; Moon Trek para DEM lunares numéricos | Se conservan respuestas, GeoTIFF, metadatos e informes en `data/landing/` y `data/terrain/`. Los puntos lunares consultados son públicos y no incluyen las coordenadas terrestres del usuario |
| Public Sans | Tipografía local en `public/fonts/` | Se eliminó Google Fonts; se conserva la licencia SIL OFL |
| Modelos, texturas e imágenes | Assets del proyecto | Servidos desde el mismo origen |
| Cámara, micrófono, ubicación, pagos y USB | No utilizados | La aplicación no los solicita; Permissions-Policy los deshabilita en los servidores verificados |
| Integración con OpenAI / API de lanzamientos | No implementada actualmente | Horizons es una API de efemérides, no de programación de lanzamientos |

No se guarda el idioma predeterminado al iniciar. Cambiar de idioma sigue funcionando si el navegador bloquea el almacenamiento. El control de borrado elimina exclusivamente la clave de esta aplicación, conserva el idioma de la sesión actual y no borra otros datos del navegador. Las antiguas preferencias sin caducidad se eliminan al cargar.

localStorage no elimina registros por sí solo mientras la página está cerrada. La aplicación deja de utilizar los registros caducados y los elimina en la siguiente carga; esto se explica en el aviso visible.

## Cookies y consentimiento

La aplicación no incorpora servicios de publicidad, medición ni rastreo. La personalización corresponde a una elección explícita del usuario y se utiliza únicamente para el idioma. La guía de la AEPD contempla una exención para preferencias de interfaz solicitadas por el usuario, sin usos adicionales ni perfilado. Esta referencia es aplicable a su ámbito normativo, no una conclusión universal sobre todos los países.

El aviso «Privacidad y almacenamiento» informa sobre el comportamiento técnico y permite eliminar la preferencia. No es una política de privacidad legal completa del futuro operador. Si se añaden cookies o tecnologías de seguimiento no exentas, deberán bloquearse antes de obtener el consentimiento pertinente y deberán existir opciones reales de rechazo y retirada.

Fuente: [Guía de cookies de la AEPD, apartado 2.1.2](https://www.aepd.es/guias/guia-cookies.pdf).

## Protecciones implementadas

- CSP limita scripts, conexiones y fuentes al mismo origen en producción. No permite scripts inline ni `unsafe-eval` en producción. Los estilos inline siguen habilitados para las actualizaciones de la escena.
- El desarrollo permite el script inline de Vite y WebSocket local para HMR. Esta excepción no aparece en la política de producción.
- Referrer-Policy: `no-referrer`.
- X-Content-Type-Options: `nosniff`.
- X-Frame-Options: `DENY`; CSP `frame-ancestors 'none'`.
- Permissions-Policy deshabilita cámara, micrófono, geolocalización, pagos y USB.
- La fuente original y su licencia se descargaron del repositorio oficial de Google Fonts: [Public Sans](https://github.com/google/fonts/tree/main/ofl/publicsans).
- El aviso usa un diálogo nativo con cierre por teclado. La interfaz conserva etiquetas, foco visible y botón de pausa. Con preferencia de movimiento reducido, la escena comienza pausada y evita las transiciones largas. Esto no sustituye una auditoría integral de accesibilidad.

Las cabeceras se aplican en Vite y en `vite preview`. `public/_headers` se copia a `dist/_headers` para proveedores que admitan ese formato. Otros servidores deben configurar las mismas cabeceras; su presencia en un archivo no garantiza que el hosting las aplique. HTTPS y la política HSTS deberán configurarse y comprobarse en el dominio definitivo, no en el servidor HTTP local de desarrollo.

## Verificaciones realizadas

- Compilación TypeScript/Vite correcta.
- Once pruebas: traducciones, recuperación y borrado del idioma, ausencia de escrituras iniciales, caducidad, datos corruptos, almacenamiento bloqueado, protección de datos ajenos y restricciones de seguridad.
- `npm audit --omit=dev --json`: cero vulnerabilidades conocidas reportadas para dependencias de producción en el momento de la consulta. No es una garantía de ausencia de fallos y no incluye las dependencias de desarrollo.
- Respuesta HTTP local de desarrollo y de producción inspeccionada para verificar cabeceras. La respuesta raíz revisada no envía Set-Cookie.
- Navegador: sin preferencia válida al iniciar; selección explícita crea la preferencia; «Olvidar idioma guardado» la elimina; después de recargar se vuelve al español sin recrearla automáticamente.
- Escena 3D y marcador comprobados bajo la CSP de producción, sin errores de consola observados. El script y el CSS publicados apuntan a `/assets/` del mismo origen.
- El entorno de inspección no permitió una lectura directa del almacén completo de cookies/localStorage del navegador. La comprobación combina código, pruebas de almacenamiento, aviso de la interfaz y respuestas HTTP. No incluye cookies HttpOnly o añadidas por un hosting aún no elegido.

## Pendientes antes de publicar

1. Identificar entidad responsable, estado de EE. UU., domicilio y contacto de privacidad.
2. Determinar si se trata de empresa, entidad educativa, organización sin fines de lucro o administración, y si el servicio se dirige a menores.
3. Revisar el hosting: logs de IP, retención, acceso, cookies técnicas, CDN, contratos, transferencias internacionales y mecanismos de derechos. Minimizar esos registros.
4. Completar y revisar la política de privacidad de la entidad. No sustituirla por placeholders ni afirmar certificaciones inexistentes.
5. Evaluar las leyes estatales estadounidenses aplicables. CCPA/CPRA depende, entre otros factores, de actividad, tipo de entidad y umbrales; no aplica automáticamente a cualquier web con visitantes de California. [Fiscalía de California](https://oag.ca.gov/privacy/ccpa).
6. Evaluar COPPA si el servicio queda comprendido por su alcance respecto a menores de 13 años y recogida de información personal. Esto también exige revisar los proveedores y datos técnicos de conexión. No se añadió una recopilación de edad innecesaria. [FTC: guía COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
7. Determinar el alcance territorial de RGPD/ePrivacy y las reglas de otros mercados efectivamente atendidos. «Público internacional» no permite dar por comprobadas todas las jurisdicciones.
8. Auditar accesibilidad con teclado, lector de pantalla, ampliación, alternativas a la interacción 3D y controles de la vista móvil. [WCAG 2.2](https://www.w3.org/TR/WCAG22/).
9. Confirmar derechos y licencias de STL, texturas y futura imagen de portada antes de distribución pública.
10. Repetir la inspección en el sitio publicado: HTTPS, cabeceras efectivas, almacenamiento inicial, cookies de todos los proveedores y tráfico de red. Revisar de nuevo cuando se añadan APIs, cuentas, pagos o analítica.
