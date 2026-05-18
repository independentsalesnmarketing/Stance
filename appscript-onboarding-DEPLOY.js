function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var formType = data.formType || "unknown";
    var timestamp = Utilities.formatDate(new Date(), "America/New_York", "M/d/yyyy h:mm a") + " EST";

    if (formType === "onboarding") {
      appendOnboarding(ss, data, timestamp);
    } else if (formType === "application") {
      appendApplication(ss, data, timestamp);
    } else if (formType === "partnerApplication") {
      appendPartnerApplication(ss, data, timestamp);
    } else if (formType === "contact") {
      appendContact(ss, data, timestamp);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    var range = sheet.getRange(1, 1, 1, headers.length);
    range.setBackground("#1a1a2e");
    range.setFontColor("#ffffff");
    range.setFontWeight("bold");
    range.setFontSize(11);
    sheet.setFrozenRows(1);
    for (var i = 1; i <= headers.length; i++) {
      sheet.setColumnWidth(i, 160);
    }
  }
  return sheet;
}

// ── Email helpers ─────────────────────────────────────────────────

function emailWrap(bodyHtml) {
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;">'
    + '<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">'
    + '<tr><td align="center">'
    + '<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">'
    + '<tr><td style="background:#0f172a;border-radius:16px 16px 0 0;padding:28px 32px;">'
    + '<p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.12em;text-transform:uppercase;">STANCE</p>'
    + '<p style="margin:4px 0 0;font-size:12px;color:#64748b;letter-spacing:0.08em;text-transform:uppercase;">Independent Sales &amp; Marketing</p>'
    + '</td></tr>'
    + '<tr><td style="background:#ffffff;padding:32px;border-radius:0 0 16px 16px;border:1px solid #e2e8f0;border-top:none;">'
    + bodyHtml
    + '</td></tr>'
    + '<tr><td style="padding:20px 0 0;text-align:center;">'
    + '<p style="margin:0;font-size:11px;color:#94a3b8;">stance-marketing.com &nbsp;·&nbsp; Confidential</p>'
    + '</td></tr>'
    + '</table>'
    + '</td></tr></table></body></html>';
}

function sectionHeader(label) {
  return '<p style="margin:24px 0 10px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.15em;border-bottom:1px solid #f1f5f9;padding-bottom:6px;">' + label + '</p>';
}

function row(label, value) {
  if (!value || value === "—") return '';
  return '<tr>'
    + '<td style="padding:5px 0;font-size:13px;color:#64748b;width:38%;vertical-align:top;">' + label + '</td>'
    + '<td style="padding:5px 0;font-size:13px;color:#1e293b;font-weight:500;">' + value + '</td>'
    + '</tr>';
}

// ── Onboarding ────────────────────────────────────────────────────

function appendOnboarding(ss, data, timestamp) {
  var headers = [
    "Timestamp", "Full Name", "DBA / Company", "Entity Type",
    "Email", "Phone", "Address",
    "Program", "TIN Type", "SSN/EIN (Full)",
    "Bank Name", "Routing # (last 4)", "Account # (last 4)", "Account Type",
    "ID Document", "Badge Photo", "Onboarding PDF", "Token"
  ];
  var sheet = getOrCreateSheet(ss, "Onboarding", headers);
  var address = [data.address, data.city, data.state && data.zipCode ? data.state + " " + data.zipCode : data.state || data.zipCode]
    .filter(Boolean).join(", ");
  var routingLast4 = data.routingNumber ? "····" + data.routingNumber.slice(-4) : "";
  var accountLast4 = data.accountNumber ? "····" + data.accountNumber.slice(-4) : "";
  sheet.appendRow([
    timestamp, data.legalName||"", data.dbaName||"", data.entityType||"",
    data.email||"", data.phone||"", address,
    data.program||"", data.tinType||"", data.tin||"",
    data.bankName||"", routingLast4, accountLast4, data.accountType||"",
    data.idDocUrl||"", data.badgePhotoUrl||"", data.onboardingPdfUrl||"",
    data.token||""
  ]);
  sendOnboardingEmail(data, timestamp);
}

function sendOnboardingEmail(data, timestamp) {
  var recipient = "gamblerspassion@gmail.com";
  var subject = "Stance Onboarding Complete — " + (data.legalName || "Unknown") + " (" + (data.program || "Unknown") + ")";
  var address = [data.address, data.city, data.state && data.zipCode ? data.state + " " + data.zipCode : data.state || data.zipCode]
    .filter(Boolean).join(", ");

  var bodyHtml = '<h2 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">Onboarding Complete</h2>'
    + '<p style="margin:0 0 8px;font-size:13px;color:#64748b;">Submitted ' + (timestamp || "") + '</p>'
    + sectionHeader("Contractor Details")
    + '<table cellpadding="0" cellspacing="0" width="100%">'
    + row("Legal Name", data.legalName)
    + row("DBA / Company", data.dbaName)
    + row("Entity Type", data.entityType)
    + row("Email", data.email)
    + row("Phone", data.phone)
    + row("Address", address)
    + '</table>'
    + sectionHeader("Tax & Banking")
    + '<table cellpadding="0" cellspacing="0" width="100%">'
    + row("Program", data.program)
    + row("TIN Type", data.tinType)
    + row("Bank Name", data.bankName)
    + row("Account Type", data.accountType)
    + '</table>';

  if (data.idDocUrl || data.badgePhotoUrl || data.onboardingPdfUrl) {
    bodyHtml += sectionHeader("Documents")
      + '<table cellpadding="0" cellspacing="0" width="100%">';
    if (data.idDocUrl) bodyHtml += row("Government ID", '<a href="' + data.idDocUrl + '" style="color:#2563eb;">View</a>');
    if (data.badgePhotoUrl) bodyHtml += row("Badge Photo", '<a href="' + data.badgePhotoUrl + '" style="color:#2563eb;">View</a>');
    if (data.onboardingPdfUrl) bodyHtml += row("Onboarding PDF", '<a href="' + data.onboardingPdfUrl + '" style="color:#2563eb;">Download</a>');
    bodyHtml += '</table>';
  }

  MailApp.sendEmail(recipient, subject, "", { htmlBody: emailWrap(bodyHtml) });
}

// ── Other form types (unchanged) ──────────────────────────────────

function appendApplication(ss, data, timestamp) {
  var headers = ["Timestamp", "Name", "Email", "Phone", "State", "Company", "Program", "Details"];
  var sheet = getOrCreateSheet(ss, "Applications", headers);
  sheet.appendRow([
    timestamp, data.name||"", data.email||"", data.phone||"",
    data.state||"", data.company||"", data.program||"", data.details||""
  ]);
}

function appendPartnerApplication(ss, data, timestamp) {
  var headers = ["Timestamp", "Name", "Email", "Phone", "Company", "Partnership Type", "State", "Experience", "Notes"];
  var sheet = getOrCreateSheet(ss, "Partner Applications", headers);
  sheet.appendRow([
    timestamp, data.name||"", data.email||"", data.phone||"",
    data.company||"", data.partnerType||"", data.state||"",
    data.experience||"", data.notes||""
  ]);
}

function appendContact(ss, data, timestamp) {
  var headers = ["Timestamp", "Name", "Email", "Phone", "Subject", "Message"];
  var sheet = getOrCreateSheet(ss, "Contact", headers);
  sheet.appendRow([
    timestamp, data.name||"", data.email||"", data.phone||"",
    data.subject||"", data.message||""
  ]);
}
