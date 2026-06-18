/**
 * en.ts — английский словарь. Форма обязана совпадать с ru.ts (тип Dictionary).
 */
import type { Dictionary } from '../dictionaries';

export const en: Dictionary = {
  common: {
    soon: 'soon',
    logout: 'Log out',
    settings: 'Settings',
    openMenu: 'Open menu',
    mainNav: 'Main navigation',
  },
  language: {
    label: 'Language',
  },
  nav: {
    overview: 'Overview',
    leads: 'Leads',
    review: 'Review',
    base: 'Database',
    analytics: 'Analytics',
    outreach: 'Emails',
    crm: 'CRM',
    settings: 'Settings',
  },
  periods: {
    ariaLabel: 'Period',
    all: 'All time',
    last90: 'Last 90 days',
    last30: 'Last 30 days',
    last7: 'Last 7 days',
  },
  cockpit: {
    welcomeBack: 'Welcome back',
    subtitle: 'What to do today and your results',
    todo: 'To do',
    processLeads: 'Process assigned leads',
    processLeadsHint: '{count} in progress · audit + email in one click',
    call: 'Call',
    callAria: 'Call {name}',
    remindersHint:
      'Reminders for callbacks and deal tasks will appear with CRM.',
    todayLeads: "Today's leads",
    allDelivered: 'All assigned',
    noLeadsToday: 'No leads for today.',
    noPhone: 'No phone',
    periodNote:
      '“Emails / Audits / Replies / Deals” will populate once generation (Claude + PageSpeed) and sending are connected.',
  },
  analyticsCard: {
    processing: 'Processing',
    results: 'Results',
    processed: 'Processed',
    emailsSent: 'Emails sent',
    audits: 'Audits',
    replied: 'Replied',
    notReplied: 'No reply',
    deals: 'Deals',
  },
  leadAction: {
    process: 'Process',
    processLead: 'Process lead',
    dialogIntro: 'One button for “{company}” runs the whole chain:',
    step1: 'Site audit (PageSpeed + issues)',
    step2: 'Audit report',
    step3: 'Offer email (Lithuanian)',
    resultNote:
      'The finished audit and email land in the “Review” section — you confirm sending there. Launch will connect with generation (Claude + PageSpeed).',
    run: 'Launch (connects soon)',
  },
};
