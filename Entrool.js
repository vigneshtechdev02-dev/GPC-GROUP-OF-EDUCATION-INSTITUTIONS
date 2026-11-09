/* GPC Student Enrolment — set the deployed Apps Script /exec URL below. */
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby-ZGOUlra1HDnTkHu0GC_S8LqS-gDb6_YEhzDdaMeyJU9dIRtibaC2HnoRDIN4ltNA1w/exec";

const courseData = {
  "School Education":["8th Standard","10th Standard","11th Standard","12th Standard"],
  "Undergraduate Programmes":["B.A","B.Sc","B.Com","B.Lit","B.B.A","B.C.A","B.L.I.S"],
  "Postgraduate Programmes":["M.A","M.Sc","M.Com","M.B.A","M.C.A","M.L.I.S"],
  "Professional & Technical Courses":["Diploma Engineering","B.Tech","M.Tech","D.T.Ed","B.Ed","M.Ed","C.P.Ed","LLB"],
  "Research Programmes":["M.Phil","Ph.D"],
  "Computer & Skill Courses":["Basic Computer","Tally","DCA","DTP","PGDCA","Typewriting Tamil / English"]
};
const universities = ["Bharathidasan University","Tamil University","Madurai Kamaraj University","Madras University","Tamil Nadu Open University","Mother Teresa Women's University","Periyar University","Manonmaniam Sundaranar University","Asian International University","Sikkim Skill University","Shri Rukmini Dwarkadhish University","Arni University","Other / Need Guidance"];

const form = document.getElementById("enrolForm");
const category = document.getElementById("category");
const course = document.getElementById("course");
const university = document.getElementById("university");
const submitBtn = document.getElementById("submitBtn");
const statusBox = document.getElementById("status");
const successBox = document.getElementById("success");
const responseFrame = document.getElementById("gpcResponseFrame");

let busy = false, activeNonce = "", requestForm = null, timer = null;

function status(message, type="") {
  statusBox.textContent = message;
  statusBox.className = "status " + type;
  statusBox.hidden = !message;
}
function removeRequest() {
  clearTimeout(timer);
  if (requestForm && requestForm.parentNode) requestForm.remove();
  requestForm = null;
}
function populateCourses() {
  course.innerHTML = '<option value="">Select your course</option>';
  (courseData[category.value] || []).forEach(name => {
    const o = document.createElement("option"); o.value = name; o.textContent = name; course.appendChild(o);
  });
  course.disabled = !course.options.length || course.options.length === 1;
}
function populateUniversities() {
  if (!university || university.tagName !== "SELECT") return;
  universities.forEach(name => {
    if (![...university.options].some(o => o.value === name)) {
      const o = document.createElement("option"); o.value = name; o.textContent = name; university.appendChild(o);
    }
  });
}
function validate() {
  if (!form.reportValidity()) return false;
  const phone = form.elements.phone.value.trim();
  const alt = form.elements.alternativePhone.value.trim();
  const pin = form.elements.pinCode.value.trim();
  const year = Number(form.elements.yearOfPassing.value);
  const current = new Date().getFullYear();
  if (!/^[6-9]\d{9}$/.test(phone)) { status("Enter a valid 10-digit Indian mobile number.","error"); form.elements.phone.focus(); return false; }
  if (alt && !/^[6-9]\d{9}$/.test(alt)) { status("Enter a valid alternative mobile number.","error"); form.elements.alternativePhone.focus(); return false; }
  if (!/^\d{6}$/.test(pin)) { status("Enter a valid 6-digit PIN code.","error"); form.elements.pinCode.focus(); return false; }
  if (!Number.isInteger(year) || year < 1970 || year > current+1) { status("Enter a valid year of passing.","error"); return false; }
  if (!courseData[category.value]?.includes(course.value)) { status("Select a valid category and course.","error"); return false; }
  if (!form.elements.consent.checked) { status("Please accept the declaration.","error"); return false; }
  return true;
}
function handleSubmit(e) {
  e.preventDefault();
  if (busy) return;
  status("");
  if (!validate()) return;
  if (!GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") ||
      !GOOGLE_SCRIPT_URL.endsWith("/exec") ||
      GOOGLE_SCRIPT_URL.includes("PASTE_YOUR_DEPLOYED")) {
    status("https://script.google.com/macros/s/AKfycby-ZGOUlra1HDnTkHu0GC_S8LqS-gDb6_YEhzDdaMeyJU9dIRtibaC2HnoRDIN4ltNA1w/exec","error"); return;
  }

  const data = Object.fromEntries(new FormData(form).entries());
  delete data.aadhaar; // Aadhaar is not collected or stored.
  data.consent = form.elements.consent.checked;
  data.phone = String(data.phone || "").replace(/\D/g,"");
  data.alternativePhone = String(data.alternativePhone || "").replace(/\D/g,"");
  data.pinCode = String(data.pinCode || "").replace(/\D/g,"");

  activeNonce = (crypto.randomUUID ? crypto.randomUUID() : Date.now()+"-"+Math.random());
  const post = document.createElement("form");
  post.method = "POST"; post.action = GOOGLE_SCRIPT_URL;
  post.target = "gpcResponseFrame"; post.hidden = true;

  const payload = document.createElement("input");
  payload.type = "hidden"; payload.name = "payload"; payload.value = JSON.stringify(data);
  const nonce = document.createElement("input");
  nonce.type = "hidden"; nonce.name = "nonce"; nonce.value = activeNonce;
  post.append(payload, nonce); document.body.appendChild(post); requestForm = post;

  busy = true; submitBtn.disabled = true; submitBtn.textContent = "SUBMITTING...";
  status("Your application is being submitted. Please wait.","pending");
  timer = setTimeout(() => {
    if (!busy) return;
    removeRequest(); activeNonce = ""; busy = false;
    submitBtn.disabled = false; submitBtn.textContent = "SUBMIT ENROLMENT FORM →";
    status("No confirmation received. Check your Google Sheet before retrying to avoid duplicate applications.","error");
  },60000);
  post.submit();
}
function receiveMessage(event) {
  const msg = event.data;
  if (!msg || msg.type !== "GPC_ENROLMENT_RESULT" || !activeNonce || msg.nonce !== activeNonce || !busy) return;
  removeRequest(); activeNonce = ""; busy = false;
  submitBtn.disabled = false; submitBtn.textContent = "SUBMIT ENROLMENT FORM →";
  const r = msg.result || {};
  if (r.success && r.referenceId) {
    document.getElementById("successStudent").textContent = r.studentName || "";
    document.getElementById("successCourse").textContent = r.course || "";
    document.getElementById("successReference").textContent = r.referenceId;
    status(""); form.hidden = true; successBox.hidden = false;
    successBox.scrollIntoView({behavior:"smooth",block:"center"});
  } else status(r.message || "Unable to save your application. Please try again later.","error");
}

if (form && category && course && submitBtn && statusBox && successBox && responseFrame) {
  category.addEventListener("change",populateCourses);
  populateUniversities();
  form.addEventListener("submit",handleSubmit);
  window.addEventListener("message",receiveMessage);
  if (form.elements.dob) form.elements.dob.max = new Date().toISOString().slice(0,10);
} else {
  console.error("GPC form setup incomplete: check required HTML IDs.");
}
