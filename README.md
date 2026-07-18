# Fleet Budget Tracker & Invoice Manager

A lightweight employee operations app for managing a sustainability incentive program without living inside a spreadsheet all day.

The web app is the actual product. Google Sheets works as the backend, while Apps Script handles the KPI calculations, budget logic, Drive filing and Gmail draft flow.

> **Portfolio disclaimer:** all fleets, countries, targets, budgets, contacts, orders, emissions figures and invoice records in this project are fabricated. There is no employer data, production credential or real invoice anywhere in this repo.

## Development approach

I built this project through AI-assisted development using Claude and Claude Code agents in Cursor. I defined the business problem, user flow, application logic and validation criteria, then used the agents to accelerate implementation, debugging, testing and documentation.

AI worked as a development multiplier, but I remained responsible for the requirements, decisions, review and final testing of the application.

## Live demo

[Open the Fleet Budget Tracker & Invoice Manager](https://script.google.com/macros/s/AKfycbxmWk_dUmkK7xe9WsJWvMlKRuxlU8fqBxqZoiiCNasnCw4KR2Exg7Snc7mZXXn1bTcZVQ/exec)

The public version is a safe portfolio sandbox. You can explore the dashboard and run through the invoice-upload workflow, but demo uploads are not written to Drive and demo email drafts are not created in Gmail.

The internal configuration is meant for employees. There are no fleet logins and no extra admin password: anyone who already has access to the company deployment can use the one-page dashboard and upload an invoice directly from the relevant fleet row.

## The idea

The tool connects three parts of an incentive program that are usually handled separately:

- country sustainability KPIs;
- fleet-level targets and rewards;
- invoice collection, documentation and payout preparation.

The demo deliberately keeps the stack small, but the dashboard logic is designed around data that would normally come from a proper warehouse rather than manual Sheet updates.

## What it tracks

- country CO2e emissions per delivery
- country green-vehicle share
- country green-order share
- interactive share-progression and CO2e-per-delivery charts with a trailing eight-month view, even in January
- one-click previous/next month controls that rewind KPIs, rewards paid, remaining budget and fleet results
- a fabricated €150,000 annual program budget, reduced only when a fleet hits its monthly target
- monthly planning pace versus rewards actually triggered by target hits
- human, rounded targets that adapt to each fleet's recent order volume (13k, 15k, etc.)
- a simple reward rule of €0.10 per target order (10,000 orders = €1,000)
- completed months locked as **Hit** or **Miss**, with **On pace** / **At risk** reserved for the current month
- a clean fleet action table with orders, target, reward, result and invoice upload
- invoice status and payout readiness

For this project, a green order means an order completed with a bicycle, e-bike, electric scooter or electric car. That is a program eligibility rule, not a universal environmental claim.

## Invoice workflow

In internal mode, an employee clicks **Upload invoice** on the relevant fleet, enters the period and amount, then uploads the PDF. Apps Script:

1. validates the invoice;
2. creates or finds the fleet's Drive folder;
3. renames the PDF using the exact upload timestamp;
4. adds the invoice to the register;
5. optionally prepares a Gmail draft with the invoice attached.

Nothing is ever sent automatically. A person still checks the recipient, amount and attachment before sending.

## Architecture

```text
Employee web app
  ├─ country sustainability KPI dashboard
  ├─ fleet progress and budget control
  └─ invoice upload and history
          │
          ▼
Apps Script backend
  ├─ KPI and budget calculations
  ├─ safe demo / internal mode switch
  ├─ Drive folder and filename workflow
  └─ Gmail draft preparation
          │
          ▼
Google Sheets datastore
```

## Files

- `Code.gs` — datastore setup, API methods, calculations, Drive and Gmail logic
- `Index.html` — responsive employee web app
- `Admin.html` — optional Sheet-sidebar uploader
- `appsscript.json` — Apps Script manifest

## Tech stack

- Google Apps Script
- Google Sheets
- Google Drive
- Gmail drafts
- vanilla HTML, CSS and JavaScript
- SVG charts with interactive hover values

## Setup

1. Create a blank Google Sheet and open **Extensions → Apps Script**.
2. Add the source files from this repo.
3. Run `setupSyntheticProject` once.
4. Deploy the Apps Script project as a web app.
5. Keep `MODE: 'portfolio_demo'` for a public, non-persistent showcase.
6. Change it to `MODE: 'internal'` for real Drive uploads and Gmail drafts, then restrict the deployment to the company's employees.

## Production data pipeline

The fabricated Sheet is useful for the portfolio demo, but it should not be treated as the source of truth in a real company setup.

The accurate version would pull delivery, vehicle, fleet and payout data automatically from the company’s existing data platform — for example Snowflake, Amazon Redshift, Athena/S3, RDS or another internal warehouse/database. A scheduled query or API job would aggregate the required monthly metrics and feed the dashboard without manual copy/paste.

```text
Operational systems
  └─ orders, vehicles, fleets and payouts
          ↓
Company warehouse / database
  └─ Snowflake, Redshift, Athena/S3, RDS, etc.
          ↓
Scheduled transformation
  └─ validated fleet IDs, monthly KPIs and reward eligibility
          ↓
Dashboard data layer
  └─ Google Sheet for a lightweight rollout, or a database/API at scale
          ↓
Employee web app
```

That setup gives much better accuracy and control because calculations are based on the same governed data used by the rest of the business. It also makes it easier to:

- refresh results automatically;
- keep fleet IDs and vehicle classifications consistent;
- backfill corrected historical data;
- audit exactly why a target was marked Hit or Miss;
- apply access controls outside the spreadsheet;
- scale beyond the practical limits of Google Sheets.

Jira or Monday.com can still be useful for ticket and invoice workflow data, but delivery volumes, vehicle type and emissions KPIs should ideally come from the company’s operational database or warehouse.

For a small internal rollout, Sheets is a perfectly reasonable presentation layer. For larger volumes or stricter permissions, I would keep the same web-app concept and move the backend to a proper database/API.

## Data and security note

This repository contains no employer data, credentials, Drive folder IDs or real invoice addresses. Before using the internal mode, access to the Apps Script deployment, Sheet, Drive folders and Gmail scopes should be restricted to the relevant company employees.
