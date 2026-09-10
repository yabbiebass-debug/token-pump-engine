export const STAGES = ['SCOUT', 'QUALIFY', 'PITCH', 'CLOSE', 'BUILD', 'SHIP', 'SUPPORT', 'REINVEST'];
export const GATED = new Set(['PITCH', 'CLOSE', 'SHIP']);
export const LEAD_STAGES = ['SCOUT', 'QUALIFY', 'PITCH', 'CLOSE', 'BUILD', 'SHIP', 'SUPPORT', 'LOST'];
export const SOL_RECIPIENT = 'HTN1fvHwbzKiMwh9YXZEe3eooiMdoCAs3TweWdiSZV5i';
export const TOKEN_MINT = '7cnu3w5SbTxCrYTPavBJ7dib4Bdnf6mN5AG98xzDpump';
export const PROMO_CODE = 'PULSE250';

export const NICHES = [
  'Recreation & Outdoors', 'Gaming & Modding', 'Creators & Media', 'Commerce & Marketplaces', 'Education & Learning',
  'Science & Research', 'Health, Fitness & Wellbeing', 'Finance & Crypto', 'Home, DIY & Makers', 'Local Business & Services',
];

export const INDUSTRY_DEFAULTS = {
  'Recreation & Outdoors': { typicalLeads: 900, avgDeal: 12, hoursAdmin: 20, systemName: 'Trip, Roster & Gear-Share Platform', integrations: ['Mapbox / OpenStreetMap', 'Stripe', 'Discord', 'iCal'] },
  'Gaming & Modding': { typicalLeads: 2400, avgDeal: 8, hoursAdmin: 24, systemName: 'Community Server & Mod Toolkit', integrations: ['Steam Web API', 'Discord', 'GitHub Releases', 'Cloudflare'] },
  'Creators & Media': { typicalLeads: 1200, avgDeal: 15, hoursAdmin: 18, systemName: 'Creator Publishing & Storefront Stack', integrations: ['YouTube / Twitch APIs', 'Stripe', 'S3 / R2', 'Resend'] },
  'Commerce & Marketplaces': { typicalLeads: 650, avgDeal: 40, hoursAdmin: 22, systemName: 'Niche Storefront & Inventory Engine', integrations: ['Medusa / Saleor', 'Stripe', 'Shippo', 'Meilisearch'] },
  'Education & Learning': { typicalLeads: 800, avgDeal: 25, hoursAdmin: 16, systemName: 'Course, Cohort & Certification Platform', integrations: ['Moodle / Open edX', 'Stripe', 'Zoom / Jitsi', 'Postgres'] },
  'Science & Research': { typicalLeads: 300, avgDeal: 60, hoursAdmin: 14, systemName: 'Data Pipeline & Lab Notebook Suite', integrations: ['Jupyter', 'DuckDB', 'Zenodo', 'GitHub Actions'] },
  'Health, Fitness & Wellbeing': { typicalLeads: 1100, avgDeal: 18, hoursAdmin: 17, systemName: 'Coaching, Booking & Progress Tracker', integrations: ['Cal.com', 'Stripe', 'Apple Health / Google Fit', 'Twilio'] },
  'Finance & Crypto': { typicalLeads: 500, avgDeal: 45, hoursAdmin: 19, systemName: 'Portfolio, Treasury & Reporting Dashboard', integrations: ['Solana / EVM RPC', 'Plaid', 'Ledger CSV import', 'Grafana'] },
  'Home, DIY & Makers': { typicalLeads: 700, avgDeal: 20, hoursAdmin: 15, systemName: 'Home Ops & Maker Project Hub', integrations: ['Home Assistant', 'OctoPrint', 'MQTT', 'SQLite'] },
  'Local Business & Services': { typicalLeads: 400, avgDeal: 90, hoursAdmin: 21, systemName: 'Booking, Quoting & CRM Operating System', integrations: ['Cal.com', 'Stripe / PayPal', 'Xero / QuickBooks', 'WhatsApp'] },
};

export function calculateAudit(industry, monthlyLeads, avgDealSize, manualHoursPerWeek) {
  const monthlyPaid = Math.round(monthlyLeads * 0.04);
  const annualLostRevenue = Math.round(monthlyPaid * avgDealSize * 12);
  const annualTimeCost = Math.round(manualHoursPerWeek * 50 * 65);
  const totalAnnualLeak = annualLostRevenue + annualTimeCost;
  const hoursReclaimedPerYear = Math.round(manualHoursPerWeek * 50 * 0.8);
  let recommendedPackage = 'Fork';
  if (totalAnnualLeak > 80000 || monthlyLeads > 1500) recommendedPackage = 'Forge';
  else if (totalAnnualLeak > 30000 || monthlyLeads > 600) recommendedPackage = 'Merge';
  const packageCost = { Forge: 6000, Merge: 2400, Fork: 900 }[recommendedPackage];
  const def = INDUSTRY_DEFAULTS[industry] || INDUSTRY_DEFAULTS['Recreation & Outdoors'];
  return {
    annualLostRevenue, annualTimeCost, totalAnnualLeak, hoursReclaimedPerYear, recommendedPackage,
    roiMultiplier: Math.max(Number((totalAnnualLeak / packageCost).toFixed(1)), 3.2),
    buybackContribution: Math.round(packageCost * 0.15),
    systemName: def.systemName, integrations: def.integrations,
  };
}

export const SEVERITY_TONE = {
  normal: 'text-dim border-line-subtle',
  gate: 'text-amber border-amber/40',
  success: 'text-green border-green/40',
  alert: 'text-red border-red/40',
};

export const LEDGER_TONE = {
  allocation: { label: 'ALLOCATION', cls: 'bg-purple/15 text-purple border-purple/40' },
  stage_tap: { label: 'STAGE TAP', cls: 'bg-panel3 text-dim border-line-subtle' },
  conversion: { label: 'CONVERSION', cls: 'bg-amber/10 text-amber border-amber/40' },
  injection: { label: 'INJECTION', cls: 'bg-green/10 text-green border-green/40' },
  delayed: { label: 'DELAYED', cls: 'bg-red/10 text-red border-red/40' },
};
