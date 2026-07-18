const CONFIG = Object.freeze({
  PROJECT_NAME: 'Fleet Budget Tracker & Invoice Manager',
  MODE: 'portfolio_demo',
  CURRENCY: 'EUR',
  PROGRAM_BUDGET: 150000,
  ROOT_FOLDER_NAME: 'Fleet Budget & Invoice Manager - Synthetic Invoices',
  MAX_FILE_BYTES: 5 * 1024 * 1024,
  SHEETS: {
    DASHBOARD: 'Dashboard',
    FLEETS: 'FleetDirectory',
    TARGETS: 'FleetTargets',
    KPI: 'KPIProgress',
    COUNTRY_KPI: 'CountryKPIProgress',
    MONTHLY_BUDGET: 'MonthlyBudget',
    BUDGET: 'BudgetTracker',
    INVOICES: 'Invoices',
    SETTINGS: 'Settings',
    AUDIT: 'AuditLog'
  }
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Budget & Invoices')
    .addItem('Set up / refresh synthetic demo', 'setupSyntheticProject')
    .addSeparator()
    .addItem('Open invoice upload (Sheet fallback)', 'showInvoiceAdmin')
    .addItem('Refresh dashboard', 'refreshDashboard')
    .addSeparator()
    .addItem('About this demo', 'showAboutDialog')
    .addToUi();
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle(CONFIG.PROJECT_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function setupSyntheticProject() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', ss.getId());
  ss.rename('Fleet Budget Tracker & Invoice Manager - Synthetic Demo');

  const definitions = buildSyntheticData_();
  Object.keys(definitions).forEach(function (name) {
    writeTable_(ss, name, definitions[name]);
  });

  buildDashboard_(ss);
  const defaultSheet = ss.getSheetByName('Sheet1');
  const defaultSheetIsEmpty = defaultSheet && defaultSheet.getDataRange().getDisplayValues()
    .every(function (row) { return row.every(function (cell) { return cell === ''; }); });
  if (
    defaultSheet &&
    ss.getSheets().length > 1 &&
    defaultSheetIsEmpty
  ) {
    ss.deleteSheet(defaultSheet);
  }
  applyWorkbookFormatting_(ss);
  appendAudit_('PROJECT_SETUP', 'Synthetic demo workspace generated or refreshed');
  ss.setActiveSheet(ss.getSheetByName(CONFIG.SHEETS.DASHBOARD));
  SpreadsheetApp.flush();
  ss.toast(
    'The tracker, KPI progress, budget controls and invoice register are populated with fabricated data.',
    'Synthetic demo ready',
    8
  );
}

function refreshDashboard() {
  buildDashboard_(getSpreadsheet_());
  SpreadsheetApp.flush();
  toast_('Dashboard refreshed.');
}

function showInvoiceAdmin() {
  const output = HtmlService.createTemplateFromFile('Admin')
    .evaluate()
    .setTitle('Invoice admin');
  SpreadsheetApp.getUi().showSidebar(output);
}

function showAboutDialog() {
  const message = [
    'Portfolio reconstruction built with fabricated fleets, targets, budgets, contacts and invoice records.',
    '',
    'In this demo, “green orders” means orders completed with a project-eligible non-combustion vehicle. It is a program rule, not a universal environmental claim.',
    '',
    'The Sheet is the backend. The web app is the employee interface for KPI monitoring, budget control and invoice handling.'
  ].join('\n');
  SpreadsheetApp.getUi().alert('About this project', message, SpreadsheetApp.getUi().ButtonSet.OK);
}

function getPortalBootstrap() {
  return JSON.stringify({
    publicData: getPublicDashboardData(),
    operations: {
      demoMode: CONFIG.MODE === 'portfolio_demo',
      fleets: getAdminFleetOptions_()
    }
  });
}

function getPublicDashboardData() {
  const ss = getSpreadsheet_();
  const fleetRows = readObjects_(ss.getSheetByName(CONFIG.SHEETS.BUDGET));
  const kpiRows = readObjects_(ss.getSheetByName(CONFIG.SHEETS.KPI));
  const countryRows = readObjects_(ss.getSheetByName(CONFIG.SHEETS.COUNTRY_KPI));
  const monthlyBudgetRows = readObjects_(ss.getSheetByName(CONFIG.SHEETS.MONTHLY_BUDGET));
  const invoiceRows = readObjects_(ss.getSheetByName(CONFIG.SHEETS.INVOICES));
  const latestCountry = countryRows.length ? countryRows[countryRows.length - 1] : {};

  const rewardsPaid = sum_(monthlyBudgetRows, 'Rewards Paid EUR');
  const totalOrders = kpiRows.reduce(function (total, row) {
    return total + Number(row['Green Orders'] || 0);
  }, 0);
  const availableMonths = monthlyBudgetRows.map(function (row) { return serialiseMonth_(row.Month); });

  return {
    projectName: CONFIG.PROJECT_NAME,
    mode: CONFIG.MODE,
    currency: CONFIG.CURRENCY,
    disclaimer: 'Every fleet, target, budget, contact and invoice shown here is fabricated for a portfolio demonstration.',
    eligibilityNote: '“Green orders” are defined here as orders completed by a project-eligible non-combustion vehicle.',
    summary: {
      programBudget: CONFIG.PROGRAM_BUDGET,
      earned: rewardsPaid,
      approved: rewardsPaid,
      remaining: CONFIG.PROGRAM_BUDGET - rewardsPaid,
      greenOrders: totalOrders,
      onTrack: fleetRows.filter(function (row) { return row['Current Result'] === 'Hit' || row['Current Result'] === 'On pace'; }).length,
      fleetCount: fleetRows.length,
      pendingInvoices: invoiceRows.filter(function (row) {
        return String(row.Status).indexOf('Pending') !== -1;
      }).length,
      co2PerDelivery: Number(latestCountry['CO2e kg per Delivery'] || 0),
      co2Target: Number(latestCountry['CO2e Target kg per Delivery'] || 0),
      greenVehicleShare: Number(latestCountry['Green Vehicle Share'] || 0),
      greenOrderShare: Number(latestCountry['Green Order Share'] || 0),
      country: latestCountry.Country || 'Synthetic country',
      monthlyPlan: monthlyBudgetRows.length ? Number(monthlyBudgetRows[0]['Monthly Planning Pace EUR'] || 0) : CONFIG.PROGRAM_BUDGET / 12,
      currentMonthApproved: monthlyBudgetRows.length ? Number(monthlyBudgetRows[monthlyBudgetRows.length - 1]['Rewards Paid EUR'] || 0) : 0
    },
    availableMonths: availableMonths,
    monthlyBudget: monthlyBudgetRows.map(function (row) {
      return {
        month: serialiseMonth_(row.Month),
        plan: Number(row['Monthly Planning Pace EUR'] || 0),
        approved: Number(row['Rewards Paid EUR'] || 0),
        hits: Number(row['Targets Hit'] || 0),
        remaining: Number(row['Remaining Program Budget EUR'] || 0),
        utilization: Number(row['Utilization %'] || 0)
      };
    }),
    countryTrend: countryRows.map(function (row) {
      return {
        month: serialiseMonth_(row['Week Start']),
        co2PerDelivery: Number(row['CO2e kg per Delivery'] || 0),
        greenVehicleShare: Number(row['Green Vehicle Share'] || 0),
        greenOrderShare: Number(row['Green Order Share'] || 0)
      };
    }),
    fleets: fleetRows.map(function (row) {
      const trend = kpiRows.filter(function (kpiRow) {
        return String(kpiRow['Fleet ID']) === String(row['Fleet ID']);
      }).map(function (kpiRow) {
        return {
          month: serialiseMonth_(kpiRow['Week Start']),
          monthlyOrders: Number(kpiRow['Green Orders'] || 0),
          adaptiveTarget: Number(kpiRow['Adaptive Target Orders'] || 0),
          reward: Number(kpiRow['Reward EUR'] || 0),
          result: String(kpiRow.Result || ''),
          projectedOrders: Number(kpiRow['Projected Orders'] || 0)
        };
      });
      const latestTrend = trend.length ? trend[trend.length - 1] : {};
      return {
        fleetId: row['Fleet ID'],
        company: row['Fleet Company'],
        target: Number(latestTrend.adaptiveTarget || row['Current Target Orders'] || 0),
        orders: Number(latestTrend.monthlyOrders || row['Current Orders'] || 0),
        allocation: Number(latestTrend.reward || row['Reward at Target EUR'] || 0),
        approved: Number(row['Paid YTD EUR'] || 0),
        status: String(latestTrend.result || row['Current Result'] || ''),
        projectedOrders: Number(latestTrend.projectedOrders || 0),
        trend: trend
      };
    }),
    invoices: invoiceRows.slice(-8).reverse().map(function (row) {
      return {
        id: row['Invoice ID'],
        company: row['Fleet Company'],
        period: row.Period,
        amount: Number(row['Amount EUR'] || 0),
        status: row.Status,
        uploaded: serialiseDate_(row['Uploaded At']),
        draftStatus: row['Draft Email Status']
      };
    })
  };
}

function getSheetAdminBootstrap() {
  return { mode: CONFIG.MODE, fleets: getAdminFleetOptions_() };
}

function getAdminFleetOptions_() {
  const ss = getSpreadsheet_();
  return readObjects_(ss.getSheetByName(CONFIG.SHEETS.FLEETS))
    .filter(function (row) { return String(row.Active).toLowerCase() === 'true'; })
    .map(function (row) {
      return {
        fleetId: row['Fleet ID'],
        company: row['Fleet Company'],
        invoiceEmail: row['Invoice Email']
      };
    });
}

function saveInvoiceFromSheet(payload) {
  return saveInvoice_(payload);
}

function saveInvoiceFromWeb(payload) {
  if (CONFIG.MODE === 'portfolio_demo') return JSON.stringify(simulateInvoiceUpload_(payload));
  return JSON.stringify(saveInvoice_(payload));
}

function simulateInvoiceUpload_(payload) {
  validateInvoicePayload_(payload);
  const timestamp = new Date();
  const invoiceId = 'DEMO-' + Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss');
  const safeFleet = String(payload.fleetId).replace(/[^A-Za-z0-9_-]/g, '');
  return {
    invoiceId: invoiceId,
    filename: Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss') + '_' + safeFleet + '_' + invoiceId + '.pdf',
    simulated: true
  };
}

function saveInvoice_(payload) {
  validateInvoicePayload_(payload);
  const ss = getSpreadsheet_();
  const fleet = getFleet_(payload.fleetId);
  if (!fleet) throw new Error('Fleet not found.');

  const bytes = Utilities.base64Decode(String(payload.base64 || ''));
  if (bytes.length > CONFIG.MAX_FILE_BYTES) throw new Error('PDF must be 5 MB or smaller.');

  const invoiceId = nextInvoiceId_(ss);
  const timestamp = new Date();
  const stamp = Utilities.formatDate(timestamp, Session.getScriptTimeZone(), 'yyyy-MM-dd_HHmmss');
  const safeFleet = String(fleet['Fleet ID']).replace(/[^A-Za-z0-9_-]/g, '');
  const filename = [stamp, safeFleet, invoiceId].join('_') + '.pdf';
  const folder = getOrCreateFleetFolder_(fleet);
  const blob = Utilities.newBlob(bytes, 'application/pdf', filename);
  const file = folder.createFile(blob);

  const row = [
    invoiceId,
    fleet['Fleet ID'],
    fleet['Fleet Company'],
    String(payload.period).trim(),
    Number(payload.amount),
    'Uploaded - Pending review',
    timestamp,
    filename,
    file.getUrl(),
    'Not created',
    '',
    String(payload.notes || '').trim()
  ];
  appendRowByName_(CONFIG.SHEETS.INVOICES, row);
  appendAudit_('INVOICE_UPLOAD', invoiceId + ' stored as ' + filename);
  buildDashboard_(ss);
  return { invoiceId: invoiceId, filename: filename, fileUrl: file.getUrl() };
}

function createInvoiceDraftFromSheet(invoiceId) {
  return createInvoiceDraft_(invoiceId);
}

function createInvoiceDraftFromWeb(invoiceId) {
  if (CONFIG.MODE === 'portfolio_demo') {
    return JSON.stringify({
      draftId: 'DEMO-DRAFT',
      recipient: 'invoices@example.com',
      subject: 'Synthetic invoice ' + invoiceId,
      simulated: true
    });
  }
  return JSON.stringify(createInvoiceDraft_(invoiceId));
}

function createInvoiceDraft_(invoiceId) {
  const ss = getSpreadsheet_();
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idIndex = headers.indexOf('Invoice ID');
  const rowIndex = values.findIndex(function (row, index) {
    return index > 0 && String(row[idIndex]) === String(invoiceId);
  });
  if (rowIndex < 1) throw new Error('Invoice not found.');

  const invoice = objectFromRow_(headers, values[rowIndex]);
  const fleet = getFleet_(invoice['Fleet ID']);
  const recipient = String(fleet['Invoice Email'] || '').trim();
  assertAllowedRecipient_(recipient);

  const subject = 'Invoice ' + invoice['Invoice ID'] + ' | ' + invoice['Fleet Company'] + ' | ' + invoice.Period;
  const body = [
    'Hi invoicing team,',
    '',
    'Please find attached the incentive invoice for ' + invoice['Fleet Company'] + ' covering ' + invoice.Period + '.',
    '',
    'Invoice reference: ' + invoice['Invoice ID'],
    'Amount: ' + formatMoney_(Number(invoice['Amount EUR'] || 0)),
    '',
    'This draft was generated from the Fleet Budget Tracker & Invoice Manager. Please review the recipient, amount and attachment before sending.',
    '',
    'Best,'
  ].join('\n');

  const fileId = extractDriveId_(invoice['Drive URL']);
  const options = { name: CONFIG.PROJECT_NAME };
  if (fileId) options.attachments = [DriveApp.getFileById(fileId).getBlob()];
  const draft = GmailApp.createDraft(recipient, subject, body, options);

  const draftStatusIndex = headers.indexOf('Draft Email Status');
  const draftDateIndex = headers.indexOf('Draft Created At');
  sheet.getRange(rowIndex + 1, draftStatusIndex + 1).setValue('Draft created');
  sheet.getRange(rowIndex + 1, draftDateIndex + 1).setValue(new Date());
  appendAudit_('EMAIL_DRAFT', invoiceId + ' draft created for ' + recipient);
  return { draftId: draft.getId(), recipient: recipient, subject: subject };
}

function buildSyntheticData_() {
  const fleets = [
    ['FLT-001', 'Evergreen Dispatch', 'Maya Stone', 'invoices+flt001@example.com', 0.10, true, ''],
    ['FLT-002', 'Northstar Mobility', 'Leo Marin', 'invoices+flt002@example.com', 0.10, true, ''],
    ['FLT-003', 'Cedar Cycle Co.', 'Nora Vale', 'invoices+flt003@example.com', 0.10, true, ''],
    ['FLT-004', 'Harbor Electric', 'Sam Rivera', 'invoices+flt004@example.com', 0.10, true, ''],
    ['FLT-005', 'Urban Leaf Logistics', 'Iris Cole', 'invoices+flt005@example.com', 0.10, true, ''],
    ['FLT-006', 'Blue Current Couriers', 'Theo Park', 'invoices+flt006@example.com', 0.10, true, ''],
    ['FLT-007', 'Suntrail Delivery', 'Zoe Quinn', 'invoices+flt007@example.com', 0.10, true, ''],
    ['FLT-008', 'Mossline Transport', 'Alex Kim', 'invoices+flt008@example.com', 0.10, true, '']
  ];
  const targets = [13000, 11000, 15000, 12000, 10000, 16000, 12000, 14000];
  const performanceFactors = [0.92, 1.05, 0.97, 1.10, 0.88, 1.02, 1.12, 0.95, 1.08, 0.90, 1.04, 0.98, 1.15, 0.60];
  const historyMonths = performanceFactors.map(function (_, index) { return new Date(2025, 5 + index, 1); });
  const fleetHeaders = ['Fleet ID', 'Fleet Company', 'Contact Name', 'Invoice Email', 'Reward Rate EUR', 'Active', 'Folder ID'];
  const targetHeaders = ['Fleet ID', 'Fleet Company', 'Initial KPI Target Orders', 'Reward per Target Order EUR', 'Green Definition', 'Status'];
  const kpiHeaders = ['Week Start', 'Fleet ID', 'Fleet Company', 'Green Orders', 'Adaptive Target Orders', 'Reward EUR', 'Result', 'Projected Orders', 'Eligible Vehicle Mix', 'Updated At'];
  const countryKpiHeaders = ['Week Start', 'Country', 'Total Orders', 'Green Orders', 'Green Order Share', 'Active Vehicles', 'Green Vehicles', 'Green Vehicle Share', 'CO2e kg', 'CO2e kg per Delivery', 'CO2e Target kg per Delivery', 'Updated At'];
  const monthlyBudgetHeaders = ['Month', 'Program Budget EUR', 'Monthly Planning Pace EUR', 'Rewards Paid EUR', 'Targets Hit', 'Remaining Program Budget EUR', 'Utilization %'];
  const budgetHeaders = ['Fleet ID', 'Fleet Company', 'Current Target Orders', 'Current Orders', 'Reward at Target EUR', 'Paid YTD EUR', 'Current Result'];
  const invoiceHeaders = ['Invoice ID', 'Fleet ID', 'Fleet Company', 'Period', 'Amount EUR', 'Status', 'Uploaded At', 'Stored Filename', 'Drive URL', 'Draft Email Status', 'Draft Created At', 'Notes'];
  const settingsRows = [
    ['APP_MODE', CONFIG.MODE, 'Portfolio demo simulates writes; internal mode stores invoices in Drive'],
    ['PROJECT_NAME', CONFIG.PROJECT_NAME, 'Portfolio project name'],
    ['CURRENCY', CONFIG.CURRENCY, 'Synthetic program currency'],
    ['PROGRAM_BUDGET', CONFIG.PROGRAM_BUDGET, 'Fabricated annual budget'],
    ['PERIOD_START', new Date(2026, 0, 5), 'Synthetic reporting period start'],
    ['PERIOD_END', new Date(2026, 11, 31), 'Synthetic reporting period end'],
    ['DRIVE_ROOT_FOLDER_ID', '', 'Created automatically on first internal invoice upload'],
    ['DATA_NOTICE', '100% fabricated portfolio data', 'Never replace with confidential company data in a public demo']
  ];

  const targetRows = fleets.map(function (fleet, index) {
    return [fleet[0], fleet[1], targets[index], 0.10, 'Bicycle, e-bike, electric scooter or electric car', 'Active'];
  });
  const kpiRows = [];
  const latestRows = [];
  const rewardsPaidByMonth = [0, 0, 0, 0, 0, 0, 0];
  const hitsByMonth = [0, 0, 0, 0, 0, 0, 0];
  const paidByFleet = fleets.map(function () { return 0; });
  for (let f = 0; f < fleets.length; f += 1) {
    const priorActual = [];
    historyMonths.forEach(function (date, monthIndex) {
      const recent = priorActual.slice(Math.max(0, priorActual.length - 3));
      const recentAverage = recent.length ? recent.reduce(function (sum, value) { return sum + value; }, 0) / recent.length : targets[f];
      const adaptiveTarget = Math.max(8000, Math.round((targets[f] * 0.55 + recentAverage * 0.45) / 1000) * 1000);
      const variance = ((((f + 1) * 3 + monthIndex * 2) % 7) - 3) * 0.025;
      const monthlyOrders = Math.round(targets[f] * (performanceFactors[monthIndex] + variance) / 100) * 100;
      const isCurrentMonth = date.getFullYear() === 2026 && date.getMonth() === 6;
      const projectedOrders = isCurrentMonth ? Math.round(monthlyOrders / 18 * 31 / 100) * 100 : monthlyOrders;
      const result = monthlyOrders >= adaptiveTarget ? 'Hit' : isCurrentMonth && projectedOrders >= adaptiveTarget ? 'On pace' : isCurrentMonth ? 'At risk' : 'Miss';
      const reward = Math.round(adaptiveTarget * 0.10);
      const row = [date, fleets[f][0], fleets[f][1], monthlyOrders, String(adaptiveTarget), reward, result, projectedOrders, vehicleMix_(f, monthIndex), new Date(2026, 6, 18, 9, 30)];
      kpiRows.push(row);
      latestRows[f] = row;
      priorActual.push(monthlyOrders);

      if (date.getFullYear() === 2026 && result === 'Hit') {
        rewardsPaidByMonth[date.getMonth()] += reward;
        hitsByMonth[date.getMonth()] += 1;
        paidByFleet[f] += reward;
      }
    });
  }

  const budgetRows = fleets.map(function (fleet, index) {
    const latest = latestRows[index];
    return [fleet[0], fleet[1], Number(latest[4]), latest[3], latest[5], paidByFleet[index], latest[6]];
  });

  const countryKpiRows = [];
  const monthlyTotalOrders = [145000, 149800, 147600, 153900, 157500, 155800, 161200, 164400, 168700, 166300, 172900, 176500, 174800, 181600];
  const monthlyGreenOrderShare = [0.255, 0.268, 0.261, 0.279, 0.288, 0.282, 0.301, 0.310, 0.326, 0.319, 0.342, 0.355, 0.348, 0.371];
  const monthlyActiveVehicles = [4720, 4790, 4760, 4850, 4920, 4890, 5010, 5080, 5160, 5125, 5230, 5320, 5280, 5410];
  const monthlyGreenVehicleShare = [0.238, 0.249, 0.246, 0.263, 0.271, 0.267, 0.284, 0.295, 0.309, 0.304, 0.321, 0.337, 0.331, 0.352];
  const monthlyCo2PerDelivery = [0.535, 0.521, 0.526, 0.508, 0.499, 0.504, 0.486, 0.478, 0.462, 0.468, 0.449, 0.438, 0.444, 0.426];
  historyMonths.forEach(function (date, monthIndex) {
    const totalCountryOrders = monthlyTotalOrders[monthIndex];
    const greenOrderShare = monthlyGreenOrderShare[monthIndex];
    const activeVehicles = monthlyActiveVehicles[monthIndex];
    const greenVehicleShare = monthlyGreenVehicleShare[monthIndex];
    const co2PerDelivery = monthlyCo2PerDelivery[monthIndex];
    countryKpiRows.push([
      date, 'Synthetic Country', totalCountryOrders, Math.round(totalCountryOrders * greenOrderShare), greenOrderShare,
      activeVehicles, Math.round(activeVehicles * greenVehicleShare), greenVehicleShare,
      Math.round(totalCountryOrders * co2PerDelivery), co2PerDelivery, 0.40, new Date(2026, 6, 18, 9, 30)
    ]);
  });

  const monthlyPlan = CONFIG.PROGRAM_BUDGET / 12;
  let cumulativePaid = 0;
  const monthlyBudgetRows = rewardsPaidByMonth.map(function (paid, index) {
    cumulativePaid += paid;
    const month = Utilities.formatDate(new Date(2026, index, 1), Session.getScriptTimeZone(), 'yyyy-MM');
    return [month, CONFIG.PROGRAM_BUDGET, monthlyPlan, paid, hitsByMonth[index], CONFIG.PROGRAM_BUDGET - cumulativePaid, paid / monthlyPlan];
  });

  const invoiceRows = [
    ['INV-0001', 'FLT-001', fleets[0][1], '2026-01', 620, 'Paid', new Date(2026, 1, 6, 10, 15), '2026-02-06_101500_FLT-001_INV-0001.pdf', '', 'Draft created', new Date(2026, 1, 6, 10, 18), 'Synthetic record; no real file attached'],
    ['INV-0002', 'FLT-003', fleets[2][1], '2026-01', 720, 'Approved', new Date(2026, 1, 8, 14, 42), '2026-02-08_144200_FLT-003_INV-0002.pdf', '', 'Draft created', new Date(2026, 1, 8, 14, 46), 'Synthetic record; no real file attached'],
    ['INV-0003', 'FLT-006', fleets[5][1], '2026-01', 750, 'Paid', new Date(2026, 1, 10, 9, 5), '2026-02-10_090500_FLT-006_INV-0003.pdf', '', 'Draft created', new Date(2026, 1, 10, 9, 8), 'Synthetic record; no real file attached'],
    ['INV-0004', 'FLT-004', fleets[3][1], '2026-02', 480, 'Uploaded - Pending review', new Date(2026, 2, 5, 16, 24), '2026-03-05_162400_FLT-004_INV-0004.pdf', '', 'Not created', '', 'Synthetic record; no real file attached'],
    ['INV-0005', 'FLT-008', fleets[7][1], '2026-02', 520, 'Uploaded - Pending review', new Date(2026, 2, 7, 11, 3), '2026-03-07_110300_FLT-008_INV-0005.pdf', '', 'Not created', '', 'Synthetic record; no real file attached'],
    ['INV-0006', 'FLT-007', fleets[6][1], '2026-02', 390, 'Needs correction', new Date(2026, 2, 9, 13, 51), '2026-03-09_135100_FLT-007_INV-0006.pdf', '', 'Not created', '', 'Synthetic record; no real file attached']
  ];

  return {
    FleetDirectory: [fleetHeaders].concat(fleets),
    FleetTargets: [targetHeaders].concat(targetRows),
    KPIProgress: [kpiHeaders].concat(kpiRows),
    CountryKPIProgress: [countryKpiHeaders].concat(countryKpiRows),
    MonthlyBudget: [monthlyBudgetHeaders].concat(monthlyBudgetRows),
    BudgetTracker: [budgetHeaders].concat(budgetRows),
    Invoices: [invoiceHeaders].concat(invoiceRows),
    Settings: [['Setting', 'Value', 'Description']].concat(settingsRows),
    AuditLog: [['Timestamp', 'Actor', 'Action', 'Details']]
  };
}

function buildDashboard_(ss) {
  const name = CONFIG.SHEETS.DASHBOARD;
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name, 0);
  sheet.clear();
  sheet.getCharts().forEach(function (chart) { sheet.removeChart(chart); });
  sheet.setHiddenGridlines(true);

  sheet.getRange('A1:J1').merge().setValue('FLEET BUDGET TRACKER & INVOICE MANAGER').setBackground('#12372A').setFontColor('#FFFFFF').setFontSize(20).setFontWeight('bold').setHorizontalAlignment('left');
  sheet.getRange('A2:J2').merge().setValue('SYNTHETIC PORTFOLIO DEMO — every fleet, target, budget, contact and invoice is fabricated').setBackground('#E8F5E9').setFontColor('#22543D').setFontWeight('bold');
  sheet.getRange('A4:B4').setValues([['PROGRAM BUDGET', CONFIG.PROGRAM_BUDGET]]);
  sheet.getRange('D4:E4').setValues([['REWARDS PAID', '=SUM(MonthlyBudget!D2:D)']]);
  sheet.getRange('G4:H4').setValues([['BUDGET REMAINING', '=B4-E4']]);
  sheet.getRange('A6:B6').setValues([['GREEN ORDERS', '=SUM(KPIProgress!D2:D)']]);
  sheet.getRange('D6:E6').setValues([['FLEETS ON TRACK', '=COUNTIF(BudgetTracker!G2:G,"Hit")+COUNTIF(BudgetTracker!G2:G,"On pace")']]);
  sheet.getRange('G6:H6').setValues([['PENDING INVOICES', '=COUNTIF(Invoices!F2:F,"*Pending*")']]);
  sheet.getRange('A8:B8').setValues([['CO2E KG / DELIVERY', '=INDEX(CountryKPIProgress!J:J,COUNTA(CountryKPIProgress!A:A))']]);
  sheet.getRange('D8:E8').setValues([['GREEN VEHICLE SHARE', '=INDEX(CountryKPIProgress!H:H,COUNTA(CountryKPIProgress!A:A))']]);
  sheet.getRange('G8:H8').setValues([['GREEN ORDER SHARE', '=INDEX(CountryKPIProgress!E:E,COUNTA(CountryKPIProgress!A:A))']]);

  ['A4:B4', 'D4:E4', 'G4:H4', 'A6:B6', 'D6:E6', 'G6:H6', 'A8:B8', 'D8:E8', 'G8:H8'].forEach(function (a1) {
    sheet.getRange(a1).setBackground('#FFFFFF').setBorder(true, true, true, true, false, false, '#CFE3D6', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
    sheet.getRange(a1).getCell(1, 1).setFontColor('#557A66').setFontWeight('bold');
    sheet.getRange(a1).getCell(1, 2).setFontColor('#12372A').setFontWeight('bold').setFontSize(14);
  });
  sheet.getRange('B4').setNumberFormat('€#,##0');
  sheet.getRange('E4').setNumberFormat('€#,##0');
  sheet.getRange('H4').setNumberFormat('€#,##0');
  sheet.getRange('B8').setNumberFormat('0.000');
  sheet.getRange('E8').setNumberFormat('0.0%');
  sheet.getRange('H8').setNumberFormat('0.0%');

  const budget = ss.getSheetByName(CONFIG.SHEETS.BUDGET).getDataRange().getValues();
  const table = [['Fleet', 'Orders', 'Target', 'Progress', 'Reward', 'Paid YTD', 'Remaining', 'Result']];
  budget.slice(1).forEach(function (r) { table.push([r[1], r[3], r[2], Number(r[2]) ? Number(r[3]) / Number(r[2]) : 0, r[4], r[5], CONFIG.PROGRAM_BUDGET - Number(r[5] || 0), r[6]]); });
  sheet.getRange(11, 1, table.length, table[0].length).setValues(table);
  styleHeader_(sheet.getRange(11, 1, 1, table[0].length));
  sheet.getRange(12, 4, table.length - 1, 1).setNumberFormat('0.0%');
  sheet.getRange(12, 5, table.length - 1, 3).setNumberFormat('€#,##0');
  sheet.getRange(12, 1, table.length - 1, table[0].length).applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);

  sheet.getRange('A22:J22').merge().setValue('Invoice flow: the public portfolio demo simulates uploads; internal mode stores PDFs in fleet Drive folders and can create Gmail drafts.').setBackground('#FFF8E1').setFontColor('#7A5C00');
  sheet.getRange('A24:J24').merge().setValue('Eligibility note: “green orders” is a project rule for non-combustion vehicles, not a universal environmental claim.').setFontColor('#557A66').setFontStyle('italic');

  const chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange('A11:C19'))
    .setPosition(26, 1, 0, 0)
    .setOption('title', 'Green orders vs target')
    .setOption('colors', ['#2E7D5B', '#9AC7A8'])
    .setOption('legend', { position: 'bottom' })
    .build();
  sheet.insertChart(chart);
  sheet.setColumnWidths(1, 10, 115);
  sheet.setColumnWidth(1, 190);
  sheet.setColumnWidths(4, 1, 165);
  sheet.setColumnWidths(7, 1, 165);
  sheet.setColumnWidths(5, 1, 130);
  sheet.setColumnWidths(8, 1, 130);
  sheet.setFrozenRows(2);
}

