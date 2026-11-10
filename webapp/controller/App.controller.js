sap.ui.define(['sap/ui/core/mvc/Controller', 'sap/ui/model/json/JSONModel', '../model/salesOrderService'], function (Controller, JSONModel, service) {
  'use strict';
  return Controller.extend('sales.orders.controller.App', {
    onInit: function () {
      this.state = new JSONModel({ orders: [], items: [], partners: [], busy: false, error: '', skip: 0, hasNext: false, pageLabel: 'Page 1', mode: 'Connecting', selectedOrder: {}, selectedItem: {} });
      this.getView().setModel(this.state, 'state');
      this.state.setSizeLimit(100000);
      this.search = ''; this.pageSize = 20; this.requestId = 0;
      fetch('/app-config.json').then(function (r) { return r.json(); }).then(function (config) { this.state.setProperty('/mode', config.mock ? 'Demo data' : 'SAP sandbox'); }.bind(this)).catch(function () { this.state.setProperty('/mode', 'Service'); }.bind(this));
      this.getOwnerComponent().getModel().attachMetadataFailed(function () { this.state.setProperty('/error', 'Metadata unavailable. Check the connection and API key, or restart using npm run start:mock.'); }.bind(this));
      this.loadOrders();
    },
    run: async function (task) {
      var id = ++this.requestId;
      this.state.setProperty('/busy', true); this.state.setProperty('/error', '');
      try { var result = await task(); if (id === this.requestId) { return result; } }
      catch (error) { if (id === this.requestId) { this.state.setProperty('/error', 'Unable to load data' + (error.statusCode ? ' (HTTP ' + error.statusCode + ')' : '') + '. Check connectivity and service authorization, then retry.'); } }
      finally { if (id === this.requestId) { this.state.setProperty('/busy', false); } }
    },
    loadOrders: async function () {
      var data = await this.run(function () { return service.listOrders(this.getOwnerComponent().getModel(), this.search, this.state.getProperty('/skip'), this.pageSize, this.descending); }.bind(this));
      if (!data) { return; }
      this.state.setProperty('/orders', data.results.slice(0, this.pageSize));
      this.state.setProperty('/hasNext', data.results.length > this.pageSize || !!data.__next);
      this.state.setProperty('/pageLabel', 'Page ' + (this.state.getProperty('/skip') / this.pageSize + 1));
    },
    onSearch: function (event) { this.search = event.getParameter('query').trim(); this.state.setProperty('/skip', 0); this.loadOrders(); },
    onSort: function () { this.descending = !this.descending; this.state.setProperty('/skip', 0); this.loadOrders(); },
    onRefresh: function () { this.loadOrders(); },
    onNext: function () { this.state.setProperty('/skip', this.state.getProperty('/skip') + this.pageSize); this.loadOrders(); },
    onPrevious: function () { this.state.setProperty('/skip', Math.max(0, this.state.getProperty('/skip') - this.pageSize)); this.loadOrders(); },
    onOrderPress: async function (event) {
      var order = event.getSource().getBindingContext('state').getObject();
      this.state.setProperty('/selectedOrder', order); this.state.setProperty('/items', []); this.state.setProperty('/itemsNext', '');
      this.byId('navigation').to(this.byId('itemsPage'));
      var data = await this.run(function () { return service.listItems(this.getOwnerComponent().getModel(), order.SalesOrder); }.bind(this));
      if (data) { this.state.setProperty('/items', data.results); this.state.setProperty('/itemsNext', data.__next || ''); }
    },
    onItemPress: async function (event) {
      var item = event.getSource().getBindingContext('state').getObject();
      this.state.setProperty('/selectedItem', item); this.state.setProperty('/partners', []); this.state.setProperty('/partnersNext', '');
      this.byId('navigation').to(this.byId('partnersPage'));
      var data = await this.run(function () { return service.listPartners(this.getOwnerComponent().getModel(), item.SalesOrder, item.SalesOrderItem, this.getOwnerComponent().getModel('businessPartners')); }.bind(this));
      if (data) { this.state.setProperty('/partners', data.results); this.state.setProperty('/partnersNext', data.__next || ''); }
    },
    more: async function (name) {
      var data = await this.run(async function () {
        var page = await service.followNext(this.getOwnerComponent().getModel(), this.state.getProperty('/' + name + 'Next'));
        return name === 'partners' ? service.enrichPartners(page, this.getOwnerComponent().getModel('businessPartners')) : page;
      }.bind(this));
      if (data) { this.state.setProperty('/' + name, this.state.getProperty('/' + name).concat(data.results)); this.state.setProperty('/' + name + 'Next', data.__next || ''); }
    },
    onMoreItems: function () { this.more('items'); },
    onMorePartners: function () { this.more('partners'); },
    onBackToOrders: function () { this.requestId++; this.state.setProperty('/busy', false); this.byId('navigation').backToPage(this.byId('ordersPage')); },
    onBackToItems: function () { this.requestId++; this.state.setProperty('/busy', false); this.byId('navigation').backToPage(this.byId('itemsPage')); }
  });
});
