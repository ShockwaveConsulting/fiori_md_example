(function (factory) {
  if (typeof sap !== 'undefined') { sap.ui.define([], factory); }
  else { module.exports = factory(); }
}(function () {
  'use strict';
  function quote(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }
  function orderPath(order) { return '/A_SalesOrder(' + quote(order) + ')'; }
  function itemPath(order, item) { return '/A_SalesOrderItem(SalesOrder=' + quote(order) + ',SalesOrderItem=' + quote(item) + ')'; }
  function read(model, path, parameters) {
    return new Promise(function (resolve, reject) { model.read(path, { urlParameters: parameters, success: resolve, error: reject }); });
  }
  async function enrichPartners(data, partnerModel) {
    var names = new Map();
    async function lookup(path, property) {
      if (!names.has(path)) {
        names.set(path, new Promise(function (resolve) {
          var request;
          var timer = setTimeout(function () { if (request && request.abort) { request.abort(); } resolve(''); }, 8000);
          function finish(value) { clearTimeout(timer); resolve(value || ''); }
          try {
            request = partnerModel.read(path, { urlParameters: { '$select': property }, success: function (row) { finish(row[property]); }, error: function () { finish(''); } });
          } catch (error) { finish(''); }
        }));
      }
      return names.get(path);
    }
    var results = await Promise.all(data.results.map(async function (partner) {
      var name = '';
      if (partnerModel) {
        if (partner.ReferenceBusinessPartner) { name = await lookup('/A_BusinessPartner(' + quote(partner.ReferenceBusinessPartner) + ')', 'BusinessPartnerFullName'); }
        if (!name && partner.Customer) { name = await lookup('/A_Customer(' + quote(partner.Customer) + ')', 'CustomerName'); }
        if (!name && partner.Supplier) { name = await lookup('/A_Supplier(' + quote(partner.Supplier) + ')', 'SupplierName'); }
      }
      return Object.assign({}, partner, { PartnerName: name || 'Name unavailable' });
    }));
    return Object.assign({}, data, { results: results });
  }
  return {
    orderPath: orderPath, itemPath: itemPath, enrichPartners: enrichPartners,
    listOrders: function (model, search, skip, pageSize, descending) {
      var query = { '$select': 'SalesOrder,SalesOrderType,SoldToParty,SalesOrganization,TotalNetAmount,TransactionCurrency', '$top': String(pageSize + 1), '$skip': String(skip), '$orderby': 'SalesOrder ' + (descending ? 'desc' : 'asc') };
      if (search) { query.$filter = 'substringof(' + quote(search) + ',SalesOrder)'; }
      return read(model, '/A_SalesOrder', query);
    },
    listItems: function (model, order) { return read(model, orderPath(order) + '/to_Item', { '$select': 'SalesOrder,SalesOrderItem,Material,SalesOrderItemText,RequestedQuantity,RequestedQuantityUnit', '$top': '100' }); },
    listPartners: async function (model, order, item, partnerModel) {
      return enrichPartners(await read(model, itemPath(order, item) + '/to_Partner', {}), partnerModel);
    },
    followNext: function (model, next) {
      var prefix = '/sap/opu/odata/sap/API_SALES_ORDER_SRV';
      var url = new URL(next, 'https://local.invalid' + prefix + '/');
      var index = url.pathname.indexOf(prefix + '/');
      if (index < 0) { return Promise.reject(new Error('Invalid continuation path')); }
      return read(model, url.pathname.slice(index + prefix.length), Object.fromEntries(url.searchParams));
    }
  };
}));
