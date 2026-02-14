const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const PORT = process.env.PORT || 3000;

// ────────────────────────────────────────────────
//  IDrive e2 Configuration (your credentials)
// ────────────────────────────────────────────────
const s3 = new S3Client({
  region: 'ap-southeast-1',
  endpoint: 'https://s3.ap-southeast-1.idrivee2.com',
  credentials: {
    accessKeyId:     'CVpnZVw7RTGW9iHNP6qJ',
    secretAccessKey: 'KhG5VXbqm58toBVXIL4bxgWV2frZ8QcnCgPrydkM'
  }
});

const BUCKET_NAME = 'radhe-kr...les-2026';   // ← CHANGE THIS !!

// JWT secrets (change these in production!)
const ACCESS_SECRET = 'your-very-long-random-access-secret-2026';
const REFRESH_SECRET = 'your-different-very-long-refresh-secret-2026';

// Users storage (simple JSON file)
const USERS_FILE = path.join(__dirname, 'users.json');
let users = [];
if (fs.existsSync(USERS_FILE)) {
  users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

// Multer – memory storage (we upload directly to IDrive e2)
const upload = multer({ storage: multer.memoryStorage() });

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// ────────────────────────────────────────────────
// Auth middleware
// ────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token required' });

  jwt.verify(token, ACCESS_SECRET, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ────────────────────────────────────────────────
// Routes
// ────────────────────────────────────────────────

// Register new user
app.post('/register', async (req, res) => {
  const { username, password, role = 'user' } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  if (users.find(u => u.username === username)) {
    return res.status(409).json({ message: 'Username already exists' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const newUser = {
    id: users.length + 1,
    username,
    password: hashed,
    role
  };

  users.push(newUser);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

  res.status(201).json({ message: 'User registered successfully' });
});

// Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid username or password' });
  }

  const accessToken = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    ACCESS_SECRET,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { id: user.id },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });

  res.json({ accessToken, role: user.role });
});

// Refresh access token
app.post('/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ message: 'No refresh token' });

  jwt.verify(refreshToken, REFRESH_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid refresh token' });

    const user = users.find(u => u.id === decoded.id);
    if (!user) return res.status(403).json({ message: 'User not found' });

    const accessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  });
});

// Logout
app.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

// ────────────────────────────────────────────────
// File routes (protected)
// ────────────────────────────────────────────────

// Upload file
app.post('/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file received' });

  const originalName = req.file.originalname;
  const key = `${Date.now()}-${originalName}`;

  try {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    res.json({
      success: true,
      storedName: key,
      originalName
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// List files
app.get('/files', authenticateToken, async (req, res) => {
  try {
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET_NAME
    }));

    const files = (data.Contents || []).map(obj => ({
      storedName: obj.Key,
      displayName: obj.Key.replace(/^\d+-/, ''),
      size: obj.Size,
      uploaded: obj.LastModified.toISOString()
    }));

    res.json(files);
  } catch (err) {
    console.error('List error:', err);
    res.status(500).json([]);
  }
});

// Get file (presigned URL)
app.get('/file/:storedName', authenticateToken, async (req, res) => {
  const key = req.params.storedName;

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.redirect(url);
  } catch (err) {
    res.status(404).json({ success: false, message: 'File not found' });
  }
});

// Delete file (admin only)
app.delete('/file/:storedName', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }

  const key = req.params.storedName;

  try {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    }));

    res.json({ success: true, message: 'File deleted' });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ success: false, message: 'Delete failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using IDrive e2 bucket: ${BUCKET_NAME}`);
});