# File Library Backend

A simple Node.js backend for uploading, listing, and viewing files.

## Endpoints

### Upload a file
POST /upload  
Form-data: file

### List all files
GET /files

### View a file
GET /file/:name

## Deployment (Render.com)

1. Upload this folder to GitHub  
2. Go to https://render.com  
3. Click "New → Web Service"  
4. Choose "Deploy from GitHub"  
5. Set:
   - Build Command: `npm install`
   - Start Command: `npm start`
6. Deploy

Render will give you a public URL like:
https://file-library-backend.onrender.com

Use this URL in your index.html frontend.