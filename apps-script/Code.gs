/**
 * Flourian & Youstina RSVP: Google Apps Script
 *
 * For every reply from the website this script:
 *   1. adds a row to the "RSVPs" tab of the Google Sheet it is attached to (attending AND declined),
 *   2. emails the reply to OWNER_EMAIL,
 *   3. emails the guest a thank-you (only if the guest typed an email, and only the first time that email replies).
 *
 * Setup steps are in README.md.
 */

var OWNER_EMAIL = "youssef.mena2006@gmail.com";
var COUPLE = "Flourian & Youstina";
var DAY = "Thursday, 29 October 2026";
var CHURCH = "St Mary New Nozha Church";
var PADRINO = "Padrino, Cairo Complex Mall, Ankara Street, Sheraton, Cairo 4471408";
var MIN_CHARGE = "A minimum charge of 800 LE applies at Padrino.";
var SHEET_NAME = "RSVPs";
var TIME_ZONE = "Africa/Cairo";

var HEADERS = ["Time", "Name", "Status", "Email", "Message", "Thank-you email", "Ref"];
var COL = { time: 1, name: 2, status: 3, email: 4, note: 5, thanks: 6, ref: 7 };

function doGet() {
  return json_({ ok: true, message: "RSVP script is running." });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    var name = clean_(d.name, 80);
    var email = clean_(d.email, 120).toLowerCase();
    var status = d.status === "attending" ? "attending" : (d.status === "declined" ? "declined" : "");
    var note = clean_(d.note, 600);
    var ref = clean_(d.ref || d.sid, 40);
    if (!name || !status) return json_({ ok: false, error: "missing name or status" });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) email = "";

    var sheet = getSheet_();
    var last = sheet.getLastRow();

    // the same reply sent twice (a retry) is saved once
    if (ref && last > 1) {
      var from = Math.max(2, last - 199);
      var refs = sheet.getRange(from, COL.ref, last - from + 1, 1).getValues();
      for (var i = 0; i < refs.length; i++) if (String(refs[i][0]) === ref) return json_({ ok: true, duplicate: true });
    }

    // first time this email replies? then it gets the thank-you
    var firstForEmail = false;
    if (email) {
      firstForEmail = true;
      if (last > 1) {
        var emails = sheet.getRange(2, COL.email, last - 1, 1).getValues();
        for (var j = 0; j < emails.length; j++) {
          if (String(emails[j][0]).toLowerCase() === email) { firstForEmail = false; break; }
        }
      }
    }

    var when = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd HH:mm");
    sheet.appendRow([when, safeCell_(name), status, safeCell_(email), safeCell_(note), "", ref]);
    var row = sheet.getLastRow();

    var results = [];
    var quota = MailApp.getRemainingDailyQuota();

    // 1) the reply, to the owner
    if (quota >= 1) {
      try { sendOwner_(name, email, status, note, when); results.push("owner ok"); }
      catch (err) { results.push("owner failed"); console.error("owner email: " + err); }
    } else {
      results.push("owner skipped (daily email limit)");
    }

    // 2) thank-you, to the guest
    var thanks;
    if (!email) thanks = "no email given";
    else if (!firstForEmail) thanks = "already sent";
    else if (quota < 2) thanks = "skipped (daily email limit)";
    else {
      try { sendThanks_(name, email, status); thanks = "sent"; }
      catch (err2) { thanks = "failed"; console.error("thank-you email: " + err2); }
    }
    sheet.getRange(row, COL.thanks).setValue(thanks);

    return json_({ ok: true, thanks: thanks, owner: results.join(", ") });
  } catch (err3) {
    console.error(err3);
    return json_({ ok: false, error: String(err3) });
  } finally {
    try { lock.releaseLock(); } catch (x) { /* not locked */ }
  }
}

/* ---------- emails ---------- */

