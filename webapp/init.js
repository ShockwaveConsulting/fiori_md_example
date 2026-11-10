sap.ui.define(['sap/ui/core/ComponentContainer'], function (ComponentContainer) {
  'use strict';
  new ComponentContainer({ name: 'sales.orders', manifest: true, async: true, height: '100%' }).placeAt('content');
});
