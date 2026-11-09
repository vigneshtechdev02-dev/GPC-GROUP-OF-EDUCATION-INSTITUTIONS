const CONFIG = {
  SPREADSHEET_ID: "1nRtP2AS33kMMEczt2wy0ePI0kek5_y8kWVmD8x9SrPI",
  SHEET_NAME: "Enrolment Enquiries"
};

const HEADERS = ["Submitted At","Reference ID","Student Name","Date of Birth","Mother Name","Father Name","Phone Number","Alternative Phone","Address","PIN Code","Education Category","Course","Preferred University","Previous Qualification","Year of Passing","Additional Message","Consent"];

const COURSES = {
  "School Education": ["8th Standard","10th Standard","11th Standard","12th Standard"],
  "Undergraduate Programmes": ["B.A","B.Sc","B.Com","B.Lit","B.B.A","B.C.A","B.L.I.S"],
  "Postgraduate Programmes": ["M.A","M.Sc","M.Com","M.B.A","M.C.A","M.L.I.S"],
  "Professional & Technical Courses": ["Diploma Engineering","B.Tech","M.Tech","D.T.Ed","B.Ed","M.Ed","C.P.Ed","LLB"],
  "Research Programmes": ["M.Phil","Ph.D"],
  "Computer & Skill Courses": ["Basic Computer","Tally","DCA","DTP","PGDCA","Typewriting Tamil / English"]
};

function testConnection() {
  const ss = openSpreadsheet_();
  const sheet = getSheet_();
  Logger.log("CONNECTED: " + ss.getName());
  Logger.log("SHEET READY: " + sheet.getName());
  return "GPC Google Sheet connection successful.";
}

function doGet() {
  return HtmlService.createHtmlOutput("<h2>GPC enrolment endpoint is running.</h2>");
}

function doPost(e) {
  let nonce = "";
  let result;
  try {
    if (!e || !e.parameter || !e.parameter.payload) throw new Error("Submission payload was not received.");
    nonce = String(e.parameter.nonce || "");
    const d = JSON.parse(e.parameter.payload);
    if (String(d.website || "").trim()) throw new Error("Invalid submission.");
    validateSubmission_(d);

    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = getSheet_();
      const ref = "GPC-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + "-" + Math.floor(1000 + Math.random() * 9000);
      sheet.appendRow([
        new Date(), ref, safeCell_(d.studentName), safeCell_(d.dob),
        safeCell_(d.motherName), safeCell_(d.fatherName), safeCell_(d.phone),
        safeCell_(d.alternativePhone), safeCell_(d.address), safeCell_(d.pinCode),
        safeCell_(d.category), safeCell_(d.course), safeCell_(d.university),
        safeCell_(d.previousQualification), safeCell_(d.yearOfPassing),
        safeCell_(d.message), "Yes"
      ]);
      SpreadsheetApp.flush();
      result = {success:true, referenceId:ref, studentName:String(d.studentName), course:String(d.course), message:"Application received successfully."};
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    result = {success:false, message:err && err.message ? err.message : "Unable to save the enquiry."};
  }
  return responsePage_(result, nonce);
}

function openSpreadsheet_() {
  const id = CONFIG.SPREADSHEET_ID;
  if (!id || id === "PASTE_YOUR_REAL_SPREADSHEET_ID_HERE") throw new Error("Add your real Google Spreadsheet ID in CONFIG.SPREADSHEET_ID.");
  return SpreadsheetApp.openById(id);
}

function getSheet_() {
  const ss = openSpreadsheet_();
  let sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) sh = ss.insertSheet(CONFIG.SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,HEADERS.length).setValues([HEADERS]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,HEADERS.length).setBackground("#071D49").setFontColor("#FFFFFF").setFontWeight("bold");
  }
  return sh;
}

function validateSubmission_(d) {
  ["studentName","dob","motherName","fatherName","phone","address","pinCode","category","course","previousQualification","yearOfPassing"].forEach(k => {
    if (!String(d[k] || "").trim()) throw new Error("Please complete required field: " + k);
  });
  if (!/^[6-9]\d{9}$/.test(String(d.phone))) throw new Error("Enter a valid 10-digit Indian mobile number.");
  if (d.alternativePhone && !/^[6-9]\d{9}$/.test(String(d.alternativePhone))) throw new Error("Enter a valid alternative mobile number.");
  if (!/^\d{6}$/.test(String(d.pinCode))) throw new Error("Enter a valid 6-digit PIN code.");
  if (d.consent !== true) throw new Error("Please accept the declaration and consent.");
  if (!COURSES[d.category] || !COURSES[d.category].includes(d.course)) throw new Error("Selected course does not match the education category.");
  const year = Number(d.yearOfPassing), now = new Date().getFullYear();
  if (!Number.isInteger(year) || year < 1970 || year > now + 1) throw new Error("Enter a valid year of passing.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.dob))) throw new Error("Enter a valid date of birth.");
  const dob = new Date(d.dob + "T00:00:00Z");
  if (isNaN(dob.getTime()) || dob.toISOString().slice(0,10) !== d.dob || dob > new Date()) throw new Error("Date of birth is invalid or in the future.");
}

function safeCell_(v) {
  const s = String(v == null ? "" : v).trim().slice(0,2000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function responsePage_(result, nonce) {
  const msg = JSON.stringify({type:"GPC_ENROLMENT_RESULT", nonce:nonce || "", result:result}).replace(/</g,"\\u003c");
  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
    (function(){ var payload = ${msg}; try { window.top.postMessage(payload, "*"); } catch(e) {} })();
  </script>GPC submission processed.</body></html>`;
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


