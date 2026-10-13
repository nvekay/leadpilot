// Creates the custom deal property LeadPilot needs in the connected HubSpot account. Safe to run again.
// Usage: pnpm --filter @leadpilot/api hubspot:setup
import { HubSpotCrm, LEAD_ID_PROPERTY } from '../src/crm/hubspot-crm.js';

const token = process.env.HUBSPOT_TOKEN;
if (!token) throw new Error('Set HUBSPOT_TOKEN in .env');
const created = await new HubSpotCrm(token).setup();
console.log(created ? `Created deal property ${LEAD_ID_PROPERTY}` : `Deal property ${LEAD_ID_PROPERTY} already exists`);