function sendOwner_(name, email, status, note, when) {
  var yes = status === "attending";
  var verdict = yes ? "will attend" : "cannot attend";
  var subject = "RSVP: " + name + " " + verdict;
  var plain = name + " " + verdict + ".\n" +
    "Email: " + (email || "not given") + "\n" +
    "Message: " + (note || "none") + "\n" +
    "Received: " + when + " (Cairo time)";
  var html = wrap_(
    '<p style="margin:0 0 6px;font-size:13px;letter-spacing:2px;text-transform:uppercase;color:#5258a0;">New RSVP</p>' +
    '<h2 style="margin:0 0 14px;font-size:24px;font-weight:600;color:#17151f;">' + esc_(name) + '</h2>' +
    '<p style="margin:0 0 14px;font-size:17px;">' + (yes ? "Will attend" : "Cannot attend") + '</p>' +
    '<table role="presentation" style="font-size:15px;color:#3b3950;border-collapse:collapse;">' +
    '<tr><td style="padding:3px 14px 3px 0;color:#7176bc;">Email</td><td>' + (email ? esc_(email) : "not given") + '</td></tr>' +
    '<tr><td style="padding:3px 14px 3px 0;color:#7176bc;vertical-align:top;">Message</td><td>' + (note ? esc_(note).replace(/\n/g, "<br>") : "none") + '</td></tr>' +
    '<tr><td style="padding:3px 14px 3px 0;color:#7176bc;">Received</td><td>' + esc_(when) + ' (Cairo time)</td></tr></table>'
  );
  var opts = { to: OWNER_EMAIL, subject: subject, body: plain, htmlBody: html, name: COUPLE + " RSVP" };
  if (email) opts.replyTo = email;
  MailApp.sendEmail(opts);
}

function sendThanks_(name, email, status) {
  var yes = status === "attending";
  var first = name.split(" ")[0];
  var subject = yes ? "Thank you, " + first + "! We can't wait to see you" : "Thank you for letting us know, " + first;
  var line1 = yes
    ? "Thank you for confirming. We are so happy that you will be with us."
    : "Thank you for letting us know. You will be missed, and you will be in our thoughts and prayers.";
  var details = yes
    ? '<p style="margin:18px 0 0;font-size:16px;line-height:1.6;color:#3b3950;">' + esc_(DAY) + '<br>' +
      '<b style="color:#5258a0;">7 PM</b> &nbsp;' + esc_(CHURCH) + '<br>' +
      '<b style="color:#5258a0;">8 PM</b> &nbsp;' + esc_(PADRINO) + '<br>' +
      '<i style="color:#6b6980;font-size:14px;">' + esc_(MIN_CHARGE) + '</i></p>'
    : "";
  var plain = "Dear " + name + ",\n\n" + line1 + "\n\n" +
    (yes ? DAY + "\n7 PM  " + CHURCH + "\n8 PM  " + PADRINO + "\n" + MIN_CHARGE + "\n\n" : "") +
    "Your prayers and presence will complete our day.\n\nWith love,\n" + COUPLE;
  var html = wrap_(
    '<h2 style="margin:0 0 14px;font-size:26px;font-weight:600;color:#17151f;">Dear ' + esc_(first) + ',</h2>' +
    '<p style="margin:0;font-size:18px;line-height:1.5;color:#17151f;">' + esc_(line1) + '</p>' + details +
    '<p style="margin:22px 0 0;font-size:18px;font-style:italic;color:#17151f;">Your prayers and presence will complete our day.</p>' +
    '<p style="margin:22px 0 0;font-size:18px;color:#454b88;">With love,<br>' + esc_(COUPLE) + '</p>'
  );
  MailApp.sendEmail({ to: email, subject: subject, body: plain, htmlBody: html, name: COUPLE });
}

function wrap_(inner) {
  return '<div style="background:#f6f7fc;padding:24px 12px;">' +
    '<div style="max-width:520px;margin:0 auto;background:#ffffff;border-top:4px solid #7176bc;padding:28px 26px;' +
    'font-family:Georgia,\'Times New Roman\',serif;">' + inner + '</div></div>';
}

/* ---------- helpers ---------- */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#eceef9");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(COL.time, 130);
    sheet.setColumnWidth(COL.name, 180);
    sheet.setColumnWidth(COL.email, 200);
    sheet.setColumnWidth(COL.note, 320);
    sheet.setColumnWidth(COL.thanks, 140);
  }
  return sheet;
}

function clean_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

// stops a typed value from being read as a formula by Google Sheets
function safeCell_(v) {
  v = String(v);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function esc_(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- run these once from the editor (see README.md) ---------- */

// Step 1: run this first. Google asks you to allow access to Sheets and email. It also prepares the sheet.
function setup() {
  getSheet_();
  Logger.log("Ready. Emails you can still send today: " + MailApp.getRemainingDailyQuota());
}

// Step 2 (optional): adds a TEST row and sends one test email to OWNER_EMAIL. Delete the TEST row afterwards.
function sendTest() {
  var out = doPost({ postData: { contents: JSON.stringify({
    name: "TEST - delete this row", email: "", status: "attending", note: "Test message", sid: "test-" + Date.now()
  }) } });
  Logger.log(out.getContent());
}
