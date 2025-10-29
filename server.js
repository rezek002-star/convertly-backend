import express from "express";
import cors from "cors";
import fileUpload from "express-fileupload";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { v4 as uuidv4 } from "uuid";
import gTTS from "gtts";

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(fileUpload({ limits: { fileSize: 300 * 1024 * 1024 } })); // 300MB

const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: "Too many requests, slow down." }
});
app.use("/api/", apiLimiter);

const PUBLIC = path.join(process.cwd(), "public");
if (!fs.existsSync(PUBLIC)) fs.mkdirSync(PUBLIC);
app.use("/public", express.static(PUBLIC));

const BACKEND_TOKEN = process.env.BACKEND_TOKEN || "";

// health
app.get("/", (req, res) => res.send("Convertly backend running"));

// token middleware
function requireToken(req, res, next) {
  if (!BACKEND_TOKEN) return next();
  const t = req.headers["x-backend-token"] || req.query.token;
  if (t && t === BACKEND_TOKEN) return next();
  return res.status(401).json({ error: "Unauthorized - missing token" });
}

// TTS - returns /public/tts-xxx.mp3
app.post("/api/text-to-speech", requireToken, (req, res) => {
  try {
    const { text, lang } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });
    const id = uuidv4();
    const fname = `tts-${id}.mp3`;
    const fpath = path.join(PUBLIC, fname);
    const tts = new gTTS(text, lang || "en");
    tts.save(fpath, (err) => {
      if (err) {
        console.error("gTTS error:", err);
        return res.status(500).json({ error: "TTS generation failed" });
      }
      return res.json({ url: `/public/${fname}` });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Video upload -> MP3 using ffmpeg (server must have ffmpeg)
app.post("/api/video-to-audio", requireToken, async (req, res) => {
  try {
    if (!req.files || !req.files.video) return res.status(400).json({ error: "No file uploaded" });
    const vid = req.files.video;
    const id = uuidv4();
    const inPath = path.join(PUBLIC, `${id}-${vid.name}`);
    const outPath = path.join(PUBLIC, `${id}.mp3`);
    await vid.mv(inPath);
    const cmd = `ffmpeg -y -i "${inPath}" -vn -ar 44100 -ac 2 -b:a 192k "${outPath}"`;
    exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, (err, stdout, stderr) => {
      try { fs.unlinkSync(inPath); } catch (_) {}
      if (err) {
        console.error("ffmpeg error:", err, stderr);
        return res.status(500).json({ error: "Conversion failed" });
      }
      return res.json({ url: `/public/${path.basename(outPath)}` });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

// Downloader (yt-dlp must be installed on server)
app.post("/api/download", requireToken, (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No url provided" });
    const id = uuidv4();
    const outTemplate = path.join(PUBLIC, `${id}-%(title).%(ext)s`);
    const cmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio/best" -o "${outTemplate}" "${url}"`;
    exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, (err, stdout, stderr) => {
      if (err) {
        console.error("yt-dlp error:", err, stderr);
        return res.status(500).json({ error: "Download failed" });
      }
      const files = fs.readdirSync(PUBLIC).filter(f => f.startsWith(id + "-"));
      if (files.length === 0) return res.status(500).json({ error: "No file produced" });
      return res.json({ download: `/public/${files[0]}` });
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Convertly backend running on ${PORT}`));
