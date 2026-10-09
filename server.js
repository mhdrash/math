const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data", "students");

fs.mkdirSync(DATA_DIR, { recursive: true });
app.use(express.json({ limit: "1mb" }));

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

app.use(express.static(__dirname));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true, message: "server is running" });
});

app.post("/api/save-attempt", (req, res) => {
  const payload = req.body || {};
  const studentName = (payload.studentName || "").trim();
  const quizArabicName = (payload.quizArabicName || "").trim();

  if (!studentName || !quizArabicName) {
    return res.status(400).json({
      error: "studentName and quizArabicName are required"
    });
  }

  const previous = readStudentResults(studentName);
  const savedAt = payload.savedAt || new Date().toISOString();

  const entry = {
    studentName,
    section: payload.section || "",
    subject: payload.subject || "",
    topic: payload.topic || "",
    quizArabicName,
    score: Number(payload.score ?? 0),
    total: Number(payload.total ?? 0),
    percent: Number(payload.percent ?? 0),
    savedAt
  };

  previous.push(entry);
  writeStudentResults(studentName, previous);

  return res.json({
    ok: true,
    studentName,
    quizArabicName,
    savedCount: previous.length,
    folder: normalizeName(studentName)
  });
});

app.get("/api/student/:name", (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const results = readStudentResults(name);
  res.json({ studentName: name, results });
});

app.get("/api/students", (req, res) => {
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

  res.json({ students });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
