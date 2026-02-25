// =====================================================
// DeenBuddy — COMPLETE SETUP v5
// Updated: checkout_initiated funnel, upsell_3, upsell value
// columns, ROAS calculator, revenue breakdown, daily purchases
// =====================================================
// 1. Open your Google Sheet
// 2. Extensions → Apps Script
// 3. Delete ALL existing code, paste this
// 4. Select "cleanSetup" from function dropdown
// 5. Click Run
// 6. Authorize when prompted
// =====================================================

function cleanSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Clean up any leftover _new tabs from failed previous runs
  var cleanup = ss.getSheets();
  for (var c = 0; c < cleanup.length; c++) {
    if (cleanup[c].getName().indexOf('_new') !== -1) {
      try { ss.deleteSheet(cleanup[c]); } catch(e) {}
    }
  }

  // Create all new tabs first (with temp names to avoid conflicts)
  var dashboard = ss.insertSheet('Dashboard_new');
  var rawData = ss.insertSheet('Raw Data_new');
  var quizDropoff = ss.insertSheet('Quiz Dropoff_new');

  // Set one of the new sheets as active so old ones can be deleted
  ss.setActiveSheet(dashboard);

  // Delete all old sheets
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    var name = allSheets[i].getName();
    if (name.indexOf('_new') === -1) {
      try { ss.deleteSheet(allSheets[i]); } catch(e) {}
    }
  }

  // Rename new sheets to final names
  dashboard.setName('Dashboard');
  rawData.setName('Raw Data');
  quizDropoff.setName('Quiz Dropoff');

  // ==========================================
  // TAB: Raw Data (one row per user, upsert by session_id)
  // ==========================================
  var rdHeaders = [
    'session_id',           // A
    'email',                // B
    'avatar',               // C (seeker / believer / guardian)
    'status',               // D (quiz_started -> quiz_completed -> email_captured -> checkout_initiated -> trial -> purchased -> high_aov)
    'created_at',           // E
    'updated_at',           // F
    'Date',                 // G (auto from created_at)
    'quiz_started_at',      // H
    'quiz_completed_at',    // I
    'email_captured_at',    // J
    'checkout_initiated_at',// K
    'trial_started_at',     // L
    'purchased_at',         // M
    'plan_selected',        // N (monthly / annual / lifetime)
    'revenue',              // O (from Stripe — plan revenue only)
    'upsell_1',             // P (TRUE/FALSE)
    'upsell_2',             // Q (TRUE/FALSE)
    'upsell_3',             // R (TRUE/FALSE)
    'upsell_1_value',       // S (dollar amount)
    'upsell_2_value',       // T (dollar amount)
    'upsell_3_value',       // U (dollar amount)
    'total_revenue',        // V (main + all upsells)
    'high_aov',             // W (TRUE if all upsells bought)
    'fbclid',               // X
    'fbc',                  // Y
    'fbp',                  // Z
    'external_id',          // AA
    'client_ip',            // AB
    'user_agent',           // AC
    'device_type',          // AD (mobile / desktop / tablet)
    'browser',              // AE (Chrome / Safari / Firefox / etc)
    'city',                 // AF
    'state',                // AG
    'zip',                  // AH
    'country',              // AI
    'utm_source',           // AJ
    'utm_medium',           // AK
    'utm_campaign',         // AL
    'utm_campaign_id',      // AM
    'utm_adset',            // AN
    'utm_adset_id',         // AO
    'utm_ad',               // AP
    'utm_ad_id',            // AQ
    'source_url',           // AR
    'referrer',             // AS
    'variant',              // AT (A/B test variant)
    'answers_json',         // AU
    'stripe_customer_id',   // AV
    'browser_id'            // AW (persistent browser fingerprint)
  ];
  formatHeaders(rawData, rdHeaders);
  // Date column (G) is populated directly by n8n code nodes — no formula needed
  rawData.getRange('G1').setNumberFormat('yyyy-mm-dd');
  rawData.setColumnWidth(7, 100);

  // ==========================================
  // TAB: Quiz Dropoff
  // ==========================================
  var qdHeaders = [
    'Timestamp',            // A
    'Date',                 // B (auto)
    'session_id',           // C
    'browser_id',           // D
    'Step Number',          // E
    'Question',             // F
    'Answer',               // G
    'Total Steps',          // H
    'Avatar',               // I
    'utm_source',           // J
    'utm_medium',           // K
    'utm_campaign',         // L
    'utm_campaign_id',      // M
    'utm_adset',            // N
    'utm_adset_id',         // O
    'utm_ad',               // P
    'utm_ad_id',            // Q
    'device_type',          // R
    'IP Address',           // S
    'User Agent',           // T
    'Source URL'             // U
  ];
  formatHeaders(quizDropoff, qdHeaders);
  quizDropoff.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="","",IFERROR(DATEVALUE(LEFT(A2:A,10)),IF(ISNUMBER(A2:A),INT(A2:A),""))))');
  quizDropoff.getRange('B2').setFontColor('#888888').setNumberFormat('yyyy-mm-dd');
  quizDropoff.setColumnWidth(2, 100);

  // ==========================================
  // TAB: Dashboard
  // ==========================================
  buildDashboard(dashboard);

  // Reorder
  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(1);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    'Setup complete!\n\n' +
    '3 tabs created:\n' +
    '  Dashboard — funnel, revenue, ROAS, avatar breakdown, daily trends\n' +
    '  Raw Data — one row per user (upserted by session_id)\n' +
    '  Quiz Dropoff — step-by-step answer tracking\n\n' +
    'Date filter: leave blank = all time'
  );
}