function applyWorkbookFormatting_(ss) {
  const header = '#1B5E45';
  Object.keys(CONFIG.SHEETS).forEach(function (key) {
    const sheet = ss.getSheetByName(CONFIG.SHEETS[key]);
    if (!sheet || sheet.getName() === CONFIG.SHEETS.DASHBOARD) return;
    sheet.setFrozenRows(1);
    sheet.setHiddenGridlines(false);
    const range = sheet.getDataRange();
    if (range.getNumRows() > 1) range.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, true, false);
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).setBackground(header).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.autoResizeColumns(1, sheet.getLastColumn());
  });
  ss.getSheetByName(CONFIG.SHEETS.KPI).getRange('E2:E').setNumberFormat('0');
  ss.getSheetByName(CONFIG.SHEETS.KPI).getRange('F2:F').setNumberFormat('€#,##0');
  ss.getSheetByName(CONFIG.SHEETS.COUNTRY_KPI).getRange('E2:E').setNumberFormat('0.0%');
  ss.getSheetByName(CONFIG.SHEETS.COUNTRY_KPI).getRange('H2:H').setNumberFormat('0.0%');
  ss.getSheetByName(CONFIG.SHEETS.COUNTRY_KPI).getRange('I2:J').setNumberFormat('0.000');
  ss.getSheetByName(CONFIG.SHEETS.MONTHLY_BUDGET).getRange('B2:D').setNumberFormat('€#,##0');
  ss.getSheetByName(CONFIG.SHEETS.MONTHLY_BUDGET).getRange('F2:F').setNumberFormat('€#,##0');
  ss.getSheetByName(CONFIG.SHEETS.MONTHLY_BUDGET).getRange('G2:G').setNumberFormat('0.0%');
  ss.getSheetByName(CONFIG.SHEETS.BUDGET).getRange('E2:F').setNumberFormat('€#,##0');
  ss.getSheetByName(CONFIG.SHEETS.FLEETS).getRange('E2:E').setNumberFormat('€0.00');
  ss.getSheetByName(CONFIG.SHEETS.INVOICES).getRange('E2:E').setNumberFormat('€#,##0');
}

