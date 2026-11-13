import type { Language } from '../i18n/translations';

const en = {
  title: 'Privacy and storage', close: 'Close privacy information',
  overview: 'This version does not use advertising or analytics cookies, trackers, or user profiles. Fonts, images and models are served by this site.',
  languageTitle: 'Language preference',
  languageInfo: 'Only an explicit language selection is saved on this device, with a validity of 180 days. Expired preferences are removed on the next visit. We do not store your launch-site coordinates or dates.',
  saved: 'A language preference is saved.', empty: 'No valid language preference is saved.', forget: 'Forget saved language',
  storageError: 'The browser blocked deletion. You can remove this site’s stored data in your browser settings.',
  permissionsTitle: 'Browser permissions', permissionsInfo: 'The application does not request camera, microphone or location access. It does not send your selected coordinates to an external service.',
  scopeTitle: 'Scope of this notice', scopeInfo: 'This notice describes storage by the current application. Before publication, the operator must also provide a privacy policy identifying the responsible organization, its contact details and how the hosting provider handles connection data.',
};

export const privacyMessages: Record<Language, typeof en> = {
  en,
  es: {
    title: 'Privacidad y almacenamiento', close: 'Cerrar información de privacidad',
    overview: 'Esta versión no utiliza cookies de publicidad o analítica, rastreadores ni perfiles de usuario. Las fuentes, imágenes y modelos se sirven desde este sitio.',
    languageTitle: 'Preferencia de idioma',
    languageInfo: 'Solo guardamos en este dispositivo el idioma que eliges explícitamente, con una vigencia de 180 días. Las preferencias caducadas se eliminan en la siguiente visita. No guardamos las coordenadas ni las fechas de lanzamiento.',
    saved: 'Hay una preferencia de idioma guardada.', empty: 'No hay una preferencia de idioma válida guardada.', forget: 'Olvidar idioma guardado',
    storageError: 'El navegador bloqueó la eliminación. Puedes borrar los datos de este sitio desde la configuración del navegador.',
    permissionsTitle: 'Permisos del navegador', permissionsInfo: 'La aplicación no solicita acceso a cámara, micrófono ni ubicación. No envía las coordenadas elegidas a servicios externos.',
    scopeTitle: 'Alcance del aviso', scopeInfo: 'Este aviso describe el almacenamiento de la aplicación actual. Antes de publicar, el responsable debe completar una política de privacidad con su identidad, contacto y el tratamiento de los datos de conexión por el proveedor de alojamiento.',
  },
  fr: {
    title: 'Confidentialité et stockage', close: 'Fermer les informations de confidentialité',
    overview: 'Cette version n’utilise pas de cookies publicitaires ou analytiques, de traceurs ni de profils utilisateurs. Les polices, images et modèles sont servis par ce site.',
    languageTitle: 'Préférence de langue',
    languageInfo: 'Seule la langue que vous choisissez explicitement est enregistrée sur cet appareil, pour 180 jours. Les préférences expirées sont supprimées lors de la visite suivante. Les coordonnées et dates de lancement ne sont pas enregistrées.',
    saved: 'Une préférence de langue est enregistrée.', empty: 'Aucune préférence de langue valide n’est enregistrée.', forget: 'Oublier la langue enregistrée',
    storageError: 'Le navigateur a bloqué la suppression. Vous pouvez effacer les données de ce site dans ses paramètres.',
    permissionsTitle: 'Autorisations du navigateur', permissionsInfo: 'L’application ne demande pas d’accès à la caméra, au microphone ou à la localisation. Les coordonnées choisies ne sont pas envoyées à un service externe.',
    scopeTitle: 'Portée de cet avis', scopeInfo: 'Cet avis décrit le stockage de l’application actuelle. Avant publication, l’exploitant doit fournir une politique de confidentialité précisant son identité, ses coordonnées et le traitement des données de connexion par l’hébergeur.',
  },
  pt: {
    title: 'Privacidade e armazenamento', close: 'Fechar informações de privacidade',
    overview: 'Esta versão não usa cookies de publicidade ou análise, rastreadores nem perfis de usuário. Fontes, imagens e modelos são fornecidos por este site.',
    languageTitle: 'Preferência de idioma',
    languageInfo: 'Somente o idioma escolhido explicitamente é salvo neste dispositivo, com validade de 180 dias. Preferências expiradas são removidas na próxima visita. Não salvamos coordenadas nem datas de lançamento.',
    saved: 'Há uma preferência de idioma salva.', empty: 'Não há uma preferência de idioma válida salva.', forget: 'Esquecer idioma salvo',
    storageError: 'O navegador bloqueou a exclusão. Você pode apagar os dados deste site nas configurações do navegador.',
    permissionsTitle: 'Permissões do navegador', permissionsInfo: 'A aplicação não pede acesso à câmera, ao microfone ou à localização. As coordenadas escolhidas não são enviadas a serviços externos.',
    scopeTitle: 'Escopo do aviso', scopeInfo: 'Este aviso descreve o armazenamento da aplicação atual. Antes da publicação, o responsável deve completar uma política de privacidade com sua identidade, contato e o tratamento de dados de conexão pelo provedor de hospedagem.',
  },
  it: {
    title: 'Privacy e archiviazione', close: 'Chiudi informazioni sulla privacy',
    overview: 'Questa versione non usa cookie pubblicitari o analitici, strumenti di tracciamento o profili utente. Font, immagini e modelli sono serviti da questo sito.',
    languageTitle: 'Preferenza di lingua',
    languageInfo: 'Viene salvata sul dispositivo solo la lingua scelta esplicitamente, con validità di 180 giorni. Le preferenze scadute sono eliminate alla visita successiva. Non salviamo coordinate o date di lancio.',
    saved: 'Una preferenza di lingua è salvata.', empty: 'Non è salvata alcuna preferenza di lingua valida.', forget: 'Dimentica la lingua salvata',
    storageError: 'Il browser ha bloccato l’eliminazione. Puoi cancellare i dati del sito dalle impostazioni del browser.',
    permissionsTitle: 'Autorizzazioni del browser', permissionsInfo: 'L’applicazione non richiede accesso a fotocamera, microfono o posizione. Le coordinate scelte non sono inviate a servizi esterni.',
    scopeTitle: 'Ambito dell’avviso', scopeInfo: 'Questo avviso descrive l’archiviazione dell’applicazione attuale. Prima della pubblicazione, il responsabile deve completare una politica sulla privacy con identità, contatti e trattamento dei dati di connessione da parte del servizio di hosting.',
  },
};
