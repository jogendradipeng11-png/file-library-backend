const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Create files folder if missing
const uploadFolder = path.join(__dirname, "files");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Upload file
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ message: "File uploaded successfully", file: req.file.originalname });
});

// List files
app.get("/files", (req, res) => {
  const files = fs.readdirSync(uploadFolder);
  res.json(files);
});

// Open file
app.get("/file/:name", (req, res) => {
  const filePath = path.join(uploadFolder, req.params.name);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

// Login system (simple JSON file)
app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const usersPath = path.join(__dirname, "users.json");
  if (!fs.existsSync(usersPath)) {
    return res.status(500).json({ success: false, message: "Users file missing" });
  }

  const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid username or password" });
  }
});

// Delete file
app.delete("/file/:name", (req, res) => {
  const filePath = path.join(uploadFolder, req.params.name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false, message: "File not found" });
  }
});

// Replace file
app.post("/replace/:name", upload.single("file"), (req, res) => {
  const oldFile = path.join(uploadFolder, req.params.name);
  if (fs.existsSync(oldFile)) {
    fs.unlinkSync(oldFile);
  }
  res.json({ success: true, message: "File replaced" });
});

// Render uses dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));