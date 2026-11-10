# Repository Guidelines

## Project Structure & Module Organization

`webapp/` contains the SAPUI5 component, manifest, views, controller, and OData adapter. `server.mjs` serves local assets and proxies the sandbox. `test/` contains synthetic data and unit/integration tests; `scripts/` contains metadata retrieval and packaging tools.

Keep application code, automated tests, and static assets in clearly named directories. If this becomes a multi-application project, give each application its own directory and document shared modules explicitly. Avoid committing generated output or dependency directories.

## Build, Test, and Development Commands

Use Node.js 22.9 or newer. `npm run start:mock` runs synthetic demo data; `npm start` runs the sandbox proxy using `.env.local`. `npm run metadata` downloads the sandbox contract. `npm test` runs Node tests, and `npm run build` copies browser assets into `dist/`. See `README.md` for connection limitations and deployment setup.

For a Node.js application, prefer package scripts such as `npm run dev`, `npm run build`, and `npm test` once those scripts actually exist. Commit the dependency lockfile and record the supported runtime version. Do not assume that globally installed tools are available to other contributors.

## Coding Style & Naming Conventions

Follow the conventions for javascript best practices, including but not limited to camelCase for variables, functions, module names.

## Testing Guidelines

Include unit test for consuming a list of sales orders. 
Include unit test for consuming a list of items belonging to a sales order.
Include unit test for navigating between sales order, item and item partner.
Include unit test for showing all business partnes for sales order items.

## Commit & Pull Request Guidelines

Use gitrepo: https://github.com/ShockwaveConsulting/fiori_md_example

create a dev branch apart from main to hold the initial repo.

allow developer to commit manually afterwards.


## Security & Configuration

Keep secrets and local credentials out of version control. Provide example configuration with placeholder values, and ignore local environment files and generated artifacts when initializing the project.
## Sales Order API Integration

### Goal and Service Contract

Build a SAP Fiori application consuming Sales Order (A2X, OData V2), initially for read-only sales order browsing and item details.

- Service root: `/sap/opu/odata/sap/API_SALES_ORDER_SRV/`.
- Metadata: `/sap/opu/odata/sap/API_SALES_ORDER_SRV/$metadata`.
- API reference: https://api.sap.com/api/API_SALES_ORDER_SRV/overview
- Expected entity sets: `A_SalesOrder` and `A_SalesOrderItem`.
- Validate properties, keys, navigation paths, and entity sets against the target system's metadata before implementing bindings. Do not assume the Hub sandbox matches the tenant.

### Fiori Implementation

Use an SAPUI5 OData V2 model. Declare the relative service URI in `webapp/manifest.json` under `sap.app.dataSources` and configure the model under `sap.ui5.models`. For Fiori elements, supply local UI annotations where required.

Use server-side filtering, sorting, and paging; select only required properties and expand item data when needed. Provide loading, empty, and service-error states. Do not implement write operations unless requested.

### Connectivity and Credentials

Route local calls through the dependency-free development proxy in `server.mjs`; a Fiori tools proxy may replace it when tooling is introduced. Route deployed calls through a configured destination/approuter. Keep authentication and backend host configuration outside browser code. Confirm tenant communication arrangements and authorizations separately from Hub sandbox access.

The Hub sandbox key is stored locally as `SAP_API_HUB_API_KEY` in `.env.local`. Read it only in server-side or development-proxy configuration and send it as the sandbox's `APIKey` request header. Never print it, embed it in browser assets, or commit it. Environment files are not loaded automatically by SAPUI5; configure the selected proxy/runtime to load the value. Do not send the sandbox key to the S/4HANA tenant.

### Validation

Verify metadata retrieval, order listing, item navigation, filtering, paging, empty results, and authorization failures. Use sanitized mock data when disconnected. Document destination setup and actual run commands in `README.md`.
