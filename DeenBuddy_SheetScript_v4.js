// =====================================================
// DeenBuddy — COMPLETE SETUP v4
// Updated: download_clicked funnel, device/browser tracking,
// UTM breakdown, daily trends, A/B variant support
// =====================================================
// 1. Open your Google Sheet
// 2. Extensions → Apps Script
// 3. Delete ALL existing code, paste this
// 4. Select "cleanSetup" from function dropdown
// 5. Click Run ▶
// 6. Authorize when prompted
// =====================================================

function cleanSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Create all new tabs first (with temp names to avoid conflicts)
  var dashboard = ss.insertSheet('Dashboard_new');
  var rawData = ss.insertSheet('Raw Data_new');
  var events = ss.insertSheet('Events_new');
  var quizDropoff = ss.insertSheet('Quiz Dropoff_new');
  var adPerf = ss.insertSheet('Ad Performance_new');

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
  events.setName('Events');
  quizDropoff.setName('Quiz Dropoff');
  adPerf.setName('Ad Performance');

  // ==========================================
  // TAB: Raw Data (one row per user, upsert by session_id)
  // ==========================================
  var rdHeaders = [
    'session_id',           // A
    'email',                // B
    'avatar',               // C (seeker / believer / guardian)
    'status',               // D (quiz_started → quiz_completed → email_captured → download_clicked → trial → purchased → high_aov)
    'created_at',           // E
    'updated_at',           // F
    'Date',                 // G (auto from created_at)
    'quiz_started_at',      // H
    'quiz_completed_at',    // I
    'email_captured_at',    // J
    'download_clicked_at',  // K ← NEW: App Store click
    'checkout_initiated_at',// L
    'trial_started_at',     // M
    'purchased_at',         // N
    'plan_selected',        // O (monthly / annual / lifetime)
    'revenue',              // P (from Stripe)
    'upsell_1',             // Q (TRUE/FALSE)
    'upsell_2',             // R (TRUE/FALSE)
    'total_revenue',        // S (main + all upsells)
    'high_aov',             // T (TRUE if all upsells bought)
    'fbclid',               // U
    'fbc',                  // V
    'fbp',                  // W
    'external_id',          // X
    'client_ip',            // Y
    'user_agent',           // Z
    'device_type',          // AA ← NEW: mobile / desktop / tablet
    'browser',              // AB ← NEW: Chrome / Safari / Firefox / etc
    'city',                 // AC
    'state',                // AD
    'zip',                  // AE
    'country',              // AF
    'utm_source',           // AG
    'utm_medium',           // AH
    'utm_campaign',         // AI
    'utm_campaign_id',      // AJ
    'utm_adset',            // AK
    'utm_adset_id',         // AL
    'utm_ad',               // AM
    'utm_ad_id',            // AN
    'source_url',           // AO
    'referrer',             // AP ← NEW
    'variant',              // AQ ← NEW: A/B test variant
    'answers_json',         // AR
    'stripe_customer_id',   // AS
    'browser_id'            // AT ← NEW: persistent browser fingerprint
  ];
  formatHeaders(rawData, rdHeaders);
  // Auto Date column from created_at
  rawData.getRange('G2').setFormula('=ARRAYFORMULA(IF(E2:E="","",IFERROR(DATEVALUE(LEFT(E2:E,10)),IF(ISNUMBER(E2:E),INT(E2:E),""))))');
  rawData.getRange('G2').setFontColor('#888888').setNumberFormat('yyyy-mm-dd');
  rawData.setColumnWidth(7, 100);

  // ==========================================
  // TAB: Events (one row per CAPI event fired)
  // ==========================================
  var evHeaders = [
    'Timestamp',            // A
    'Date',                 // B (auto)
    'Event Name',           // C (our internal name)
    'Meta Event Name',      // D (what we send to Meta: ViewContent, Lead, etc.)
    'Email',                // E
    'Event Value',          // F
    'Currency',             // G
    'Event ID',             // H (session_id + event for dedup)
    'Meta Response Code',   // I
    'EMQ Count',            // J (how many match params sent)
    'session_id',           // K
    'fbc',                  // L
    'fbp',                  // M
    'external_id',          // N
    'IP Address',           // O
    'User Agent',           // P
    'City',                 // Q (hashed for Meta)
    'State',                // R
    'Zip',                  // S
    'Country',              // T
    'utm_source',           // U
    'utm_medium',           // V
    'utm_campaign',         // W
    'utm_campaign_id',      // X
    'utm_adset',            // Y
    'utm_adset_id',         // Z
    'utm_ad',               // AA
    'utm_ad_id',            // AB
    'Stripe Customer ID',   // AC
    'Stripe Invoice ID',    // AD
    'Sent to FB'            // AE
  ];
  formatHeaders(events, evHeaders);
  events.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="","",IFERROR(DATEVALUE(LEFT(A2:A,10)),IF(ISNUMBER(A2:A),INT(A2:A),""))))');
  events.getRange('B2').setFontColor('#888888').setNumberFormat('yyyy-mm-dd');
  events.setColumnWidth(2, 100);

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
    'Avatar',               // I ← NEW
    'utm_source',           // J
    'utm_medium',           // K
    'utm_campaign',         // L
    'utm_campaign_id',      // M
    'utm_adset',            // N
    'utm_adset_id',         // O
    'utm_ad',               // P
    'utm_ad_id',            // Q
    'device_type',          // R ← NEW
    'IP Address',           // S
    'User Agent',           // T
    'Source URL'             // U
  ];
  formatHeaders(quizDropoff, qdHeaders);
  quizDropoff.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="","",IFERROR(DATEVALUE(LEFT(A2:A,10)),IF(ISNUMBER(A2:A),INT(A2:A),""))))');
  quizDropoff.getRange('B2').setFontColor('#888888').setNumberFormat('yyyy-mm-dd');
  quizDropoff.setColumnWidth(2, 100);

  // ==========================================
  // TAB: Ad Performance (manual spend + auto formulas)
  // ==========================================
  var apHeaders = [
    'Campaign',             // A
    'Spend ($)',            // B (manual entry)
    'Quiz Starts',          // C
    'Emails',               // D
    'Downloads',            // E ← primary conversion for now
    'Purchases',            // F (for when Stripe is live)
    'Revenue ($)',          // G
    'Cost / Email',         // H
    'Cost / Download',      // I
    'ROAS',                 // J
    'Quiz→Email %',        // K
    'Email→Download %',    // L
    'Notes'                 // M
  ];
  formatHeaders(adPerf, apHeaders);
  adPerf.setColumnWidth(1, 200);
  adPerf.setColumnWidth(2, 120);
  adPerf.setColumnWidth(13, 250);

  // Column refs for Raw Data (updated for new column positions)
  // AI = utm_campaign, H = quiz_started_at, J = email_captured_at, K = download_clicked_at
  // N = purchased_at, S = total_revenue

  // Add example row with formulas
  adPerf.getRange('A2').setValue('(enter campaign name)').setFontColor('#888888').setFontStyle('italic');
  adPerf.getRange('B2').setValue(0).setNumberFormat('$#,##0.00').setFontColor('#0000FF');
  adPerf.getRange('C2').setFormula('=IF(A2="","",COUNTIFS(\'Raw Data\'!AI2:AI,A2,\'Raw Data\'!H2:H,"<>"))');
  adPerf.getRange('D2').setFormula('=IF(A2="","",COUNTIFS(\'Raw Data\'!AI2:AI,A2,\'Raw Data\'!J2:J,"<>"))');
  adPerf.getRange('E2').setFormula('=IF(A2="","",COUNTIFS(\'Raw Data\'!AI2:AI,A2,\'Raw Data\'!K2:K,"<>"))');
  adPerf.getRange('F2').setFormula('=IF(A2="","",COUNTIFS(\'Raw Data\'!AI2:AI,A2,\'Raw Data\'!N2:N,"<>"))');
  adPerf.getRange('G2').setFormula('=IF(A2="","",SUMIFS(\'Raw Data\'!S2:S,\'Raw Data\'!AI2:AI,A2))');
  adPerf.getRange('H2').setFormula('=IF(D2=0,"—",B2/D2)').setNumberFormat('$#,##0.00');
  adPerf.getRange('I2').setFormula('=IF(E2=0,"—",B2/E2)').setNumberFormat('$#,##0.00');
  adPerf.getRange('J2').setFormula('=IF(B2=0,"—",G2/B2)').setNumberFormat('0.00"x"');
  adPerf.getRange('K2').setFormula('=IF(C2=0,"—",TEXT(D2/C2,"0.0%"))');
  adPerf.getRange('L2').setFormula('=IF(D2=0,"—",TEXT(E2/D2,"0.0%"))');

  // Instructions
  adPerf.getRange('A4').setValue('↑ Copy row 2 formulas down for each campaign. Campaign name must match utm_campaign exactly. Enter spend manually (blue = manual input).').setFontColor('#888888').setFontStyle('italic').setFontSize(9);
  adPerf.getRange('A4:M4').merge();

  // ==========================================
  // TAB: Dashboard
  // ==========================================
  buildDashboard(dashboard);

  // Reorder
  ss.setActiveSheet(dashboard);
  ss.moveActiveSheet(1);

  SpreadsheetApp.flush();
  SpreadsheetApp.getUi().alert(
    '✅ Setup complete!\n\n' +
    '5 tabs created:\n' +
    '• Dashboard — date-filterable funnel, revenue, avatar, device, UTM breakdown + daily trends\n' +
    '• Raw Data — one row per user (upserted by session_id) — your customer database\n' +
    '• Events — one row per CAPI event fired to Meta\n' +
    '• Quiz Dropoff — step-by-step answer tracking\n' +
    '• Ad Performance — manual spend + auto CPA/ROAS per campaign\n\n' +
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
  sheet.getRange('A3').setValue('📅  Start Date:').setFontFamily('Inter').setFontSize(11).setFontWeight('bold').setFontColor(DARK);
  sheet.getRange('B3').setNumberFormat('yyyy-mm-dd').setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  sheet.getRange('B3').setBorder(true,true,true,true,false,false,'#E8E8E4',SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setBackground('#FFFFF0');
  sheet.getRange('D3').setNumberFormat('yyyy-mm-dd').setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  sheet.getRange('D3').setBorder(true,true,true,true,false,false,'#E8E8E4',SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setBackground('#FFFFF0');
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  sheet.getRange('B3').setDataValidation(dateRule);
  sheet.getRange('D3').setDataValidation(dateRule);
  sheet.getRange('C3').setValue('→').setFontFamily('Inter').setFontSize(11).setHorizontalAlignment('center').setFontColor(GRAY);
  sheet.getRange('F3').setValue('Leave blank = all time').setFontFamily('Inter').setFontSize(10).setFontColor(GRAY).setFontStyle('italic');
  sheet.setRowHeight(3, 36);

  // Date filter helpers
  var DS = 'IF($B$3="",DATE(2020,1,1),$B$3)';
  var DE = 'IF($D$3="",DATE(2030,12,31),$D$3)';
  var RD = "'Raw Data'!G2:G";   // Raw Data date col
  var ED = "Events!B2:B";       // Events date col
  var QD = "'Quiz Dropoff'!B2:B";

  var r = 5;

  // =====================
  // TODAY'S SNAPSHOT (always today, ignores filter)
  // =====================
  sec(sheet, r, "⚡ TODAY'S SNAPSHOT"); r++;
  lbl(sheet, r, 1, 'Visitors Today');
  lbl(sheet, r, 2, 'Emails Today');
  lbl(sheet, r, 4, 'Downloads Today');
  lbl(sheet, r, 6, 'Revenue Today');
  r++;
  big(sheet, r, 1, "=COUNTIFS('Raw Data'!H2:H,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 2, "=COUNTIFS('Raw Data'!J2:J,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 4, "=COUNTIFS('Raw Data'!K2:K,\">=\"&TEXT(TODAY(),\"yyyy-mm-dd\"))", GREEN);
  big(sheet, r, 6, "=SUMIFS('Raw Data'!S2:S,'Raw Data'!G2:G,TODAY())", GREEN, '$#,##0');
  r += 2;

  // =====================
  // CONVERSION FUNNEL (filtered)
  // =====================
  sec(sheet, r, '🔻 CONVERSION FUNNEL'); r++;

  var fhRange = sheet.getRange(r, 1, 1, 5);
  fhRange.setValues([['Stage', 'Count', 'Step Conv %', 'Cumulative %', 'Drop-off %']]);
  fhRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  // Updated column refs for new Raw Data layout:
  // H = quiz_started_at, I = quiz_completed_at, J = email_captured_at
  // K = download_clicked_at, L = checkout_initiated_at, M = trial_started_at
  // N = purchased_at, T = high_aov
  var funnelStages = [
    ['Page Views',          "=COUNTIFS(" + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Quiz Started',        "=COUNTIFS('Raw Data'!H2:H,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Quiz Completed',      "=COUNTIFS('Raw Data'!I2:I,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Email Captured',      "=COUNTIFS('Raw Data'!J2:J,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Download Clicked',    "=COUNTIFS('Raw Data'!K2:K,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Checkout Initiated',  "=COUNTIFS('Raw Data'!L2:L,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Trial Started',       "=COUNTIFS('Raw Data'!M2:M,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['Purchased',           "=COUNTIFS('Raw Data'!N2:N,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"],
    ['High AOV',            "=COUNTIFS('Raw Data'!T2:T,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")"]
  ];

  var fStart = r;
  for (var f = 0; f < funnelStages.length; f++) {
    var fr = r + f;
    sheet.getRange(fr, 1).setValue(funnelStages[f][0]);
    sheet.getRange(fr, 2).setFormula(funnelStages[f][1]);
    if (f === 0) {
      sheet.getRange(fr, 3).setValue('—');
      sheet.getRange(fr, 4).setValue('100%');
      sheet.getRange(fr, 5).setValue('—');
    } else {
      sheet.getRange(fr, 3).setFormula('=IF(B' + (fr-1) + '=0,"—",TEXT(B' + fr + '/B' + (fr-1) + ',"0.0%"))');
      sheet.getRange(fr, 4).setFormula('=IF(B' + fStart + '=0,"—",TEXT(B' + fr + '/B' + fStart + ',"0.0%"))');
      sheet.getRange(fr, 5).setFormula('=IF(B' + (fr-1) + '=0,"—",TEXT(1-(B' + fr + '/B' + (fr-1) + '),"0.0%"))');
    }
    if (f % 2 === 0) sheet.getRange(fr, 1, 1, 5).setBackground(LIGHT);
    sheet.getRange(fr, 1, 1, 5).setFontFamily('Inter').setFontSize(10);
    sheet.getRange(fr, 2).setFontWeight('bold');

    // Highlight Download Clicked row (current money metric)
    if (funnelStages[f][0] === 'Download Clicked') {
      sheet.getRange(fr, 1, 1, 5).setBackground('#E8F5E9');
      sheet.getRange(fr, 1).setFontWeight('bold').setFontColor(GREEN);
    }
  }

  r = fStart + funnelStages.length;
  sheet.getRange(r, 1).setValue('Visitor → Download').setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
  sheet.getRange(r, 2).setFormula('=IF(B' + fStart + '=0,"—",TEXT(B' + (fStart+4) + '/B' + fStart + ',"0.00%"))');
  sheet.getRange(r, 2).setFontFamily('Inter').setFontSize(12).setFontWeight('bold').setFontColor(GREEN);
  r++;
  sheet.getRange(r, 1).setValue('Visitor → Purchase').setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
  sheet.getRange(r, 2).setFormula('=IF(B' + fStart + '=0,"—",TEXT(B' + (fStart+7) + '/B' + fStart + ',"0.00%"))');
  sheet.getRange(r, 2).setFontFamily('Inter').setFontSize(11).setFontWeight('bold').setFontColor(GRAY);
  r += 2;

  // =====================
  // REVENUE (filtered) — will populate when Stripe is live
  // =====================
  sec(sheet, r, '💰 REVENUE (populates when Stripe is live)'); r++;
  lbl(sheet, r, 1, 'Total Revenue');
  lbl(sheet, r, 2, 'Avg Order Value');
  lbl(sheet, r, 4, 'Upsell 1 Take %');
  lbl(sheet, r, 6, 'Upsell 2 Take %');
  r++;
  big(sheet, r, 1, "=SUMIFS('Raw Data'!S2:S," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")", GREEN, '$#,##0.00');
  big(sheet, r, 2, "=IFERROR(AVERAGEIFS('Raw Data'!S2:S,'Raw Data'!N2:N,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '$#,##0.00');
  big(sheet, r, 4, "=IFERROR(COUNTIFS('Raw Data'!Q2:Q,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")/COUNTIFS('Raw Data'!N2:N,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '0.0%');
  big(sheet, r, 6, "=IFERROR(COUNTIFS('Raw Data'!R2:R,TRUE," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")/COUNTIFS('Raw Data'!N2:N,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "),0)", GREEN, '0.0%');
  r += 2;

  // =====================
  // AVATAR BREAKDOWN (filtered)
  // =====================
  sec(sheet, r, '🎯 AVATAR BREAKDOWN — which persona converts best?'); r++;

  var ahRange = sheet.getRange(r, 1, 1, 8);
  ahRange.setValues([['Metric', 'Seeker', '', 'Believer', '', 'Guardian', '', 'Best']]);
  ahRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  var avatars = ['seeker', 'believer', 'guardian'];
  var avatarCols = [2, 4, 6]; // B, D, F
  var avatarMetrics = [
    ['Quiz Started',     'H'],
    ['Email Captured',   'J'],
    ['Download Clicked', 'K'],
    ['Purchased',        'N'],
    ['Revenue',          'S']
  ];

  for (var m = 0; m < avatarMetrics.length; m++) {
    var mr = r + m;
    sheet.getRange(mr, 1).setValue(avatarMetrics[m][0]).setFontFamily('Inter').setFontSize(10);
    var dataCol = avatarMetrics[m][1];

    for (var a = 0; a < avatars.length; a++) {
      var col = avatarCols[a];
      if (dataCol === 'S') {
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

    // Highlight Download row
    if (avatarMetrics[m][0] === 'Download Clicked') {
      sheet.getRange(mr, 1, 1, 8).setBackground('#E8F5E9');
    }
  }
  r += avatarMetrics.length + 1;

  // =====================
  // UTM SOURCE BREAKDOWN (filtered) — which campaigns are working
  // =====================
  sec(sheet, r, '📊 TOP UTM SOURCES — which ads are actually converting?'); r++;

  var uhRange = sheet.getRange(r, 1, 1, 7);
  uhRange.setValues([['utm_source', 'Visitors', 'Emails', 'Downloads', 'Email Conv %', 'Download Conv %', 'Revenue']]);
  uhRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  // Pre-fill 8 rows — user enters utm_source values manually OR we auto-populate
  for (var ui = 0; ui < 8; ui++) {
    var ur = r + ui;
    var srcCell = 'A' + ur;
    if (ui === 0) {
      sheet.getRange(ur, 1).setValue('(enter utm_source)').setFontColor('#888888').setFontStyle('italic');
    }
    // AG = utm_source in Raw Data
    sheet.getRange(ur, 2).setFormula("=IF(" + srcCell + "=\"\",\"\",COUNTIFS('Raw Data'!AG2:AG," + srcCell + ",'Raw Data'!H2:H,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(ur, 3).setFormula("=IF(" + srcCell + "=\"\",\"\",COUNTIFS('Raw Data'!AG2:AG," + srcCell + ",'Raw Data'!J2:J,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(ur, 4).setFormula("=IF(" + srcCell + "=\"\",\"\",COUNTIFS('Raw Data'!AG2:AG," + srcCell + ",'Raw Data'!K2:K,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(ur, 5).setFormula("=IF(B" + ur + "=\"\",\"\",IF(B" + ur + "=0,\"—\",TEXT(C" + ur + "/B" + ur + ",\"0.0%\")))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(ur, 6).setFormula("=IF(C" + ur + "=\"\",\"\",IF(C" + ur + "=0,\"—\",TEXT(D" + ur + "/C" + ur + ",\"0.0%\")))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(ur, 7).setFormula("=IF(" + srcCell + "=\"\",\"\",SUMIFS('Raw Data'!S2:S,'Raw Data'!AG2:AG," + srcCell + "," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setNumberFormat('$#,##0').setFontFamily('Inter').setFontSize(10);
    if (ui % 2 === 0) sheet.getRange(ur, 1, 1, 7).setBackground(LIGHT);
  }
  r += 9;

  // =====================
  // UTM CAMPAIGN BREAKDOWN (filtered) — which specific campaigns
  // =====================
  sec(sheet, r, '🎯 TOP UTM CAMPAIGNS — split test this'); r++;

  var chRange = sheet.getRange(r, 1, 1, 7);
  chRange.setValues([['utm_campaign', 'Visitors', 'Emails', 'Downloads', 'Email Conv %', 'Download Conv %', 'Revenue']]);
  chRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  for (var ci = 0; ci < 10; ci++) {
    var cr = r + ci;
    var campCell = 'A' + cr;
    if (ci === 0) {
      sheet.getRange(cr, 1).setValue('(enter utm_campaign)').setFontColor('#888888').setFontStyle('italic');
    }
    // AI = utm_campaign in Raw Data
    sheet.getRange(cr, 2).setFormula("=IF(" + campCell + "=\"\",\"\",COUNTIFS('Raw Data'!AI2:AI," + campCell + ",'Raw Data'!H2:H,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(cr, 3).setFormula("=IF(" + campCell + "=\"\",\"\",COUNTIFS('Raw Data'!AI2:AI," + campCell + ",'Raw Data'!J2:J,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(cr, 4).setFormula("=IF(" + campCell + "=\"\",\"\",COUNTIFS('Raw Data'!AI2:AI," + campCell + ",'Raw Data'!K2:K,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(cr, 5).setFormula("=IF(B" + cr + "=\"\",\"\",IF(B" + cr + "=0,\"—\",TEXT(C" + cr + "/B" + cr + ",\"0.0%\")))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(cr, 6).setFormula("=IF(C" + cr + "=\"\",\"\",IF(C" + cr + "=0,\"—\",TEXT(D" + cr + "/C" + cr + ",\"0.0%\")))").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(cr, 7).setFormula("=IF(" + campCell + "=\"\",\"\",SUMIFS('Raw Data'!S2:S,'Raw Data'!AI2:AI," + campCell + "," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + "))").setNumberFormat('$#,##0').setFontFamily('Inter').setFontSize(10);
    if (ci % 2 === 0) sheet.getRange(cr, 1, 1, 7).setBackground(LIGHT);
  }
  r += 11;

  // =====================
  // A/B VARIANT COMPARISON (filtered)
  // =====================
  sec(sheet, r, '🧪 A/B TEST VARIANTS — pass ?variant=A or ?variant=B in your ad URLs'); r++;

  var vhRange = sheet.getRange(r, 1, 1, 7);
  vhRange.setValues([['Variant', 'Visitors', 'Emails', 'Downloads', 'Email Conv %', 'Download Conv %', 'Winner?']]);
  vhRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  for (var vi = 0; vi < 4; vi++) {
    var vr = r + vi;
    var varCell = 'A' + vr;
    var varLabels = ['control', 'A', 'B', 'C'];
    sheet.getRange(vr, 1).setValue(varLabels[vi]).setFontFamily('Inter').setFontSize(10);
    // AQ = variant in Raw Data
    sheet.getRange(vr, 2).setFormula("=COUNTIFS('Raw Data'!AQ2:AQ," + varCell + ",'Raw Data'!H2:H,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")").setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
    sheet.getRange(vr, 3).setFormula("=COUNTIFS('Raw Data'!AQ2:AQ," + varCell + ",'Raw Data'!J2:J,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(vr, 4).setFormula("=COUNTIFS('Raw Data'!AQ2:AQ," + varCell + ",'Raw Data'!K2:K,\"<>\"," + RD + ",\">=\"&" + DS + "," + RD + ",\"<=\"&" + DE + ")").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(vr, 5).setFormula('=IF(B' + vr + '=0,"—",TEXT(C' + vr + '/B' + vr + ',"0.0%"))').setFontFamily('Inter').setFontSize(10);
    sheet.getRange(vr, 6).setFormula('=IF(C' + vr + '=0,"—",TEXT(D' + vr + '/C' + vr + ',"0.0%"))').setFontFamily('Inter').setFontSize(10);
    // Winner = highest download conv %
    sheet.getRange(vr, 7).setValue('').setFontFamily('Inter').setFontSize(10);
    if (vi % 2 === 0) sheet.getRange(vr, 1, 1, 7).setBackground(LIGHT);
  }
  // Winner formula for download conv — compare all variants
  var winStart = r;
  for (var wi = 0; wi < 4; wi++) {
    var wr = winStart + wi;
    sheet.getRange(wr, 7).setFormula(
      '=IF(B' + wr + '<10,"Need 10+ visitors",' +
      'IF(AND(D' + wr + '/MAX(1,C' + wr + ')>=D' + winStart + '/MAX(1,C' + winStart + '),' +
      'D' + wr + '/MAX(1,C' + wr + ')>=D' + (winStart+1) + '/MAX(1,C' + (winStart+1) + '),' +
      'D' + wr + '/MAX(1,C' + wr + ')>=D' + (winStart+2) + '/MAX(1,C' + (winStart+2) + '),' +
      'D' + wr + '/MAX(1,C' + wr + ')>=D' + (winStart+3) + '/MAX(1,C' + (winStart+3) + ')),"✅ WINNING",""))'
    ).setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(GREEN);
  }
  r += 5;

  // =====================
  // DAILY TRENDS (filtered — last 14 days)
  // =====================
  sec(sheet, r, '📈 DAILY TRENDS — last 14 days'); r++;

  var dtHRange = sheet.getRange(r, 1, 1, 7);
  dtHRange.setValues([['Date', 'Visitors', 'Emails', 'Downloads', 'Email Conv %', 'Download Conv %', 'Revenue']]);
  dtHRange.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  var dtStart = r;
  for (var d = 0; d < 14; d++) {
    var dtR = r + d;
    // Date formula: TODAY - (13-d) so most recent is at the bottom
    var dayOffset = 13 - d;
    sheet.getRange(dtR, 1).setFormula('=TODAY()-' + dayOffset).setNumberFormat('ddd mm/dd').setFontFamily('Inter').setFontSize(10);
    sheet.getRange(dtR, 2).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!H2:H,\"<>\")").setFontFamily('Inter').setFontSize(10).setFontWeight('bold');
    sheet.getRange(dtR, 3).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!J2:J,\"<>\")").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(dtR, 4).setFormula("=COUNTIFS('Raw Data'!G2:G,A" + dtR + ",'Raw Data'!K2:K,\"<>\")").setFontFamily('Inter').setFontSize(10);
    sheet.getRange(dtR, 5).setFormula('=IF(B' + dtR + '=0,"—",TEXT(C' + dtR + '/B' + dtR + ',"0.0%"))').setFontFamily('Inter').setFontSize(10);
    sheet.getRange(dtR, 6).setFormula('=IF(C' + dtR + '=0,"—",TEXT(D' + dtR + '/C' + dtR + ',"0.0%"))').setFontFamily('Inter').setFontSize(10);
    sheet.getRange(dtR, 7).setFormula("=SUMIFS('Raw Data'!S2:S,'Raw Data'!G2:G,A" + dtR + ")").setNumberFormat('$#,##0').setFontFamily('Inter').setFontSize(10);
    if (d % 2 === 0) sheet.getRange(dtR, 1, 1, 7).setBackground(LIGHT);
  }
  r += 15;

  // =====================
  // HEALTH METRICS (filtered)
  // =====================
  sec(sheet, r, '🏥 HEALTH METRICS'); r++;
  lbl(sheet, r, 1, 'Failed CAPI Sends');
  lbl(sheet, r, 2, 'Cancellations');
  lbl(sheet, r, 4, 'Chargebacks');
  lbl(sheet, r, 6, 'Active Trials');
  r++;
  big(sheet, r, 1, '=COUNTIFS(Events!C2:C,"FailedPayment",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')', RED);
  big(sheet, r, 2, '=COUNTIFS(Events!C2:C,"CancelledSubscription",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')', RED);
  big(sheet, r, 4, '=COUNTIFS(Events!C2:C,"Chargeback",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')', RED);
  big(sheet, r, 6, '=COUNTIFS(Events!C2:C,"StartTrial",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')-COUNTIFS(Events!C2:C,"Purchase",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')-COUNTIFS(Events!C2:C,"CancelledSubscription",' + ED + ',">="&' + DS + ',' + ED + ',"<="&' + DE + ')', GREEN);
  r += 2;

  // =====================
  // META CAPI — EMQ REFERENCE
  // =====================
  sec(sheet, r, '🔗 META CAPI — 8+ EMQ REFERENCE'); r++;
  sheet.getRange(r, 1).setValue('For every event sent to Meta CAPI, we hash and send these user_data params:').setFontFamily('Inter').setFontSize(10).setFontColor('#505050');
  r++;
  var emqParams = [
    ['1', 'em', 'Email (SHA256)', '✅'],
    ['2', 'fn', 'First Name (SHA256)', '✅ if captured'],
    ['3', 'ln', 'Last Name (SHA256)', '✅ if captured'],
    ['4', 'ph', 'Phone (SHA256)', '✅ if captured'],
    ['5', 'fbc', 'Click ID from Meta', '✅'],
    ['6', 'fbp', 'Browser ID from Meta', '✅'],
    ['7', 'external_id', 'SHA256 of email or browser_id', '✅'],
    ['8', 'client_ip_address', 'Raw IP', '✅'],
    ['9', 'client_user_agent', 'Browser UA string', '✅'],
    ['10', 'ct', 'City (SHA256, from IP lookup)', '✅'],
    ['11', 'st', 'State (SHA256, from IP lookup)', '✅'],
    ['12', 'zp', 'Zip (SHA256, from IP lookup)', '✅'],
    ['13', 'country', 'Country (SHA256, from IP lookup)', '✅']
  ];

  var emqHeader = sheet.getRange(r, 1, 1, 4);
  emqHeader.setValues([['#', 'Param', 'Description', 'Status']]);
  emqHeader.setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
  r++;

  for (var e = 0; e < emqParams.length; e++) {
    var er = r + e;
    sheet.getRange(er, 1, 1, 4).setValues([emqParams[e]]);
    sheet.getRange(er, 1, 1, 4).setFontFamily('Inter').setFontSize(10);
    if (e % 2 === 0) sheet.getRange(er, 1, 1, 4).setBackground(LIGHT);
  }
  r += emqParams.length;
  sheet.getRange(r, 1).setValue('With IP Lookup enabled: 13 params. Minimum without name/phone: 9 params. Target: 8+  ✅').setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(GREEN);
  r += 2;

  // =====================
  // META EVENT NAME MAPPING
  // =====================
  sec(sheet, r, '📋 META EVENT NAME MAPPING'); r++;
  var metaMap = [
    ['Our Event', 'Meta event_name', 'Type'],
    ['PageView', 'PageView', 'Standard'],
    ['QuizStarted', 'ViewContent', 'Standard'],
    ['QuizCompleted', 'CompleteRegistration', 'Standard'],
    ['EmailCaptured', 'Lead', 'Standard'],
    ['DownloadClicked', 'AddToCart', 'Standard (proxy for app download intent)'],
    ['CheckoutInitiated', 'InitiateCheckout', 'Standard'],
    ['StartTrial', 'StartTrial', 'Custom'],
    ['Purchase', 'Purchase', 'Standard (include value)'],
    ['HighAOVPurchaser', 'HighAOVPurchaser', 'Custom (register in Custom Conversions)'],
    ['FailedPayment', 'FailedPayment', 'Custom'],
    ['CancelledSubscription', 'CancelledSubscription', 'Custom'],
    ['Chargeback', 'Chargeback', 'Custom']
  ];

  for (var mm = 0; mm < metaMap.length; mm++) {
    var mmr = r + mm;
    sheet.getRange(mmr, 1, 1, 3).setValues([metaMap[mm]]);
    sheet.getRange(mmr, 1, 1, 3).setFontFamily('Inter').setFontSize(10);
    if (mm === 0) {
      sheet.getRange(mmr, 1, 1, 3).setFontWeight('bold').setFontColor(WHITE).setBackground(DARK);
    } else if (mm % 2 === 0) {
      sheet.getRange(mmr, 1, 1, 3).setBackground(LIGHT);
    }
  }
  r += metaMap.length + 1;

  // =====================
  // STATUS PROGRESSION REFERENCE
  // =====================
  sec(sheet, r, '📌 STATUS PROGRESSION (Raw Data column D)'); r++;
  sheet.getRange(r, 1).setValue('quiz_started → quiz_completed → email_captured → download_clicked → checkout_initiated → trial → purchased → high_aov').setFontFamily('Inter').setFontSize(10).setFontColor('#505050');
  sheet.getRange(r, 1, 1, 10).merge();
  r++;
  sheet.getRange(r, 1).setValue('Current money metric: Download Clicked (until Stripe is connected). n8n auto-updates status on each event.').setFontFamily('Inter').setFontSize(10).setFontWeight('bold').setFontColor(GREEN);
  sheet.getRange(r, 1, 1, 10).merge();
  r += 2;

  // =====================
  // CHARTS
  // =====================
  var existingCharts = sheet.getCharts();
  for (var ci2 = 0; ci2 < existingCharts.length; ci2++) {
    sheet.removeChart(existingCharts[ci2]);
  }

  // 1) FUNNEL BAR CHART
  var funnelLabelRange = sheet.getRange(fStart, 1, 9, 1);
  var funnelDataRange = sheet.getRange(fStart, 2, 9, 1);

  var funnelChart = sheet.newChart()
    .setChartType(Charts.ChartType.BAR)
    .addRange(funnelLabelRange)
    .addRange(funnelDataRange)
    .setPosition(fStart, 7, 0, 0)
    .setOption('title', 'Funnel Drop-off')
    .setOption('titleTextStyle', {fontSize: 13, fontName: 'Inter', bold: true, color: '#182830'})
    .setOption('legend', {position: 'none'})
    .setOption('hAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('vAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('colors', ['#51A780'])
    .setOption('backgroundColor', {fill: '#FFFFFF'})
    .setOption('chartArea', {left: '35%', top: '12%', width: '60%', height: '78%'})
    .setOption('bar', {groupWidth: '70%'})
    .setOption('width', 420)
    .setOption('height', 320)
    .build();

  sheet.insertChart(funnelChart);

  // 2) DAILY TRENDS LINE CHART
  var trendDateRange = sheet.getRange(dtStart, 1, 14, 1);
  var trendVisitors = sheet.getRange(dtStart, 2, 14, 1);
  var trendEmails = sheet.getRange(dtStart, 3, 14, 1);
  var trendDownloads = sheet.getRange(dtStart, 4, 14, 1);

  var trendChart = sheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(trendDateRange)
    .addRange(trendVisitors)
    .addRange(trendEmails)
    .addRange(trendDownloads)
    .setPosition(dtStart, 8, 0, 0)
    .setOption('title', 'Daily Trends (14 days)')
    .setOption('titleTextStyle', {fontSize: 13, fontName: 'Inter', bold: true, color: '#182830'})
    .setOption('legend', {position: 'bottom', textStyle: {fontSize: 10, fontName: 'Inter'}})
    .setOption('hAxis', {textStyle: {fontSize: 9, fontName: 'Inter'}, slantedText: true})
    .setOption('vAxis', {textStyle: {fontSize: 10, fontName: 'Inter'}, minValue: 0})
    .setOption('colors', ['#182830', '#51A780', '#D4AF37'])
    .setOption('backgroundColor', {fill: '#FFFFFF'})
    .setOption('chartArea', {left: '10%', top: '15%', width: '80%', height: '65%'})
    .setOption('curveType', 'function')
    .setOption('pointSize', 4)
    .setOption('width', 450)
    .setOption('height', 280)
    .build();

  sheet.insertChart(trendChart);
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
