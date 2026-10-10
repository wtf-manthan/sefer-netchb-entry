import {writeFileSync} from 'node:fs';
import {fixture,field} from '../../server/test/fixtures';
const {shipment,decisions}=fixture();
shipment.invoices[0].lines[0].description=field('Synthetic wooden chair — UI testing only');
shipment.modeOfTransport={...field('10'),status:'inferred'};
writeFileSync('experiments/frontend-review/session.json',JSON.stringify({reviewVersion:1,shipmentData:shipment,brokerDecisions:decisions},null,2));
console.log('Wrote synthetic review fixture; no API calls.');
