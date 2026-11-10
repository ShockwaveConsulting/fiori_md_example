import { mkdir, writeFile } from 'node:fs/promises';
const root = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_SALES_ORDER_SRV/';
const response = await fetch(root + '$metadata', { headers: { APIKey: process.env.SAP_API_HUB_API_KEY }, signal: AbortSignal.timeout(30000) });
if (!response.ok) throw new Error(`Metadata request returned ${response.status}`);
await mkdir('webapp/localService', { recursive: true });
await writeFile('webapp/localService/metadata.xml', await response.text());
console.log('Saved sandbox metadata.');
