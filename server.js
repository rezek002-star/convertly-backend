import express from "express";
import fileUpload from "express-fileupload";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import AdmZip from "adm-zip";
import googleTTS from "google-tts-api";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(fileUpload());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// 📘 تحويل الصور إلى PNG/JPG
app.post("/convert/image", async (req, res) => {
  if (!req.files?.file) return res.status(400).send("No file uploaded");
  const file = req.files.file;
  const ext = req.body.format || "png";
  const output = `${__dirname}/tmp/${uuidv4()}.${ext}`;
  await sharp(file.data).toFile(output);
  res.download(output, () => fs.unlinkSync(output));
});

// 📙 تحويل DOCX إلى PDF
app.post("/convert/pdf", async (req, res) => {
  if (!req.files?.file) return res.status(400).send("No file uploaded");
  const file = req.files.file;
  const html = (await mammoth.convertToHtml({ buffer: file.data })).value;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage().drawText(html.replace(/<[^>]+>/g, ""), { x: 50, y: 700 });
  const pdfBytes = await pdfDoc.save();
  const output = `${__dirname}/tmp/${uuidv4()}.pdf`;
  fs.writeFileSync(output, pdfBytes);
  res.download(output, () => fs.unlinkSync(output));
});

// 🎧 تحويل نص إلى صوت
app.post("/convert/tts", async (req, res) => {
  const text = req.body.text;
  if (!text) return res.status(400).send("Missing text");
  const url = googleTTS.getAudioUrl(text, { lang: "en", slow: false });
  res.json({ audioUrl: url });
});

// 📂 ضغط الملفات إلى ZIP
app.post("/convert/zip", async (req, res) => {
  if (!req.files) return res.status(400).send("No files uploaded");
  const zip = new AdmZip();
  Object.values(req.files).forEach((f) => zip.addFile(f.name, f.data));
  const output = `${__dirname}/tmp/${uuidv4()}.zip`;
  zip.writeZip(output);
  res.download(output, () => fs.unlinkSync(output));
});

app.get("/", (req, res) => res.send("✅ Convertly Backend is running!"));

// إنشاء مجلد مؤقت إن لم يكن موجودًا
if (!fs.existsSync(path.join(__dirname, "tmp")))
  fs.mkdirSync(path.join(__dirname, "tmp"));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
