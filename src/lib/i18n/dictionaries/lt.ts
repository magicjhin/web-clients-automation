/**
 * lt.ts — литовский словарь. Форма обязана совпадать с ru.ts (тип Dictionary).
 */
import type { Dictionary } from '../dictionaries';

export const lt: Dictionary = {
  common: {
    soon: 'netrukus',
    logout: 'Atsijungti',
    settings: 'Nustatymai',
    openMenu: 'Atidaryti meniu',
    mainNav: 'Pagrindinė navigacija',
  },
  language: {
    label: 'Kalba',
  },
  nav: {
    overview: 'Apžvalga',
    leads: 'Lidai',
    review: 'Peržiūra',
    base: 'Bazė',
    analytics: 'Analitika',
    outreach: 'Laiškai',
    crm: 'CRM',
    settings: 'Nustatymai',
  },
  periods: {
    ariaLabel: 'Laikotarpis',
    all: 'Visą laiką',
    last90: 'Paskutinės 90 dienų',
    last30: 'Paskutinės 30 dienų',
    last7: 'Paskutinės 7 dienos',
  },
  cockpit: {
    welcomeBack: 'Sveiki sugrįžę',
    subtitle: 'Ką nuveikti šiandien ir rezultatai',
    todo: 'Ką nuveikti',
    processLeads: 'Apdoroti pateiktus lidus',
    processLeadsHint: '{count} darbe · auditas + laiškas vienu paspaudimu',
    call: 'Paskambinti',
    callAria: 'Paskambinti {name}',
    remindersHint:
      'Priminimai apie perskambinimus ir sandorių užduotis atsiras su CRM.',
    todayLeads: 'Šiandienos lidai',
    allDelivered: 'Visi pateikti',
    noLeadsToday: 'Šiandien lidų nėra.',
    noPhone: 'Nėra telefono',
    periodNote:
      '„Laiškai / Auditai / Atsakymai / Sandoriai“ bus užpildyti prijungus generavimą (Claude + PageSpeed) ir siuntimą.',
  },
  analyticsCard: {
    processing: 'Apdorojimas',
    results: 'Rezultatai',
    processed: 'Apdorota',
    emailsSent: 'Išsiųsta laiškų',
    audits: 'Auditų',
    replied: 'Atsakė',
    notReplied: 'Neatsakė',
    deals: 'Sandoriai',
  },
  leadAction: {
    process: 'Apdoroti',
    processLead: 'Apdoroti lidą',
    dialogIntro: 'Vienas mygtukas „{company}“ paleis visą grandinę:',
    step1: 'Svetainės auditas (PageSpeed + problemos)',
    step2: 'Audito ataskaita',
    step3: 'Pasiūlymo laiškas (lietuvių k.)',
    resultNote:
      'Paruošti auditas ir laiškas pateks į skiltį „Peržiūra“ — ten patvirtini siuntimą. Paleidimas prisijungs su generavimu (Claude + PageSpeed).',
    run: 'Paleisti (prisijungs netrukus)',
  },
};
