import test from 'node:test';
import assert from 'node:assert/strict';
import service from '../webapp/model/salesOrderService.js';
import { createServer, servicePath, partnerServicePath } from '../server.mjs';
import { mockResponse, mockPartnerResponse } from './fixtures/mockService.mjs';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

function model() {
  return { read(path, options) {
    const result = mockResponse(path.slice(1), new URLSearchParams(options.urlParameters));
    if (result.status === 200) options.success(result.body.d); else options.error(result.body.error);
  } };
}
function partnerModel() {
  return { read(path, options) {
    const result = mockPartnerResponse(path.slice(1));
    if (result.status === 200) options.success(result.body.d); else options.error(result.body.error);
  } };
}
test('item partner navigation displays resolved names and supplier, personnel and contact identifiers', async () => {
  const data = await service.listPartners(model(), '5000000', '10', partnerModel());
  assert.equal(data.results[0].PartnerName, 'Northstar Industries');
  assert.equal(data.results[2].Supplier, '2000001');
  assert.equal(data.results[3].Personnel, '3000001');
  assert.equal(data.results[4].ContactPerson, '4000001');
  assert.ok(data.results.every(row => row.SalesOrderItem === '10'));
});
test('partner enrichment resolves reference BP and supplier names and reuses repeated lookups', async () => {
  const paths = [];
  const lookup = { read(path, options) { paths.push(path); partnerModel().read(path, options); } };
  const data = await service.enrichPartners({ results: [
    { ReferenceBusinessPartner: '1000001' }, { ReferenceBusinessPartner: '1000001' }, { Supplier: '2000001' }, { Personnel: '123', ContactPerson: '456' }
  ], __next: 'next-page' }, lookup);
  assert.deepEqual(data.results.map(row => row.PartnerName), ['Northstar Industries', 'Northstar Industries', 'Atlas Supply', 'Name unavailable']);
  assert.equal(paths.length, 2);
  assert.equal(data.__next, 'next-page');
});
test('failed name lookup preserves partner assignments and identifiers', async () => {
  const data = await service.listPartners(model(), '5000000', '10', { read(path, options) { options.error({ statusCode: '403' }); } });
  assert.equal(data.results.length, 5);
  assert.ok(data.results.every(row => row.PartnerName === 'Name unavailable'));
  assert.equal(data.results[2].Supplier, '2000001');
});
test('consumes sales orders with server-side filtering, sorting and paging', async () => {
  const first = await service.listOrders(model(), '', 0, 20, false);
  const second = await service.listOrders(model(), '', 20, 20, false);
  assert.equal(first.results.length, 21);
  assert.notEqual(first.results[0].SalesOrder, second.results[0].SalesOrder);
  assert.equal((await service.listOrders(model(), '5000001', 0, 20, false)).results.length, 1);
  assert.equal((await service.listOrders(model(), 'missing', 0, 20, false)).results.length, 0);
  assert.equal((await service.listOrders(model(), '', 0, 20, true)).results[0].SalesOrder, '5000042');
});
test('consumes items belonging only to the selected sales order', async () => {
  const data = await service.listItems(model(), '5000001');
  assert.equal(data.results.length, 2);
  assert.ok(data.results.every(item => item.SalesOrder === '5000001'));
});
test('navigates order to item to item partners', async () => {
  const order = (await service.listOrders(model(), '', 0, 20, false)).results[0];
  const item = (await service.listItems(model(), order.SalesOrder)).results[0];
  const data = await service.listPartners(model(), order.SalesOrder, item.SalesOrderItem);
  assert.ok(data.results.every(partner => partner.SalesOrder === order.SalesOrder && partner.SalesOrderItem === item.SalesOrderItem));
});
test('shows all item partner assignments, including repeated functions', async () => {
  const data = await service.listPartners(model(), '5000000', '10');
  assert.equal(data.results.length, 5);
  assert.equal(data.results.filter(partner => partner.PartnerFunction === 'WE').length, 2);
});
test('escapes OData string keys and follows paging links within the service', async () => {
  assert.equal(service.orderPath("O'1"), "/A_SalesOrder('O''1')");
  let request;
  await service.followNext({ read(path, options) { request = { path, query: options.urlParameters }; options.success({ results: [] }); } }, 'https://sandbox.api.sap.com/s4hanacloud' + servicePath + 'A_SalesOrder?$skiptoken=next');
  assert.equal(request.path, '/A_SalesOrder');
  assert.equal(request.query.$skiptoken, 'next');
  await assert.rejects(service.followNext(model(), 'https://example.com/unrelated'));
});
test('proxy injects credentials server-side and rejects writes', async () => {
  let upstreamHeaders;
  let upstreamUrl;
  const server = createServer({ apiKey: 'test-secret', fetchImpl: async (url, options) => { upstreamUrl = url; upstreamHeaders = options.headers; return new Response('{"d":{"results":[]}}', { headers: { 'content-type': 'application/json' } }); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const response = await fetch(base + servicePath + 'A_SalesOrder');
    assert.equal(response.status, 200);
    assert.equal(upstreamHeaders.APIKey, 'test-secret');
    assert.ok(!(await response.text()).includes('test-secret'));
    assert.equal((await fetch(base + partnerServicePath + "A_Customer('1000001')")).status, 200);
    assert.ok(upstreamUrl.includes('/API_BUSINESS_PARTNER/A_Customer'));
    assert.equal(upstreamHeaders.APIKey, 'test-secret');
    assert.equal((await fetch(base + servicePath, { method: 'POST' })).status, 405);
    assert.equal((await fetch(base + '/.env.local')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('service errors propagate to callers', async () => {
  await assert.rejects(service.listItems({ read(path, options) { options.error(new Error('Unauthorized')); } }, '1'), /Unauthorized/);
});
test('mock HTTP service exposes metadata, ordered pages and item partners', async () => {
  const server = createServer({ mock: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + server.address().port;
    const metadata = await fetch(base + servicePath + '$metadata');
    assert.match(await metadata.text(), /NavigationProperty Name="to_Partner"/);
    const response = await fetch(base + servicePath + "A_SalesOrderItem(SalesOrder='5000000',SalesOrderItem='10')/to_Partner");
    assert.equal((await response.json()).d.results.length, 5);
    assert.equal((await fetch(base + '/manifest.json')).status, 200);
    const name = await fetch(base + partnerServicePath + "A_Customer('1000001')");
    assert.equal((await name.json()).d.CustomerName, 'Northstar Industries');
    const partnerMetadata = await fetch(base + partnerServicePath + '$metadata');
    assert.match(await partnerMetadata.text(), /BusinessPartnerFullName/);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('controller navigates forward and back while retaining the selected entities', async () => {
  let controller;
  const source = await readFile('webapp/controller/App.controller.js', 'utf8');
  vm.runInNewContext(source, { sap: { ui: { define(deps, factory) { factory({ extend(name, methods) { controller = methods; } }, null, service); } } } });
  const values = {};
  const pages = [];
  const instance = { ...controller, requestId: 0,
    state: { setProperty(key, value) { values[key] = value; }, getProperty(key) { return values[key]; } },
    getOwnerComponent() { return { getModel(name) { return name === 'businessPartners' ? partnerModel() : model(); } }; },
    byId(id) { return id === 'navigation' ? { to(page) { pages.push(page); }, backToPage(page) { pages.push(page); } } : id; }
  };
  function event(value) { return { getSource() { return { getBindingContext() { return { getObject() { return value; } }; } }; } }; }
  await instance.onOrderPress(event({ SalesOrder: '5000000' }));
  await instance.onItemPress(event(values['/items'][0]));
  assert.equal(values['/partners'].length, 5);
  assert.equal(values['/partners'][0].PartnerName, 'Northstar Industries');
  instance.onBackToItems(); instance.onBackToOrders();
  assert.deepEqual(pages, ['itemsPage', 'partnersPage', 'itemsPage', 'ordersPage']);
  assert.equal(values['/selectedOrder'].SalesOrder, '5000000');
});
