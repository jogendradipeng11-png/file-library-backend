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

// Render uses dynamic port
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running on port " + PORT));