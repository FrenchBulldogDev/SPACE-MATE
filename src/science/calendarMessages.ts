import type { Language } from '../i18n/translations';

const en = { year: 'Year', month: 'Month', day: 'Day', loading: 'Calculating the selected month…', empty: 'No estimated launch windows with accepted landings are available in the selected month and year.', range: 'UTC dates · February 1962–December 2100', samples: 'samples', markers: 'daily markers' };
export const calendarMessages: Record<Language, typeof en> = {
  en,
  es: { year: 'Año', month: 'Mes', day: 'Día', loading: 'Calculando el mes seleccionado…', empty: 'No hay ventanas de lanzamiento estimadas con aterrizajes aceptados disponibles para el mes y año seleccionados.', range: 'Fechas UTC · febrero de 1962–diciembre de 2100', samples: 'muestras', markers: 'marcadores diarios' },
  fr: { year: 'Année', month: 'Mois', day: 'Jour', loading: 'Calcul du mois sélectionné…', empty: 'Aucune fenêtre de lancement estimée avec un atterrissage accepté pour le mois et l’année sélectionnés.', range: 'Dates UTC · février 1962–décembre 2100', samples: 'échantillons', markers: 'repères quotidiens' },
  pt: { year: 'Ano', month: 'Mês', day: 'Dia', loading: 'Calculando o mês selecionado…', empty: 'Não há janelas de lançamento estimadas com pousos aceitos para o mês e ano selecionados.', range: 'Datas UTC · fevereiro de 1962–dezembro de 2100', samples: 'amostras', markers: 'marcadores diários' },
  it: { year: 'Anno', month: 'Mese', day: 'Giorno', loading: 'Calcolo del mese selezionato…', empty: 'Nessuna finestra di lancio stimata con atterraggio accettato per il mese e l’anno selezionati.', range: 'Date UTC · febbraio 1962–dicembre 2100', samples: 'campioni', markers: 'indicatori giornalieri' },
};
