const express = require("express");
const multer = require("multer");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Folder for all files (shared folder)
const uploadFolder = path.join(__dirname, "files");
if (!fs.existsSync(uploadFolder)) fs.mkdirSync(uploadFolder);

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadFolder),
  filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

// Load users
const usersPath = path.join(__dirname, "users.json");
function loadUsers() {
  if (!fs.existsSync(usersPath)) return [];
  return JSON.parse(fs.readFileSync(usersPath, "utf8"));
}
function saveUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// Home route
app.get("/", (req, res) => {
  res.send("Radhe Krishna File Library Backend Running ✨");
});

// Login
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const users = loadUsers();

  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "Invalid username or password" });
  }
});

// Change password (only for logged-in user)
app.post("/change-password", (req, res) => {
  const { username, oldPassword, newPassword } = req.body;

  const users = loadUsers();
  const user = users.find((u) => u.username === username);

  if (!user) {
    return res.json({ success: false, message: "User not found" });
  }

  if (user.password !== oldPassword) {
    return res.json({ success: false, message: "Old password incorrect" });
  }

  user.password = newPassword;
  saveUsers(users);

  res.json({ success: true, message: "Password updated" });
});

// Upload file
app.post("/upload", upload.single("file"), (req, res) => {
  res.json({ success: true, file: req.file.originalname });
});

// List files
app.get("/files", (req, res) => {
  const files = fs.readdirSync(uploadFolder);
  res.json(files);
});

// File HEAD (for size)
app.head("/file/:name", (req, res) => {
  const filePath = path.join(uploadFolder, req.params.name);
  if (!fs.existsSync(filePath)) return res.sendStatus(404);

  const stats = fs.statSync(filePath);
  res.set("Content-Length", stats.size);
  res.sendStatus(200);
});

// Open file
app.get("/file/:name", (req, res) => {
  const filePath = path.join(uploadFolder, req.params.name);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }
  res.sendFile(filePath);
});

// Delete file
app.delete("/file/:name", (req, res) => {
  const filePath = path.join(uploadFolder, req.params.name);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "File not found" });
  }
});

// Replace / Rename file
app.post("/replace/:name", upload.single("file"), (req, res) => {
  const oldFile = path.join(uploadFolder, req.params.name);

  if (fs.existsSync(oldFile)) {
    fs.unlinkSync(oldFile);
  }

  res.json({ success: true, message: "File renamed" });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));