import type { Language } from '../i18n/translations';

export const FAQ_IDS = ['usage', 'colors', 'expert', 'json', 'navigation'] as const;
export type FaqId = typeof FAQ_IDS[number];
export type FaqEntry = { question: string; answer: string; keywords: string[] };
type AssistantCopy = {
  title: string; subtitle: string; open: string; close: string; greeting: string; suggestions: string;
  placeholder: string; input: string; send: string; conversation: string; fallback: string;
  faq: Record<FaqId, FaqEntry>;
};
export const assistantMessages: Record<Language, AssistantCopy> = {
  es: {
    title: 'Spacey', subtitle: 'Tu guía de SPACE-MATE', open: 'Abrir asistente Spacey', close: 'Cerrar asistente Spacey',
    greeting: '¡Hola! Soy Spacey. Puedo ayudarte a usar SPACE-MATE. Elige una pregunta o escribe tu duda.',
    suggestions: 'Preguntas sugeridas', placeholder: 'Escribe tu duda…', input: 'Tu pregunta para Spacey', send: 'Enviar', conversation: 'Conversación con Spacey',
    fallback: 'Todavía no tengo una respuesta para esa consulta. Puedo ayudarte con el uso del visor, los colores, el modo especializado, el JSON científico y la navegación. Elige una pregunta sugerida o reformula tu duda.',
    faq: {
      usage: { question: '¿Cómo se usa?', keywords: ['usar', 'uso', 'utilizar', 'funciona', 'empezar', 'iniciar', 'comenzar'],
        answer: `1. Elige Público general o Público especializado. El segundo conserva la escala física.
2. Selecciona un sitio de lanzamiento.
3. Elige año y mes de aterrizaje, en UTC. Espera el análisis; puedes hacer el quiz mientras calculamos.
4. Selecciona uno de los días disponibles y compara los candidatos de aterrizaje.
5. Pulsa «Ver sitio de aterrizaje» para acercarte al punto en la Luna. Las estimaciones no son ventanas operativas de vuelo.` },
      colors: { question: '¿Qué significan los colores sobre la Luna?', keywords: ['color', 'colores', 'amarillo', 'verde', 'rojo', 'omat', 'leyenda'],
        answer: `Dependen de la capa que selecciones:
• Potencial solar: rojo indica menor potencial; verde, mayor. Los puntos aparecen al terminar el análisis de aterrizajes y no representan electricidad garantizada.
• OMAT: rojo indica mayor madurez óptica; verde, menor. No equivale a edad ni probabilidad de daño. El ecuador y los polos usan escalas de calibración distintas.
• Degradación térmica y polvo: rojo indica más vida de referencia consumida o mayor fracción de polvo fino; verde, menos. Requieren datos en Público especializado.
Abre «Leyenda, fuentes y datos» en el panel de capas. Una zona sin color no tiene datos evaluados.` },
      expert: { question: '¿Para qué sirve el modo Público especializado?', keywords: ['especializado', 'experto', 'escala fisica'],
        answer: `Conserva tamaños y distancias a la misma escala física y habilita la importación de datos científicos. Las capas de degradación térmica y polvo se activan sólo con mediciones y calibraciones válidas, con procedencia.
Los cálculos usan distancias reales en ambos modos. Puedes volver a Público general sin perder el sitio ni el mes elegido.` },
      json: { question: '¿Cómo es la estructura del JSON científico?', keywords: ['json', 'estructura', 'importar', 'granulometria', 'calibracion', 'especificacion'],
        answer: `En Público especializado, abre «Leyenda, fuentes y datos» del panel de capas, o «Importar JSON científico» si está seleccionada la textura original. Pulsa «Descargar especificación de entrada».
El documento requiere version: 1 y records. Cada registro incluye kind, latitude, longitude, source y measuredAt. Los registros thermal añaden samples y calibration; los de dust, sampleId, thresholdMicrons y bins.
Usa mediciones reales y sus fuentes. La especificación detalla unidades y validaciones. El archivo se procesa en esta pestaña, sin enviarlo ni guardarlo.` },
      navigation: { question: '¿Cómo muevo la cámara y acerco la Luna?', keywords: ['camara', 'zoom', 'rueda', 'rotar', 'girar', 'teclado', 'arrastrar', 'acercar'],
        answer: `Arrastra sobre el espacio o un astro para orbitar la cámara. Los cuerpos giran automáticamente; el arrastre no modifica su orientación.
Usa la rueda sobre la Tierra o la Luna para acercarte. En móvil, separa dos dedos; con el botón derecho puedes desplazar la cámara.
Los botones Tierra, Luna y Sistema centran la vista. El botón de mira del panel de capas centra la Luna. Con el visor enfocado, + y − ajustan el zoom y Home muestra el sistema.` },
    },
  },
  en: {
    title: 'Spacey', subtitle: 'Your SPACE-MATE guide', open: 'Open Spacey assistant', close: 'Close Spacey assistant',
    greeting: 'Hi! I’m Spacey. I can help you use SPACE-MATE. Choose a question or type your own.', suggestions: 'Suggested questions', placeholder: 'Type your question…', input: 'Your question for Spacey', send: 'Send', conversation: 'Conversation with Spacey',
    fallback: 'I don’t have an answer to that question yet. I can help with the viewer, colours, specialized mode, scientific JSON and navigation. Choose a suggested question or rephrase yours.',
    faq: {
      usage: { question: 'How do I use it?', keywords: ['use', 'using', 'start', 'begin', 'works', 'getting started'],
        answer: `1. Choose General public or Specialized public. The latter preserves physical scale.
2. Select a launch site.
3. Choose the landing year and month in UTC. Wait for the analysis; you can take the quiz while we calculate.
4. Select an available day and compare landing candidates.
5. Click “View landing site” to approach the point on the Moon. These estimates are not operational flight windows.` },
      colors: { question: 'What do the colours on the Moon mean?', keywords: ['color', 'colors', 'colour', 'colours', 'yellow', 'green', 'red', 'omat', 'legend'],
        answer: `They depend on the selected layer:
• Solar potential: red means lower potential; green means higher. Points appear after the landing analysis finishes and do not represent guaranteed electricity.
• OMAT: red means greater optical maturity; green means lower maturity. This is not an age or damage probability. Equatorial and polar data use different calibration scales.
• Thermal degradation and dust: red means more reference life consumed or a higher fine-dust mass fraction; green means less. They require data in Specialized public mode.
Open “Legend, sources and data” in the layer panel. An uncoloured area has no evaluated data.` },
      expert: { question: 'What is Specialized public mode for?', keywords: ['specialized', 'specialised', 'expert', 'physical scale'],
        answer: `It keeps sizes and distances at the same physical scale and enables scientific data imports. Equipment thermal degradation and dust layers are enabled only with valid, sourced measurements and calibrations.
Calculations use real distances in both modes. You can return to General public without losing the selected site or month.` },
      json: { question: 'What is the scientific JSON structure?', keywords: ['json', 'structure', 'import', 'grain', 'calibration', 'specification'],
        answer: `In Specialized public mode, open “Legend, sources and data” in the layer panel, or “Import scientific JSON” when the original texture is selected. Click “Download input specification”.
The document requires version: 1 and records. Every record includes kind, latitude, longitude, source and measuredAt. A thermal record adds samples and calibration; a dust record adds sampleId, thresholdMicrons and bins.
Use real measurements and their sources. The specification explains units and validation. The file is processed in this tab, without uploading or saving it.` },
      navigation: { question: 'How do I move the camera and zoom in on the Moon?', keywords: ['camera', 'zoom', 'wheel', 'rotate', 'keyboard', 'drag', 'navigation'],
        answer: `Drag over space or a body to orbit the camera. The bodies rotate automatically; dragging does not change their orientation.
Use the wheel over Earth or the Moon to zoom in. On mobile, spread two fingers; use the right mouse button to pan.
The Earth, Moon and System buttons centre the view. The crosshair in the layer panel centres the Moon. With the viewer focused, + and − adjust zoom and Home shows the system.` },
    },
  },
  fr: {
    title: 'Spacey', subtitle: 'Votre guide SPACE-MATE', open: 'Ouvrir l’assistant Spacey', close: 'Fermer l’assistant Spacey',
    greeting: 'Bonjour ! Je suis Spacey. Je peux vous aider à utiliser SPACE-MATE. Choisissez une question ou écrivez la vôtre.', suggestions: 'Questions suggérées', placeholder: 'Écrivez votre question…', input: 'Votre question à Spacey', send: 'Envoyer', conversation: 'Conversation avec Spacey',
    fallback: 'Je n’ai pas encore de réponse à cette question. Je peux expliquer le visualiseur, les couleurs, le mode spécialisé, le JSON scientifique et la navigation. Choisissez une question suggérée ou reformulez la vôtre.',
    faq: {
      usage: { question: 'Comment utiliser l’application ?', keywords: ['utiliser', 'utilisation', 'fonctionne', 'commencer', 'demarrer'],
        answer: `1. Choisissez Grand public ou Public spécialisé. Ce dernier conserve l’échelle physique.
2. Sélectionnez un site de lancement.
3. Choisissez l’année et le mois d’atterrissage en UTC. Attendez l’analyse ; vous pouvez faire le quiz pendant les calculs.
4. Choisissez un jour disponible et comparez les sites candidats.
5. Cliquez sur « Voir le site » pour vous approcher du point sur la Lune. Ces estimations ne sont pas des fenêtres de vol opérationnelles.` },
      colors: { question: 'Que signifient les couleurs sur la Lune ?', keywords: ['couleur', 'couleurs', 'jaune', 'vert', 'rouge', 'omat', 'legende'],
        answer: `Elles dépendent de la couche choisie :
• Potentiel solaire : rouge signifie un potentiel faible ; vert, un potentiel élevé. Les points apparaissent après l’analyse des atterrissages et ne garantissent pas une production électrique.
• OMAT : rouge indique une maturité optique accrue ; vert, une maturité moindre. Ce n’est ni un âge ni une probabilité de dommage. Les données équatoriales et polaires ont des étalonnages distincts.
• Dégradation thermique et poussière : rouge indique davantage de vie de référence consommée ou une fraction massique de poussière fine plus élevée ; vert, moins. Ces couches exigent des données en mode Public spécialisé.
Ouvrez « Légende, sources et données ». Une zone sans couleur n’a pas de données évaluées.` },
      expert: { question: 'À quoi sert le mode Public spécialisé ?', keywords: ['specialise', 'expert', 'echelle physique'],
        answer: `Il conserve les tailles et distances à la même échelle physique et permet l’importation de données scientifiques. Les couches de dégradation thermique du matériel et de poussière exigent des mesures et étalonnages valides avec leurs sources.
Les calculs utilisent les distances réelles dans les deux modes. Vous pouvez revenir à Grand public sans perdre le site ni le mois sélectionnés.` },
      json: { question: 'Quelle est la structure du JSON scientifique ?', keywords: ['json', 'structure', 'importer', 'granulometrie', 'etalonnage', 'specification'],
        answer: `En mode Public spécialisé, ouvrez « Légende, sources et données », ou « Importer un JSON scientifique » si la texture originale est sélectionnée. Cliquez sur « Télécharger la spécification ».
Le document exige version: 1 et records. Chaque enregistrement contient kind, latitude, longitude, source et measuredAt. Un enregistrement thermal ajoute samples et calibration ; un enregistrement dust ajoute sampleId, thresholdMicrons et bins.
Utilisez des mesures réelles et leurs sources. La spécification précise les unités et validations. Le fichier est traité dans cet onglet, sans envoi ni enregistrement.` },
      navigation: { question: 'Comment déplacer la caméra et zoomer sur la Lune ?', keywords: ['camera', 'zoom', 'zoomer', 'molette', 'tourner', 'clavier', 'glisser', 'navigation'],
        answer: `Faites glisser sur l’espace ou un astre pour déplacer la caméra autour de lui. Les astres tournent automatiquement ; le glissement ne modifie pas leur orientation.
Utilisez la molette sur la Terre ou la Lune pour zoomer. Sur mobile, écartez deux doigts ; le bouton droit permet de déplacer la vue.
Les boutons Terre, Lune et Système centrent la vue. La mire du panneau des couches centre la Lune. Lorsque le visualiseur a le focus, + et − règlent le zoom et Home affiche le système.` },
    },
  },
  pt: {
    title: 'Spacey', subtitle: 'Seu guia do SPACE-MATE', open: 'Abrir assistente Spacey', close: 'Fechar assistente Spacey',
    greeting: 'Olá! Sou o Spacey. Posso ajudar você a usar o SPACE-MATE. Escolha uma pergunta ou escreva sua dúvida.', suggestions: 'Perguntas sugeridas', placeholder: 'Escreva sua dúvida…', input: 'Sua pergunta para Spacey', send: 'Enviar', conversation: 'Conversa com Spacey',
    fallback: 'Ainda não tenho uma resposta para essa pergunta. Posso ajudar com o visualizador, as cores, o modo especializado, o JSON científico e a navegação. Escolha uma pergunta sugerida ou reformule sua dúvida.',
    faq: {
      usage: { question: 'Como usar?', keywords: ['usar', 'uso', 'utilizar', 'funciona', 'comecar', 'iniciar'],
        answer: `1. Escolha Público geral ou Público especializado. O segundo mantém a escala física.
2. Selecione um local de lançamento.
3. Escolha ano e mês de pouso em UTC. Aguarde a análise; você pode fazer o quiz durante os cálculos.
4. Selecione um dia disponível e compare os locais candidatos.
5. Clique em « Ver local » para se aproximar do ponto na Lua. Essas estimativas não são janelas operacionais de voo.` },
      colors: { question: 'O que significam as cores sobre a Lua?', keywords: ['cor', 'cores', 'amarelo', 'verde', 'vermelho', 'omat', 'legenda'],
        answer: `Depende da camada selecionada:
• Potencial solar: vermelho indica menor potencial; verde, maior. Os pontos aparecem após a análise dos pousos e não garantem eletricidade gerada.
• OMAT: vermelho indica maior maturidade óptica; verde, menor. Não equivale a idade nem probabilidade de dano. Os dados equatoriais e polares usam calibrações diferentes.
• Degradação térmica e poeira: vermelho indica mais vida de referência consumida ou maior fração mássica de poeira fina; verde, menos. Exigem dados no modo Público especializado.
Abra « Legenda, fontes e dados ». Uma área sem cor não tem dados avaliados.` },
      expert: { question: 'Para que serve o modo Público especializado?', keywords: ['especializado', 'especialista', 'escala fisica'],
        answer: `Mantém tamanhos e distâncias na mesma escala física e habilita a importação de dados científicos. As camadas de degradação térmica do equipamento e poeira só são habilitadas com medições e calibrações válidas, com fonte.
Os cálculos usam distâncias reais nos dois modos. Você pode voltar a Público geral sem perder o local ou o mês selecionado.` },
      json: { question: 'Qual é a estrutura do JSON científico?', keywords: ['json', 'estrutura', 'importar', 'granulometria', 'calibracao', 'especificacao'],
        answer: `No modo Público especializado, abra « Legenda, fontes e dados », ou « Importar JSON científico » quando a textura original estiver selecionada. Clique em « Baixar especificação de entrada ».
O documento exige version: 1 e records. Cada registro inclui kind, latitude, longitude, source e measuredAt. Um registro thermal acrescenta samples e calibration; um registro dust acrescenta sampleId, thresholdMicrons e bins.
Use medições reais e suas fontes. A especificação detalha unidades e validações. O arquivo é processado nesta aba, sem envio ou armazenamento.` },
      navigation: { question: 'Como mover a câmera e aproximar a Lua?', keywords: ['camera', 'zoom', 'roda', 'girar', 'teclado', 'arrastar', 'aproximar', 'navegacao'],
        answer: `Arraste sobre o espaço ou um astro para orbitar a câmera. Os corpos giram automaticamente; arrastar não altera sua orientação.
Use a roda sobre a Terra ou a Lua para aproximar. No celular, afaste dois dedos; o botão direito permite deslocar a câmera.
Os botões Terra, Lua e Sistema centralizam a vista. A mira do painel de camadas centraliza a Lua. Com o visualizador em foco, + e − ajustam o zoom e Home mostra o sistema.` },
    },
  },
  it: {
    title: 'Spacey', subtitle: 'La tua guida a SPACE-MATE', open: 'Apri assistente Spacey', close: 'Chiudi assistente Spacey',
    greeting: 'Ciao! Sono Spacey. Posso aiutarti a usare SPACE-MATE. Scegli una domanda o scrivi la tua.', suggestions: 'Domande suggerite', placeholder: 'Scrivi la tua domanda…', input: 'La tua domanda per Spacey', send: 'Invia', conversation: 'Conversazione con Spacey',
    fallback: 'Non ho ancora una risposta a questa domanda. Posso aiutarti con il visualizzatore, i colori, la modalità specializzata, il JSON scientifico e la navigazione. Scegli una domanda suggerita o riformula la tua.',
    faq: {
      usage: { question: 'Come si usa?', keywords: ['usare', 'usa', 'uso', 'utilizzare', 'funziona', 'iniziare', 'cominciare'],
        answer: `1. Scegli Pubblico generale o Pubblico specializzato. Il secondo mantiene la scala fisica.
2. Seleziona un sito di lancio.
3. Scegli anno e mese di atterraggio in UTC. Attendi l’analisi; puoi fare il quiz durante i calcoli.
4. Seleziona un giorno disponibile e confronta i siti candidati.
5. Premi « Vedi il sito » per avvicinarti al punto sulla Luna. Queste stime non sono finestre operative di volo.` },
      colors: { question: 'Che cosa significano i colori sulla Luna?', keywords: ['colore', 'colori', 'giallo', 'verde', 'rosso', 'omat', 'legenda'],
        answer: `Dipendono dal livello selezionato:
• Potenziale solare: rosso indica potenziale minore; verde, maggiore. I punti compaiono al termine dell’analisi degli atterraggi e non garantiscono elettricità prodotta.
• OMAT: rosso indica maturità ottica maggiore; verde, minore. Non equivale a età o probabilità di danno. I dati equatoriali e polari usano calibrazioni diverse.
• Degrado termico e polvere: rosso indica più vita di riferimento consumata o maggiore frazione massica di polvere fine; verde, meno. Richiedono dati in modalità Pubblico specializzato.
Apri « Legenda, fonti e dati ». Una zona senza colore non ha dati valutati.` },
      expert: { question: 'A cosa serve la modalità Pubblico specializzato?', keywords: ['specializzato', 'esperto', 'scala fisica'],
        answer: `Mantiene dimensioni e distanze alla stessa scala fisica e consente di importare dati scientifici. I livelli di degrado termico del dispositivo e polvere si attivano solo con misure e calibrazioni valide e documentate.
I calcoli usano distanze reali in entrambe le modalità. Puoi tornare a Pubblico generale senza perdere il sito o il mese selezionato.` },
      json: { question: 'Qual è la struttura del JSON scientifico?', keywords: ['json', 'struttura', 'importare', 'granulometria', 'calibrazione', 'specifica'],
        answer: `In modalità Pubblico specializzato, apri « Legenda, fonti e dati », oppure « Importa JSON scientifico » quando è selezionata la texture originale. Premi « Scarica specifica di ingresso ».
Il documento richiede version: 1 e records. Ogni record contiene kind, latitude, longitude, source e measuredAt. Un record thermal aggiunge samples e calibration; un record dust aggiunge sampleId, thresholdMicrons e bins.
Usa misure reali e le loro fonti. La specifica descrive unità e validazioni. Il file viene elaborato in questa scheda, senza inviarlo o salvarlo.` },
      navigation: { question: 'Come sposto la telecamera e ingrandisco la Luna?', keywords: ['telecamera', 'camera', 'zoom', 'rotella', 'ruotare', 'tastiera', 'trascinare', 'ingrandire', 'navigazione'],
        answer: `Trascina sullo spazio o su un astro per spostare la telecamera attorno a esso. I corpi ruotano automaticamente; il trascinamento non ne modifica l’orientamento.
Usa la rotella sulla Terra o sulla Luna per avvicinarti. Su mobile, allontana due dita; con il pulsante destro puoi spostare la vista.
I pulsanti Terra, Luna e Sistema centrano la vista. Il mirino del pannello dei livelli centra la Luna. Con il visualizzatore attivo, + e − regolano lo zoom e Home mostra il sistema.` },
    },
  },
};
