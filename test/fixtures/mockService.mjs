export const orders = Array.from({ length: 43 }, (_, i) => ({ SalesOrder: String(5000000 + i), SalesOrderType: 'OR', SoldToParty: '1000001', SalesOrganization: '1010', TotalNetAmount: (1250 + i * 85).toFixed(2), TransactionCurrency: 'USD' }));
export const items = orders.flatMap(order => [10, 20].map(number => ({ SalesOrder: order.SalesOrder, SalesOrderItem: String(number), Material: 'DEMO-' + number, SalesOrderItemText: number === 10 ? 'Industrial sensor' : 'Mounting kit', RequestedQuantity: '2', RequestedQuantityUnit: 'PC' })));
export const partners = items.flatMap(item => ['AG', 'WE', 'RE', 'RG', 'WE'].map((role, index) => ({ SalesOrder: item.SalesOrder, SalesOrderItem: item.SalesOrderItem, PartnerFunction: role, Customer: String(1000001 + index), Supplier: index === 2 ? '2000001' : '', Personnel: index === 3 ? '3000001' : '', ContactPerson: index === 4 ? '4000001' : '' })));
const partnerTypes = { A_Customer: ['Customer', 'CustomerName'], A_Supplier: ['Supplier', 'SupplierName'], A_BusinessPartner: ['BusinessPartner', 'BusinessPartnerFullName'] };
export const partnerMetadata = `<?xml version="1.0"?><edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"><edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"><Schema Namespace="API_BUSINESS_PARTNER" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">${Object.entries(partnerTypes).map(([type, fields]) => `<EntityType Name="${type}Type"><Key><PropertyRef Name="${fields[0]}"/></Key>${fields.map(field => `<Property Name="${field}" Type="Edm.String"/>`).join('')}</EntityType>`).join('')}<EntityContainer Name="Container" m:IsDefaultEntityContainer="true">${Object.keys(partnerTypes).map(type => `<EntitySet Name="${type}" EntityType="API_BUSINESS_PARTNER.${type}Type"/>`).join('')}</EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`;
export function mockPartnerResponse(pathname) {
  const match = decodeURIComponent(pathname).match(/^(A_Customer|A_Supplier|A_BusinessPartner)\('([^']+)'\)$/);
  if (!match) return { status: 404, body: { error: { message: 'Unknown partner resource' } } };
  const [key, name] = partnerTypes[match[1]];
  const names = { '1000001': 'Northstar Industries', '1000002': 'Westfield Distribution', '1000003': 'Harbor Manufacturing', '1000004': 'Summit Components', '1000005': 'Riverbend Services', '2000001': 'Atlas Supply' };
  return { status: 200, body: { d: { [key]: match[2], [name]: names[match[2]] || 'Demo business partner' } } };
}
const definitions = {
  A_SalesOrder: ['SalesOrder', 'SalesOrderType', 'SoldToParty', 'SalesOrganization', 'TotalNetAmount', 'TransactionCurrency'],
  A_SalesOrderItem: ['SalesOrder', 'SalesOrderItem', 'Material', 'SalesOrderItemText', 'RequestedQuantity', 'RequestedQuantityUnit'],
  A_SalesOrderItemPartner: ['SalesOrder', 'SalesOrderItem', 'PartnerFunction', 'Customer', 'Supplier', 'Personnel', 'ContactPerson']
};
export const metadata = `<?xml version="1.0" encoding="utf-8"?><edmx:Edmx Version="1.0" xmlns:edmx="http://schemas.microsoft.com/ado/2007/06/edmx"><edmx:DataServices m:DataServiceVersion="2.0" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata"><Schema Namespace="API_SALES_ORDER_SRV" xmlns="http://schemas.microsoft.com/ado/2008/09/edm">${Object.entries(definitions).map(([name, fields]) => `<EntityType Name="${name}Type"><Key>${fields.slice(0, name === 'A_SalesOrder' ? 1 : name === 'A_SalesOrderItem' ? 2 : 4).map(f => `<PropertyRef Name="${f}"/>`).join('')}</Key>${fields.map(f => `<Property Name="${f}" Type="Edm.String"/>`).join('')}${name === 'A_SalesOrder' ? '<NavigationProperty Name="to_Item" Relationship="API_SALES_ORDER_SRV.OrderItems" FromRole="Order" ToRole="Items"/>' : name === 'A_SalesOrderItem' ? '<NavigationProperty Name="to_Partner" Relationship="API_SALES_ORDER_SRV.ItemPartners" FromRole="Item" ToRole="Partners"/>' : ''}</EntityType>`).join('')}<Association Name="OrderItems"><End Type="API_SALES_ORDER_SRV.A_SalesOrderType" Role="Order" Multiplicity="1"/><End Type="API_SALES_ORDER_SRV.A_SalesOrderItemType" Role="Items" Multiplicity="*"/></Association><Association Name="ItemPartners"><End Type="API_SALES_ORDER_SRV.A_SalesOrderItemType" Role="Item" Multiplicity="1"/><End Type="API_SALES_ORDER_SRV.A_SalesOrderItemPartnerType" Role="Partners" Multiplicity="*"/></Association><EntityContainer Name="Container" m:IsDefaultEntityContainer="true">${Object.keys(definitions).map(name => `<EntitySet Name="${name}" EntityType="API_SALES_ORDER_SRV.${name}Type"/>`).join('')}<AssociationSet Name="OrderItems" Association="API_SALES_ORDER_SRV.OrderItems"><End Role="Order" EntitySet="A_SalesOrder"/><End Role="Items" EntitySet="A_SalesOrderItem"/></AssociationSet><AssociationSet Name="ItemPartners" Association="API_SALES_ORDER_SRV.ItemPartners"><End Role="Item" EntitySet="A_SalesOrderItem"/><End Role="Partners" EntitySet="A_SalesOrderItemPartner"/></AssociationSet></EntityContainer></Schema></edmx:DataServices></edmx:Edmx>`;

export function mockResponse(pathname, query = new URLSearchParams()) {
  const decoded = decodeURIComponent(pathname);
  let data;
  if (decoded === 'A_SalesOrder') {
    data = [...orders];
    const filter = query.get('$filter');
    if (filter) {
      const term = filter.match(/^substringof\('((?:[^']|'')*)',SalesOrder\)$/);
      if (!term) return { status: 400, body: { error: { message: 'Unsupported filter' } } };
      data = data.filter(row => row.SalesOrder.includes(term[1].replace(/''/g, "'")));
    }
    if (query.get('$orderby') === 'SalesOrder desc') data.reverse();
  } else {
    const order = decoded.match(/^A_SalesOrder\('([^']+)'\)\/to_Item$/);
    const item = decoded.match(/^A_SalesOrderItem\(SalesOrder='([^']+)',SalesOrderItem='([^']+)'\)\/to_Partner$/);
    if (order) data = items.filter(row => row.SalesOrder === order[1]);
    else if (item) data = partners.filter(row => row.SalesOrder === item[1] && row.SalesOrderItem === item[2]);
    else return { status: 404, body: { error: { message: 'Unknown resource' } } };
  }
  const skip = Number(query.get('$skip') || 0), top = Number(query.get('$top') || 100);
  return { status: 200, body: { d: { results: data.slice(skip, skip + top) } } };
}
