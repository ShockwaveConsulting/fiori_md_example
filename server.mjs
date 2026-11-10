import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mockResponse, metadata, partnerMetadata, mockPartnerResponse } from './test/fixtures/mockService.mjs';

export const servicePath = '/sap/opu/odata/sap/API_SALES_ORDER_SRV/';
export const partnerServicePath = '/sap/opu/odata/sap/API_BUSINESS_PARTNER/';
const sandbox = 'https://sandbox.api.sap.com/s4hanacloud/sap/opu/odata/sap/API_SALES_ORDER_SRV/';
const root = path.resolve('webapp');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml', '.css': 'text/css' };

export function createServer({ mock = false, upstream = sandbox, apiKey = process.env.SAP_API_HUB_API_KEY, fetchImpl = fetch } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    try {
      if (req.method !== 'GET') { res.writeHead(405); return res.end('Read-only application'); }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/app-config.json') { res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ mock })); }
      const isPartner = url.pathname.startsWith(partnerServicePath);
      const requestServicePath = isPartner ? partnerServicePath : servicePath;
      if (url.pathname.startsWith(requestServicePath)) {
        if (mock) {
          if (url.pathname === requestServicePath + '$metadata') { res.setHeader('Content-Type', 'application/xml'); return res.end(isPartner ? partnerMetadata : metadata); }
          const result = isPartner ? mockPartnerResponse(url.pathname.slice(requestServicePath.length)) : mockResponse(url.pathname.slice(servicePath.length), url.searchParams);
          res.writeHead(result.status, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify(result.body));
        }
        if (!apiKey) { res.writeHead(503); return res.end('Set SAP_API_HUB_API_KEY in .env.local or use npm run start:mock'); }
        if (new URL(upstream).origin !== new URL(sandbox).origin) throw new Error('Sandbox proxy only supports the SAP sandbox host');
        const targetRoot = isPartner ? sandbox.replace('API_SALES_ORDER_SRV/', 'API_BUSINESS_PARTNER/') : upstream;
        const response = await fetchImpl(targetRoot + url.pathname.slice(requestServicePath.length) + url.search, {
          headers: { APIKey: apiKey, Accept: req.headers.accept || 'application/json' },
          redirect: 'error', signal: AbortSignal.timeout(30000)
        });
        res.writeHead(response.status, { 'Content-Type': response.headers.get('content-type') || 'application/json', 'Cache-Control': 'no-store' });
        return res.end(Buffer.from(await response.arrayBuffer()));
      }
      const filename = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
      if (!filename.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
      res.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
      res.end(await readFile(filename));
    } catch (error) {
      const missing = error.code === 'ENOENT';
      res.writeHead(missing ? 404 : 502, { 'Content-Type': 'text/plain' });
      res.end(missing ? 'Not found' : 'Service request failed. Check connectivity and configuration.');
    }
  });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mock = process.argv.includes('--mock');
  createServer({ mock }).listen(Number(process.env.PORT || 8080), '127.0.0.1', () => console.log(`Sales Orders: http://localhost:${process.env.PORT || 8080} (${mock ? 'mock' : 'SAP sandbox'})`));
}