function writeTable_(ss, name, values) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  sheet.clear();
  if (values.length && values[0].length) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}

function styleHeader_(range) {
  range.setBackground('#1B5E45').setFontColor('#FFFFFF').setFontWeight('bold');
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) throw new Error('Run setupSyntheticProject once from the bound Google Sheet.');
  return active;
}

function readObjects_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  return values.slice(1).filter(function (row) { return row.some(function (cell) { return cell !== ''; }); })
    .map(function (row) { return objectFromRow_(values[0], row); });
}

function objectFromRow_(headers, row) {
  return headers.reduce(function (obj, header, index) { obj[header] = row[index]; return obj; }, {});
}

function getFleet_(fleetId) {
  return readObjects_(getSpreadsheet_().getSheetByName(CONFIG.SHEETS.FLEETS)).find(function (row) {
    return String(row['Fleet ID']) === String(fleetId);
  });
}

function getOrCreateFleetFolder_(fleet) {
  const ss = getSpreadsheet_();
  const settings = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
  const settingsData = settings.getDataRange().getValues();
  const rootRow = settingsData.findIndex(function (row) { return row[0] === 'DRIVE_ROOT_FOLDER_ID'; });
  let rootId = rootRow >= 0 ? settingsData[rootRow][1] : '';
  let root;
  try { if (rootId) root = DriveApp.getFolderById(rootId); } catch (error) { root = null; }
  if (!root) {
    root = DriveApp.createFolder(CONFIG.ROOT_FOLDER_NAME);
    rootId = root.getId();
    if (rootRow >= 0) settings.getRange(rootRow + 1, 2).setValue(rootId);
  }

  const fleetsSheet = ss.getSheetByName(CONFIG.SHEETS.FLEETS);
  const fleetData = fleetsSheet.getDataRange().getValues();
  const headers = fleetData[0];
  const idCol = headers.indexOf('Fleet ID');
  const folderCol = headers.indexOf('Folder ID');
  const fleetRow = fleetData.findIndex(function (row, index) { return index > 0 && row[idCol] === fleet['Fleet ID']; });
  let folderId = fleetRow > 0 ? fleetData[fleetRow][folderCol] : '';
  let folder;
  try { if (folderId) folder = DriveApp.getFolderById(folderId); } catch (error) { folder = null; }
  if (!folder) {
    folder = root.createFolder(fleet['Fleet ID'] + ' - ' + fleet['Fleet Company']);
    if (fleetRow > 0) fleetsSheet.getRange(fleetRow + 1, folderCol + 1).setValue(folder.getId());
  }
  return folder;
}

