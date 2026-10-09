const SHEET_URL = "";
const API_BASE = "";

const $ = id => document.getElementById(id);
const store = {
  get(){ try { return JSON.parse(localStorage.getItem("timss_student")); } catch(e){ return null; } },
  set(v){ try { localStorage.setItem("timss_student", JSON.stringify(v)); } catch(e){} },
  del(){ try { localStorage.removeItem("timss_student"); } catch(e){} }
};
const shuffle = a => { a = a.slice(); for (let i = a.length-1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]] = [a[j],a[i]]; } return a; };
function show(id){ ["reg","home","menu","quiz","res"].forEach(s => $(s).classList.toggle("hide", s !== id)); window.scrollTo(0,0); }

let student, subj, topicName, list, i, score, pick, checked, cur;

function withCategory(question, category) {
  const item = question.slice();
  item.category = category;
  return item;
}

function randomizeTopicQuestions(topic) {
  return shuffle(topic.q.map(question => withCategory(question, topic.n)));
}

function randomizeSubjectQuestions(subjectKey, limit = 10) {
  const subject = D[subjectKey];
  const pools = subject.topics.map(topic => randomizeTopicQuestions(topic));
  const countByTopic = Array(subject.topics.length).fill(Math.floor(limit / subject.topics.length));
  for (let i = 0; i < limit % subject.topics.length; i++) countByTopic[i]++;

  const selected = [];
  pools.forEach((pool, index) => {
    const take = Math.min(countByTopic[index], pool.length);
    selected.push(...pool.slice(0, take));
  });

  return shuffle(selected);
}

function start(){
  student = store.get();
  if (student && student.name && student.section) { $("hi").textContent = "أهلاً " + student.name + " — الفرقة " + student.section + " 👋"; show("home"); }
  else show("reg");
}
$("save").onclick = () => {
  const name = $("name").value.trim();
  if (name.length < 3) { $("name").focus(); $("name").placeholder = "اكتبي اسمك أولاً"; return; }
  const section = $("sec").value.trim();
  if (!section) { $("sec").focus(); $("sec").placeholder = "اكتبي الفرقة أولاً"; return; }
  store.set({ name, section }); start();
};
$("logout").onclick = () => { store.del(); $("name").value = ""; $("sec").value = ""; start(); };
$("backHome").onclick = $("toHome").onclick = () => show("home");
document.querySelectorAll("[data-s]").forEach(b => b.onclick = () => openMenu(b.dataset.s));

function openMenu(s){
  subj = s; const d = D[s]; $("mtitle").textContent = d.name; $("tiles").innerHTML = "";
  d.topics.forEach((t) => {
    const b = document.createElement("button"); b.className = "tile"; b.style.setProperty("--c", t.c);
    b.innerHTML = "<span>" + t.i + "</span>" + t.n; b.onclick = () => begin(t.n, randomizeTopicQuestions(t)); $("tiles").append(b);
  });
  const b = document.createElement("button"); b.className = "tile wide"; b.style.setProperty("--c", "#f5b942");
  b.innerHTML = "<span>🏆</span>" + d.test;
  b.onclick = () => begin(d.test, randomizeSubjectQuestions(s, 10)); $("tiles").append(b);
  show("menu");
}
$("toMenu").onclick = $("backMenu").onclick = () => openMenu(subj);
$("again").onclick = () => { 
  if (topicName === D[subj].test) begin(D[subj].test, randomizeSubjectQuestions(subj, 10));
  else { const topic = D[subj].topics.find(t => t.n === topicName); begin(topicName, topic ? randomizeTopicQuestions(topic) : list); }
};

function begin(name, qs){ topicName = name; list = qs; i = 0; score = 0; show("quiz"); render(); }

