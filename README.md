# Sales Orders

Read-only SAPUI5 application for the Sales Order (A2X), OData V2 API. Browse and search orders, open their items, and inspect all returned item partner assignments. Built with the Horizon theme and responsive tables.

## Run locally

Requires Node.js 22.9 or newer. No npm dependencies are required.

```powershell
npm run start:mock
```

Open http://localhost:8080. Mock mode includes 43 synthetic orders and multiple partner assignments per item. The SAPUI5 runtime loads from `ui5.sap.com`, so an internet connection is required even in mock mode.

For the SAP Business Accelerator Hub sandbox, set `SAP_API_HUB_API_KEY` in `.env.local` using `.env.example` as a template, then run:

```powershell
npm run metadata
npm start
```

The server reads the key from the environment and adds the sandbox `APIKey` header. The browser uses only the relative `/sap/opu/odata/sap/API_SALES_ORDER_SRV/` path. Never place the key in the manifest or client code.

## Service validation

Live sandbox access was blocked by the implementation environment. The expected `A_SalesOrder`, `A_SalesOrderItem`, `to_Item`, and `to_Partner` contracts are provisional until validated against `webapp/localService/metadata.xml` downloaded by `npm run metadata`. Mock metadata is synthetic and is not proof of the tenant contract. Check partner fields and selected properties against your target release before live use.

Clicking an item reads `A_SalesOrderItem(SalesOrder='…',SalesOrderItem='…')/to_Partner`. The partner table shows name, function, customer, supplier, personnel, and contact person. Supplier, personnel, and contact person are the assignment's identifiers. Names come from the separate `API_BUSINESS_PARTNER` OData V2 model: `A_BusinessPartner/BusinessPartnerFullName` when a reference BP is supplied, otherwise `A_Customer/CustomerName` or `A_Supplier/SupplierName`. Names reflect master data, not document-specific address overrides. Personnel-only and contact-only assignments without a reference BP show `Name unavailable`. Lookup failures also retain the assignment with that fallback. Continuation pages receive the same enrichment.

The development proxy also routes `/sap/opu/odata/sap/API_BUSINESS_PARTNER/` to the SAP sandbox with the server-side key. Live name resolution requires access to that API; configure its destination route and authorization separately for a tenant. Name lookups time out after eight seconds per attempt and repeated IDs share a lookup within each page.

## Development

```powershell
npm test
npm run build
```

Tests cover order retrieval, item scoping, order/item/partner navigation, repeated partner functions, paging links, errors, and credential isolation. `build` copies browser assets to `dist`; it does not create a UI5 optimized preload bundle. The local server serves `webapp`.

- `webapp/`: UI5 component, manifest, XML view, controller, and service adapter.
- `server.mjs`: local read-only static server and development proxy.
- `test/`: synthetic fixtures and Node unit/integration tests.
- `scripts/`: metadata retrieval and static asset packaging.

The local proxy is a dependency-free alternative to the Fiori tools development proxy and binds only to localhost. It is not a production server. For a tenant deployment, configure a BTP destination with tenant-specific authentication and an approuter route mapping the relative service path to that destination. Do not forward the Hub sandbox key to a tenant. Hosting assets alone does not establish this route. No deployment or tenant authentication has been configured.

Git is initialized on `dev` with origin `https://github.com/ShockwaveConsulting/fiori_md_example.git`. No commits or pushes are performed automatically.