function validateInvoicePayload_(payload) {
  if (!payload || !payload.fleetId) throw new Error('Choose a fleet.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(payload.period || ''))) throw new Error('Period must use YYYY-MM.');
  if (!(Number(payload.amount) > 0)) throw new Error('Enter an amount greater than zero.');
  if (String(payload.mimeType || '').toLowerCase() !== 'application/pdf') throw new Error('Only PDF invoices are accepted.');
  if (!payload.base64) throw new Error('Choose a PDF file.');
}

function nextInvoiceId_(ss) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.INVOICES);
  const ids = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues().flat();
  const max = ids.reduce(function (value, id) {
    const match = String(id).match(/INV-(\d+)/);
    return match ? Math.max(value, Number(match[1])) : value;
  }, 0);
  return 'INV-' + String(max + 1).padStart(4, '0');
}

function appendRowByName_(sheetName, row) {
  getSpreadsheet_().getSheetByName(sheetName).appendRow(row);
}

function appendAudit_(action, details) {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.AUDIT);
    sheet.appendRow(['Timestamp', 'Actor', 'Action', 'Details']);
  }
  sheet.appendRow([new Date(), Session.getActiveUser().getEmail() || 'bound-sheet-user', action, details]);
}

function assertAllowedRecipient_(email) {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('The fleet invoice email is missing or invalid.');
  if (CONFIG.MODE === 'portfolio_demo' && !/@example\.com$/i.test(email)) {
    throw new Error('Demo safety guard: Gmail drafts may only target fabricated example.com addresses.');
  }
}

