import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fileUpload from "express-fileupload";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import gtts from "google-tts-api";
import fs from "fs";
import path from "path";

const app = express();
const PORT = process.env.PORT || 10000;

// إعدادات الأمان والحد من الطلبات
const limiter = rateLimit({
  windowMs: 60 * 1000, // دقيقة واحدة
  max: 100, // أقصى عدد طلبات في الدقيقة
});
app.use(limiter);

// إعدادات عامة
app.use(cors());
app.use(bodyParser.json());
app.use(fileUpload());
app.use(express.static("public"));

// ✅ نقطة اختبار (لتتأكد أن السيرفر يعمل)
app.get("/", (req, res) => {
  res.send("✅ Convertly Backend is running!");
});


// ===============================
// 🔊 تحويل النص إلى صوت (TTS)
// ===============================
app.post("/api/text-to-speech", async (req, res) => {
  try {
    const { text, lang } = req.body;
    if (!text) return res.status(400).json({ error: "Text is required" });

    const url = gtts.getAudioUrl(text, {
      lang: lang || "en",
      slow: false,
      host: "https://translate.google.com",
    });

    res.json({ audioUrl: url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "TTS conversion failed" });
  }
});


// ===============================
// 🖼️ تحويل الصور إلى PDF مثال بسيط
// ===============================
app.post("/api/image-to-pdf", async (req, res) => {
  try {
    if (!req.files || !req.files.image)
      return res.status(400).json({ error: "No image uploaded" });

    const file = req.files.image;
    const fileName = `${uuidv4()}.png`;
    const filePath = path.join("/tmp", fileName);
    await file.mv(filePath);

    // ⚠️ هنا فقط مثال - يمكنك لاحقًا دمج مكتبة لتحويل PNG إلى PDF فعلي
    res.json({ message: "Image uploaded successfully", path: filePath });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Image conversion failed" });
  }
});

// ===============================
// 🚀 تشغيل السيرفر
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