// =====================================================
// DASHBOARD
// =====================================================
function buildDashboard(sheet) {
  sheet.clear();

  var GREEN = '#51A780';
  var DARK = '#182830';
  var LIGHT = '#F8F8F6';
  var WHITE = '#FFFFFF';
  var RED = '#E05050';
  var GRAY = '#888888';
  var GOLD = '#D4AF37';
  var BLUE = '#3B82F6';
  var YELLOW = '#FFFFF0';

  // Column widths
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 130);
  sheet.setColumnWidth(3, 30);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 30);
  sheet.setColumnWidth(6, 130);
  sheet.setColumnWidth(7, 30);
  sheet.setColumnWidth(8, 130);
  sheet.setColumnWidth(9, 30);
  sheet.setColumnWidth(10, 130);

  // === Title ===
  sheet.getRange('A1').setValue('DeenBuddy — Ads Dashboard').setFontFamily('Inter').setFontSize(18).setFontWeight('bold').setFontColor(DARK);
  sheet.getRange('A2').setValue('Customer database + funnel analytics. Filter by date range below.').setFontFamily('Inter').setFontSize(10).setFontColor(GRAY).setFontStyle('italic');

  // === Date Filter (row 3) ===
  sheet.getRange('A3').setValue('Start Date:').setFontFamily('Inter').setFontSize(11).setFontWeight('bold').setFontColor(DARK);
  sheet.getRange('B3').setNumberFormat('yyyy-mm-dd').setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  sheet.getRange('B3').setBorder(true,true,true,true,false,false,'#E8E8E4',SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setBackground(YELLOW);
  sheet.getRange('D3').setNumberFormat('yyyy-mm-dd').setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  sheet.getRange('D3').setBorder(true,true,true,true,false,false,'#E8E8E4',SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setBackground(YELLOW);
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  sheet.getRange('B3').setDataValidation(dateRule);
  sheet.getRange('D3').setDataValidation(dateRule);
  sheet.getRange('C3').setValue('->').setFontFamily('Inter').setFontSize(11).setHorizontalAlignment('center').setFontColor(GRAY);
  sheet.getRange('F3').setValue('Leave blank = all time').setFontFamily('Inter').setFontSize(10).setFontColor(GRAY).setFontStyle('italic');
  sheet.setRowHeight(3, 36);

  // Date filter helpers
  // v5 columns: G=Date, H=quiz_started_at, I=quiz_completed_at, J=email_captured_at,
  //   K=checkout_initiated_at, L=trial_started_at, M=purchased_at, N=plan_selected,
  //   O=revenue, P=upsell_1, Q=upsell_2, R=upsell_3, S=upsell_1_value, T=upsell_2_value,
  //   U=upsell_3_value, V=total_revenue, W=high_aov
  var DS = 'IF($B$3="",DATE(2020,1,1),$B$3)';
  var DE = 'IF($D$3="",DATE(2030,12,31),$D$3)';
  var RD = "'Raw Data'!G2:G";   // Raw Data date col
  var QD = "'Quiz Dropoff'!B2:B";

  var r = 5;

  // =====================
  // TODAY'S SNAPSHOT (always today, ignores filter)
  // =====================
  sec(sheet, r, "TODAY'S SNAPSHOT"); r++;
  lbl(sheet, r, 1, 'Visitors Today');
  lbl(sheet, r, 2, 'Emails Today');
  lbl(sheet, r, 4, 'Checkouts Today');
  lbl(sheet, r, 6, 'Purchases Today');
  lbl(sheet, r, 8, 'Revenue Today');
  r++;
  big(sheet, r, 1, "=COUNTIFS('Raw Data'!H2:H,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 2, "=COUNTIFS('Raw Data'!J2:J,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 4, "=COUNTIFS('Raw Data'!K2:K,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 6, "=COUNTIFS('Raw Data'!M2:M,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 8, "=SUMIFS('Raw Data'!V2:V,'Raw Data'!G2:G,TODAY())", GREEN, '$#,##0');
  r += 2;

  // =====================
  // VISUAL CONVERSION FUNNEL (colored bars + CVR)
  // Page Views -> Quiz Started -> Quiz Completed -> Email Captured -> Checkout Initiated -> Purchased
  // =====================
  sec(sheet, r, 'CONVERSION FUNNEL'); r++;

  // Funnel stages: label, count formula, bar color
  // v5 column mapping: H=quiz_started_at, I=quiz_completed_at, J=email_captured_at,
  //   K=checkout_initiated_at, M=purchased_at
  var funnelStages = [
    ['Page Views',          "=COUNTIFS(" + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                                          '#F5A623'],
    ['Quiz Started',        "=COUNTIFS('Raw Data'!H2:H,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                   '#F27B6B'],
    ['Quiz Completed',      "=COUNTIFS('Raw Data'!I2:I,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                   '#F09CA0'],
    ['Email Captured',      "=COUNTIFS('Raw Data'!J2:J,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                   '#C4A0E8'],
    ['Checkout Initiated',  "=COUNTIFS('Raw Data'!K2:K,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                   '#7CB3F0'],
    ['Purchased',           "=COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")",                   '#6DD4A0']
  ];
  var funnelCVR = ['', 'View->Start', 'Start->Done', 'Done->Email', 'Email->Checkout', 'Checkout->Buy'];

  var fStart = r;
  for (var f = 0; f < funnelStages.length; f++) {
    var fr = r + f;
    var barColor = funnelStages[f][2];
    // Bar width: widest=7 cells, shrinks by 1 each stage (min 2)
    var barWidth = Math.max(2, 7 - f);

    // Stage label — dark background, white text
    sheet.getRange(fr, 1).setValue(funnelStages[f][0])
      .setFontFamily('Inter').setFontSize(11).setFontWeight('bold')
      .setFontColor(WHITE).setBackground('#333333')
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setRowHeight(fr, 38);

    // Colored bar cells
    for (var bci = 2; bci <= 1 + barWidth; bci++) {
      sheet.getRange(fr, bci).setBackground(barColor);
    }
    // White cells after bar
    for (var wci = 2 + barWidth; wci <= 8; wci++) {
      sheet.getRange(fr, wci).setBackground(WHITE);
    }

    // Count in the center of the bar
    var centerCol = 2 + Math.floor(barWidth / 2);
    sheet.getRange(fr, centerCol).setFormula(funnelStages[f][1])
      .setFontFamily('Inter').setFontSize(14).setFontWeight('bold')
      .setFontColor(WHITE).setHorizontalAlignment('center');

    // Also put count in column 9 (hidden — used by formulas + charts)
    sheet.getRange(fr, 9).setFormula(funnelStages[f][1])
      .setFontFamily('Inter').setFontSize(1).setFontColor(WHITE);
  }

  // CVR column
  sheet.setColumnWidth(10, 120);
  sheet.setColumnWidth(11, 80);
  sheet.getRange(fStart, 10).setValue('CVR').setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(DARK);

  for (var cv = 1; cv < funnelStages.length; cv++) {
    var cvr = fStart + cv;
    sheet.getRange(cvr, 10).setValue(funnelCVR[cv])
      .setFontFamily('Inter').setFontSize(10).setFontColor('#505050');
    sheet.getRange(cvr, 11)
      .setFormula('=IF(I' + (cvr - 1) + '=0,"—",TEXT(I' + cvr + '/I' + (cvr - 1) + ',"0.0%"))')
      .setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(DARK);
  }

  // Overall conversion
  r = fStart + funnelStages.length;
  sheet.getRange(r, 10).setValue('Overall').setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(DARK);
  sheet.getRange(r, 11).setFormula('=IF(I' + fStart + '=0,"—",TEXT(I' + (fStart + funnelStages.length - 1) + '/I' + fStart + ',"0.00%"))')
    .setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  r += 2;

  // =====================
  // REVENUE (filtered)
  // =====================
  sec(sheet, r, 'REVENUE'); r++;

  // Row 1: Total Revenue, Front-End AOV, Full-Stack AOV
  lbl(sheet, r, 1, 'Total Revenue');
  lbl(sheet, r, 2, 'Front-End AOV');
  lbl(sheet, r, 4, 'Full-Stack AOV');
  lbl(sheet, r, 6, 'Upsell 1 Take %');
  lbl(sheet, r, 8, 'Upsell 2 Take %');
  lbl(sheet, r, 10, 'Upsell 3 Take %');
  r++;
  // Total Revenue = SUM of total_revenue (col V)
  big(sheet, r, 1, "=SUMIFS('Raw Data'!V2:V," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GREEN, '$#,##0.00');
  // Front-End AOV = average of plan revenue only (col O), for purchasers
  big(sheet, r, 2, "=IFERROR(AVERAGEIFS('Raw Data'!O2:O,'Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '$#,##0.00');
  // Full-Stack AOV = average of total_revenue (col V), for purchasers
  big(sheet, r, 4, "=IFERROR(AVERAGEIFS('Raw Data'!V2:V,'Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '$#,##0.00');
  // Upsell 1 Take % = upsell_1 TRUE / total purchasers (col P)
  big(sheet, r, 6, "=IFERROR(COUNTIFS('Raw Data'!P2:P,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")/COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '0.0%');
  // Upsell 2 Take % (col Q)
  big(sheet, r, 8, "=IFERROR(COUNTIFS('Raw Data'!Q2:Q,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")/COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '0.0%');
  // Upsell 3 Take % (col R)
  big(sheet, r, 10, "=IFERROR(COUNTIFS('Raw Data'!R2:R,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")/COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '0.0%');
  r += 2;

  // Row 2: Upsell Revenue breakdown
  lbl(sheet, r, 1, 'Upsell 1 Revenue');
  lbl(sheet, r, 2, 'Upsell 2 Revenue');
  lbl(sheet, r, 4, 'Upsell 3 Revenue');
  lbl(sheet, r, 6, 'Total Upsell Revenue');
  r++;
  // Upsell 1 Revenue = SUM of upsell_1_value (col S)
  big(sheet, r, 1, "=SUMIFS('Raw Data'!S2:S," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GOLD, '$#,##0.00');
  // Upsell 2 Revenue = SUM of upsell_2_value (col T)
  big(sheet, r, 2, "=SUMIFS('Raw Data'!T2:T," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GOLD, '$#,##0.00');
  // Upsell 3 Revenue = SUM of upsell_3_value (col U)
  big(sheet, r, 4, "=SUMIFS('Raw Data'!U2:U," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GOLD, '$#,##0.00');
  // Total Upsell Revenue = sum of all three
  big(sheet, r, 6, "=SUMIFS('Raw Data'!S2:S," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")+SUMIFS('Raw Data'!T2:T," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")+SUMIFS('Raw Data'!U2:U," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GOLD, '$#,##0.00');
  r += 2;

  // =====================
  // ROAS CALCULATOR
  // =====================
  sec(sheet, r, 'ROAS CALCULATOR'); r++;

  // Labels row
  lbl(sheet, r, 1, 'Ad Spend (enter manually)');
  lbl(sheet, r, 2, 'Total Revenue');
  lbl(sheet, r, 4, 'ROAS');
  lbl(sheet, r, 6, 'CPA');
  r++;

  var roasRow = r;
  // Ad Spend input cell — yellow background, editable
  sheet.getRange(roasRow, 1)
    .setValue(0)
    .setFontFamily('Inter').setFontSize(22).setFontWeight('bold').setFontColor(DARK)
    .setNumberFormat('$#,##0.00')
    .setBackground('#FFFDE7')
    .setBorder(true,true,true,true,false,false,'#D4AF37',SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // Total Revenue (mirrors the revenue total above)
  big(sheet, roasRow, 2, "=SUMIFS('Raw Data'!V2:V," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GREEN, '$#,##0.00');

  // ROAS = Revenue / Spend
  big(sheet, roasRow, 4, '=IF(A' + roasRow + '=0,"--",TEXT(B' + roasRow + '/A' + roasRow + ',"0.00") & "x")', BLUE);
  // Override number format — ROAS shows as text with "x" suffix
  sheet.getRange(roasRow, 4).setNumberFormat('@');

  // CPA = Spend / Purchases
  var purchaseCountFormula = "COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")";
  big(sheet, roasRow, 6, '=IF(A' + roasRow + '=0,"--",IF(' + purchaseCountFormula + '=0,"--",A' + roasRow + '/' + purchaseCountFormula + '))', RED, '$#,##0.00');

  r += 2;

  // =====================
  // AVATAR BREAKDOWN (filtered)
  // =====================
  sec(sheet, r, 'AVATAR BREAKDOWN — which persona converts best?'); r++;

  var ahRange = sheet.getRange(r, 1, 1, 8);
  ahRange.setValues([['Metric', 'Seeker', '', 'Believer', '', 'Guardian', '', 'Best']]);
  ahRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  var avatars = ['seeker', 'believer', 'guardian'];
  var avatarCols = [2, 4, 6]; // B, D, F
  // v5: removed Download Clicked, added Checkout Initiated
  // Raw Data columns: H=quiz_started_at, J=email_captured_at, K=checkout_initiated_at, M=purchased_at, V=total_revenue
  var avatarMetrics = [
    ['Quiz Started',        'H'],
    ['Email Captured',      'J'],
    ['Checkout Initiated',  'K'],
    ['Purchased',           'M'],
    ['Revenue',             'V']
  ];

  for (var m = 0; m < avatarMetrics.length; m++) {
    var mr = r + m;
    sheet.getRange(mr, 1).setValue(avatarMetrics[m][0]).setFontFamily('Inter').setFontSize(10);
    var dataCol = avatarMetrics[m][1];

    for (var a = 0; a < avatars.length; a++) {
      var col = avatarCols[a];
      if (dataCol === 'V') {
        sheet.getRange(mr, col).setFormula(
          "=SUMIFS('Raw Data'!" + dataCol + "2:" + dataCol + ",'Raw Data'!C2:C,\"" + avatars[a] + "\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"
        ).setNumberFormat('$#,##0').setFontFamily('Inter').setFontSize(10);
      } else {
        sheet.getRange(mr, col).setFormula(
          "=COUNTIFS('Raw Data'!C2:C,\"" + avatars[a] + "\",'Raw Data'!" + dataCol + "2:" + dataCol + ",\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"
        ).setFontFamily('Inter').setFontSize(10);
      }
    }

    // "Best" column — shows which avatar is winning
    var bCell = sheet.getRange(mr, 8);
    bCell.setFormula('=IF(AND(B' + mr + '=0,D' + mr + '=0,F' + mr + '=0),"—",IF(B' + mr + '>=D' + mr + ',IF(B' + mr + '>=F' + mr + ',"Seeker","Guardian"),IF(D' + mr + '>=F' + mr + ',"Believer","Guardian")))');
    bCell.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(GREEN);

    if (m % 2 === 0) sheet.getRange(mr, 1, 1, 8).setBackground(LIGHT);

    // Highlight Purchased row
    if (avatarMetrics[m][0] === 'Purchased') {
      sheet.getRange(mr, 1, 1, 8).setBackground('#E8F5E9');
    }
  }
  var avatarDataRow = r; // save row reference for pie chart
  r += avatarMetrics.length + 1;

  // =====================
  // QUIZ DROPOFF — which question loses people?
  // =====================
  sec(sheet, r, 'QUIZ DROPOFF — which question loses people?'); r++;

  var qdHRange = sheet.getRange(r, 1, 1, 4);
  qdHRange.setValues([['Step', 'Responses', 'Drop-off %', 'Question']]);
  qdHRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  var qdStart = r;
  var quizQuestions = [
    'Journey / Age',
    'Connection to Islam',
    'Where you learn / Age',
    'Embarrassed to ask?',
    'Most overwhelming',
    'Prayer consistency',
    'Holding you back',
    'Believe vs living gap'
  ];
  for (var q = 0; q < 8; q++) {
    var qr = qdStart + q;
    sheet.getRange(qr, 1).setValue('Step ' + (q + 1)).setFontFamily('Inter').setFontSize(10);
    sheet.getRange(qr, 2).setFormula("=COUNTIFS('Quiz Dropoff'!E2:E," + (q + 1) + ")").setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
    if (q === 0) {
      sheet.getRange(qr, 3).setValue('—').setFontFamily('Inter').setFontSize(10);
    } else {
      sheet.getRange(qr, 3).setFormula('=IF(B' + (qr - 1) + '=0,"—",TEXT(1-(B' + qr + '/B' + (qr - 1) + '),"0.0%"))').setFontFamily('Inter').setFontSize(10);
    }
    sheet.getRange(qr, 4).setValue(quizQuestions[q] || '').setFontFamily('Inter').setFontSize(10).setFontColor(GRAY);
    if (q % 2 === 0) sheet.getRange(qr, 1, 1, 4).setBackground(LIGHT);
  }
  r += 9;

  // =====================
  // DAILY TRENDS (last 14 days)
  // Date | Visitors | Emails | Checkouts | Purchases | Revenue | Purchase Conv %
  // =====================
  sec(sheet, r, 'DAILY TRENDS — last 14 days'); r++;

  var dtHRange = sheet.getRange(r, 1, 1, 7);
  dtHRange.setValues([['Date', 'Visitors', 'Emails', 'Checkouts', 'Purchases', 'Revenue', 'Purchase Conv %']]);
  dtHRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  var dtStart = r;
  for (var d = 0; d < 14; d++) {
    var dtR = r + d;
    // Date formula: TODAY - (13-d) so most recent is at the bottom
    var dayOffset = 13 - d;
    sheet.getRange(dtR, 1).setFormula('=TODAY()-' + dayOffset).setNumberFormat('ddd mm/dd').setFontFamily('Inter').setFontSize(10);
    // Visitors (quiz_started_at col H not empty)
    sheet.getRange(dtR, 2).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!H2:H,\"<>\")").setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
    // Emails (email_captured_at col J)
    sheet.getRange(dtR, 3).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!J2:J,\"<>\")").setFontFamily('Inter').setFontSize(10);
    // Checkouts (checkout_initiated_at col K)
    sheet.getRange(dtR, 4).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!K2:K,\"<>\")").setFontFamily('Inter').setFontSize(10);
    // Purchases (purchased_at col M)
    sheet.getRange(dtR, 5).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!M2:M,\"<>\")").setFontFamily('Inter').setFontSize(10);
    // Revenue (total_revenue col V)
    sheet.getRange(dtR, 6).setFormula("=SUMIFS('Raw Data'!V2:V,'Raw Data'!G2:G,A" + dtR + ")").setNumberFormat('$#,##0').setFontFamily('Inter').setFontSize(10);
    // Purchase Conv % = Purchases / Visitors
    sheet.getRange(dtR, 7).setFormula('=IF(B' + dtR + '=0,"—",TEXT(E' + dtR + '/B' + dtR + ',"0.0%"))').setFontFamily('Inter').setFontSize(10);
    if (d % 2 === 0) sheet.getRange(dtR, 1, 1, 7).setBackground(LIGHT);
  }
  r += 15;

  // =====================
  // CHARTS
  // =====================
  var existingCharts = sheet.getCharts();
  for (var ci2 = 0; ci2 < existingCharts.length; ci2++) {
    sheet.removeChart(existingCharts[ci2]);
  }

  // 1) Funnel is now visual colored bars — no separate chart needed

  // 2) DAILY TRENDS LINE CHART
  var trendDateRange = sheet.getRange(dtStart, 1, 14, 1);
  var trendVisitors = sheet.getRange(dtStart, 2, 14, 1);
  var trendEmails = sheet.getRange(dtStart, 3, 14, 1);
  var trendPurchases = sheet.getRange(dtStart, 5, 14, 1);

  var trendChart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(trendDateRange)
    .addRange(trendVisitors)
    .addRange(trendEmails)
    .addRange(trendPurchases)
    .setPosition(dtStart, 8, 0, 0)
    .setOption('title', 'Daily Trends (14 days)')
    .setOption('titleTextStyle', {fontSize: 13, fontName: 'Inter', bold: true, color: '#182830'})
    .setOption('legend', {position: 'bottom', textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('hAxis', {textStyle: {fontSize: 9, fontName: 'Inter'}, slantedText: true})
    .setOption('vAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}, minValue: 0})
    .setOption('colors', ['#182830', '#51A780', '#6DD4A0'])
    .setOption('backgroundColor', {fill: '#FFFFFF'})
    .setOption('chartArea', {left: '10%', top: '15%', width: '80%', height: '65%'})
    .setOption('curveType', 'function')
    .setOption('pointSize', 4)
    .setOption('width', 450)
    .setOption('height', 280)
    .build();

  sheet.insertChart(trendChart);

  // 3) QUIZ DROPOFF BAR CHART
  var qdLabelRange = sheet.getRange(qdStart, 1, 8, 1);
  var qdDataRange = sheet.getRange(qdStart, 2, 8, 1);

  var qdChart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(qdLabelRange)
    .addRange(qdDataRange)
    .setPosition(qdStart, 6, 0, 0)
    .setOption('title', 'Quiz Step Drop-off')
    .setOption('titleTextStyle', {fontSize: 13, fontName: 'Inter', bold: true, color: '#182830'})
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('vAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('colors', ['#E05050'])
    .setOption('backgroundColor', {fill: '#FFFFFF'})
    .setOption('chartArea', {left: '20%', top: '12%', width: '72%', height: '78%'})
    .setOption('bar', {groupWidth: '65%'})
    .setOption('width', 420)
    .setOption('height', 300)
    .build();

  sheet.insertChart(qdChart);

  // 4) AVATAR PIE CHART (uses Quiz Started row from avatar breakdown)
  // Build a small helper range for the pie chart data
  // We'll use a hidden area at the bottom for pie chart data
  var pieRow = r + 20;
  sheet.getRange(pieRow, 1).setValue('Seeker').setFontFamily('Inter').setFontSize(10);
  sheet.getRange(pieRow, 2).setFormula("=COUNTIFS('Raw Data'!C2:C,\"seeker\")");
  sheet.getRange(pieRow + 1, 1).setValue('Believer').setFontFamily('Inter').setFontSize(10);
  sheet.getRange(pieRow + 1, 2).setFormula("=COUNTIFS('Raw Data'!C2:C,\"believer\")");
  sheet.getRange(pieRow + 2, 1).setValue('Guardian').setFontFamily('Inter').setFontSize(10);
  sheet.getRange(pieRow + 2, 2).setFormula("=COUNTIFS('Raw Data'!C2:C,\"guardian\")");
  sheet.getRange(pieRow, 1, 3, 2).setFontColor('#FFFFFF'); // hide the helper data (white text)

  var pieLabelRange = sheet.getRange(pieRow, 1, 3, 1);
  var pieDataRange = sheet.getRange(pieRow, 2, 3, 1);

  var pieChart = sheet.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(pieLabelRange)
    .addRange(pieDataRange)
    .setPosition(avatarDataRow, 9, 0, 0)
    .setOption('title', 'Avatar Distribution')
    .setOption('titleTextStyle', {fontSize: 13, fontName: 'Inter', bold: true, color: '#182830'})
    .setOption('legend', {position: 'right', textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('colors', ['#3B82F6', '#51A780', '#D4AF37'])
    .setOption('backgroundColor', {fill: '#FFFFFF'})
    .setOption('chartArea', {left: '5%', top: '15%', width: '90%', height: '75%'})
    .setOption('pieSliceTextStyle', {fontSize: 11, fontName: 'Inter', color: '#FFFFFF'})
    .setOption('width', 350)
    .setOption('height', 280)
    .build();

  sheet.insertChart(pieChart);
}


// =====================================================
// HELPERS
// =====================================================
function formatHeaders(sheet, headers) {
  var range = sheet.getRange(1, 1, 1, headers.length);
  range.setValues([headers]);
  range.setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
  range.setFontColor('#FFFFFF').setBackground('#182830');
  range.setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  for (var i = 1; i <= headers.length; i++) {
    sheet.setColumnWidth(i, Math.max(110, headers[i-1].length * 9));
  }
  sheet.setColumnWidth(1, 180);
}

function sec(sheet, row, text) {
  sheet.getRange(row, 1, 1, 10).setBackground('#51A780');
  sheet.getRange(row, 1).setValue(text).setFontFamily('Inter').setFontSize(11).setFontWeight('bold').setFontColor('#FFFFFF');
  sheet.setRowHeight(row, 32);
}

function lbl(sheet, row, col, text) {
  sheet.getRange(row, col).setValue(text).setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor('#505050');
}

function big(sheet, row, col, formula, color, fmt) {
  var cell = sheet.getRange(row, col);
  cell.setFormula(formula);
  cell.setFontFamily('Inter').setFontSize(22).setFontWeight('bold').setFontColor(color);
  if (fmt) cell.setNumberFormat(fmt);
}


// =====================================================
// MENU
// =====================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu('DeenBuddy')
    .addItem('Re-run Setup', 'cleanSetup')
    .addToUi();
}
