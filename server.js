const express = require("express");
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data", "students");

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (!supabase) {
  console.log("Supabase not configured: using local file storage instead.");
} else {
  console.log("Supabase configured: saving attempts to database.");
}

fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

function normalizeName(value) {
  return String(value || "unknown")
    .trim()
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}

function studentFilePath(studentName) {
  const folderName = normalizeName(studentName);
  const folderPath = path.join(DATA_DIR, folderName);
  fs.mkdirSync(folderPath, { recursive: true });
  return {
    folderName,
    folderPath,
    filePath: path.join(folderPath, "results.json")
  };
}

function readStudentResults(studentName) {
  const { filePath } = studentFilePath(studentName);
  if (!fs.existsSync(filePath)) return [];

  try {
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function writeStudentResults(studentName, data) {
  const { filePath } = studentFilePath(studentName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

async function saveAttemptToSupabase(payload) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("attempts")
    .insert([
      {
        student_name: payload.studentName,
        section: payload.section || "",
        subject: payload.subject || "",
        topic: payload.topic || "",
        quiz_name: payload.quizArabicName || payload.topic || "quiz",
        score: Number(payload.score ?? 0),
        total: Number(payload.total ?? 0),
        percent: Number(payload.percent ?? 0),
        created_at: new Date().toISOString()
      }
    ])
    .select();

  if (error) throw error;
  return data;
}

function saveAttemptToFile(payload) {
  const previous = readStudentResults(payload.studentName);
  const entry = {
    studentName: payload.studentName,
    section: payload.section || "",
    subject: payload.subject || "",
    topic: payload.topic || "",
    quizArabicName: payload.quizArabicName || payload.topic || "quiz",
    score: Number(payload.score ?? 0),
    total: Number(payload.total ?? 0),
    percent: Number(payload.percent ?? 0),
    savedAt: payload.savedAt || new Date().toISOString()
  };

  previous.push(entry);
  writeStudentResults(payload.studentName, previous);
  return previous;
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "server is running", database: supabase ? "supabase" : "local-file" });
});

app.post("/api/save-attempt", async (req, res) => {
  const payload = req.body || {};
  const studentName = (payload.studentName || "").trim();
  const quizArabicName = (payload.quizArabicName || "").trim();

  if (!studentName || !quizArabicName) {
    return res.status(400).json({
      error: "studentName and quizArabicName are required"
    });
  }

  const attempt = {
    studentName,
    section: payload.section || "",
    subject: payload.subject || "",
    topic: payload.topic || "",
    quizArabicName,
    score: Number(payload.score ?? 0),
    total: Number(payload.total ?? 0),
    percent: Number(payload.percent ?? 0),
    savedAt: payload.savedAt || new Date().toISOString()
  };

  try {
    const supabaseData = await saveAttemptToSupabase(attempt);
    if (supabaseData) {
      return res.json({
        ok: true,
        source: "supabase",
        studentName,
        quizArabicName,
        savedCount: supabaseData.length,
        data: supabaseData[supabaseData.length - 1]
      });
    }

    const fileResults = saveAttemptToFile(attempt);
    return res.json({
      ok: true,
      source: "local-file",
      studentName,
      quizArabicName,
      savedCount: fileResults.length,
      folder: normalizeName(studentName)
    });
  } catch (error) {
    return res.status(500).json({
      error: "Unable to save attempt",
      detail: error.message
    });
  }
});

app.get("/api/student/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);

  if (supabase) {
    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .eq("student_name", name)
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ studentName: name, source: "supabase", results: data });
  }

  const results = readStudentResults(name);
  return res.json({ studentName: name, source: "local-file", results });
});

app.get("/api/students", async (req, res) => {
  if (supabase) {
    const { data, error } = await supabase
      .from("attempts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.json({ source: "supabase", students: data });
  }

  const students = fs.existsSync(DATA_DIR)
    ? fs.readdirSync(DATA_DIR, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => ({
          name: dirent.name,
          file: path.join(DATA_DIR, dirent.name, "results.json")
        }))
        .filter((item) => fs.existsSync(item.file))
        .map((item) => ({
          folder: item.name,
          results: JSON.parse(fs.readFileSync(item.file, "utf8"))
        }))
    : [];

  return res.json({ source: "local-file", students });
});

async function startServer() {
  if (supabase) {
    try {
      const { error } = await supabase.from("attempts").select("*").limit(1);
      if (error) {
        console.error("❌ Supabase verification error:", error.message);
        process.exit(1);
      }
      console.log("✅ Supabase connection verified successfully");
    } catch (err) {
      console.error("❌ Supabase connection failed:", err.message);
      process.exit(1);
    }
  } else {
    console.warn("⚠️ Warning: Supabase credentials missing. Running in local-file fallback mode.");
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server is live on port ${PORT}`);
  });
}

startServer();