function extractDriveId_(url) {
  const match = String(url || '').match(/[-\w]{25,}/);
  return match ? match[0] : '';
}

function statusFromProgress_(progress) {
  if (progress >= 1) return 'Ahead';
  if (progress >= 0.85) return 'On track';
  return 'At risk';
}

function vehicleMix_(fleetIndex, week) {
  const mixes = ['E-bike 62% · Bicycle 28% · EV 10%', 'Bicycle 51% · E-bike 42% · E-scooter 7%', 'EV 46% · E-bike 41% · Bicycle 13%', 'E-scooter 48% · E-bike 44% · Bicycle 8%'];
  return mixes[(fleetIndex + week) % mixes.length];
}

function sum_(rows, key) {
  return rows.reduce(function (total, row) { return total + Number(row[key] || 0); }, 0);
}

function serialiseDate_(value) {
  return value instanceof Date ? Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm') : String(value || '');
}

function serialiseMonth_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM');
  }

  const text = String(value || '');
  const match = text.match(/^(\d{4})-(\d{2})/);
  return match ? match[1] + '-' + match[2] : text;
}

function formatMoney_(value) {
  return 'EUR ' + Number(value || 0).toFixed(2);
}

function toast_(message) {
  getSpreadsheet_().toast(message, CONFIG.PROJECT_NAME, 4);
}