const norm = t => String(t).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[,،\s]/g, "");
let typed = false;
function render(){
  const q = list[i]; pick = null; checked = false; typed = q[1] === null;
  $("count").textContent = topicName + " — السؤال " + (i+1) + " من " + list.length;
  $("fill").style.width = (i / list.length * 100) + "%";
  $("qtext").textContent = q[0]; $("fb").className = "fb hide";
  $("next").disabled = true; $("next").textContent = "تحقق من الإجابة"; $("opts").innerHTML = "";
  if (typed) {
    const inp = document.createElement("input"); inp.type = "text"; inp.id = "ans"; inp.inputMode = "numeric";
    inp.autocomplete = "off"; inp.placeholder = "اكتبي إجابتك هنا (أرقام فقط)";
    inp.oninput = () => { $("next").disabled = !inp.value.trim(); };
    $("opts").append(inp); return;
  }
  cur = shuffle(q[1].map((t, k) => ({ t, ok: k === q[2] })));
  cur.forEach((o, k) => {
    const l = document.createElement("label"); l.className = "opt";
    l.innerHTML = '<input type="radio" name="a">'; l.append(o.t);
    l.querySelector("input").onchange = () => {
      pick = k; $("next").disabled = false;
      document.querySelectorAll(".opt").forEach(x => x.classList.remove("sel")); l.classList.add("sel");
    };
    $("opts").append(l);
  });
}

$("next").onclick = () => {
  if (!checked) {
    checked = true; const q = list[i]; let right, ans;
    if (typed) {
      const inp = $("ans"); right = norm(inp.value) === norm(q[2]); ans = q[2]; inp.disabled = true;
      inp.style.borderColor = right ? "var(--green)" : "#e0524f";
    } else {
      right = cur[pick].ok; ans = cur.find(o => o.ok).t;
      document.querySelectorAll(".opt").forEach((o, k) => {
        o.querySelector("input").disabled = true;
        if (cur[k].ok) o.classList.add("ok"); else if (k === pick) o.classList.add("no");
      });
    }
    if (right) score++;
    $("fb").className = "fb " + (right ? "good" : "bad");
    $("fb").innerHTML = right ? "<b>إجابة صحيحة! أحسنتِ 🌟</b>"
      : "<b>إجابة خاطئة، لا بأس! 💪</b>الإجابة الصحيحة: " + ans + "<br>كيف نصل للحل؟ " + q[3];
    $("next").textContent = i === list.length-1 ? "إنهاء وعرض النتيجة" : "السؤال التالي";
    return;
  }
  if (++i < list.length) render(); else finish();
};

async function finish(){
  const total = list.length, percent = Math.round(score / total * 100);
  show("res");
  $("title").textContent = percent >= 70 ? "أحسنتِ!" : "حاولي مرة أخرى!";
  $("score").textContent = score + " / " + total; $("pct").textContent = percent + "%";
  $("ring").style.background = "conic-gradient(var(--green) " + percent + "%, #dbe9fb 0)";
  $("note").textContent = percent >= 90 ? "مستواك: ممتاز" : percent >= 70 ? "مستواك: جيد جداً" : percent >= 50 ? "مستواك: جيد" : "لا بأس، كل محاولة تقرّبك من الهدف";

  const data = {
    studentName: student.name,
    section: student.section,
    subject: D[subj].name,
    topic: topicName,
    quizArabicName: topicName,
    score,
    total,
    percent
  };

  $("status").textContent = "جارٍ حفظ النتيجة...";

  try {
    if (API_BASE) {
      await fetch(`${API_BASE}/api/save-attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      $("status").textContent = "تم حفظ نتيجتك ✓";
      return;
    }

    if (SHEET_URL) {
      await fetch(SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data)
      });
      $("status").textContent = "تم حفظ نتيجتك ✓";
      return;
    }

    $("status").textContent = "لم يتم ربط الحفظ بعد";
  } catch (e) {
    $("status").textContent = "تعذّر الحفظ، تأكدي من الاتصال بالإنترنت";
  }
}
start();
