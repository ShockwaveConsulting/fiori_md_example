import { cp, mkdir, readFile } from 'node:fs/promises';
const manifest = JSON.parse(await readFile('webapp/manifest.json', 'utf8'));
if (manifest['sap.app'].dataSources.mainService.settings.odataVersion !== '2.0') throw new Error('OData V2 required');
await mkdir('dist', { recursive: true });
await cp('webapp', 'dist', { recursive: true });
console.log('Built browser assets in dist/. No environment files included.');
