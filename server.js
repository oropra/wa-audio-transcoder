import express from "express";
import multer from "multer";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);
const app = express();
const upload = multer({ dest: os.tmpdir() });

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/transcode-audio", upload.single("file"), async (req, res) => {
  const input = req.file;

  if (!input) {
    return res.status(400).json({ error: "file_required" });
  }

  const inputPath = input.path;
  const outputPath = path.join(
    os.tmpdir(),
    `${crypto.randomUUID()}_wa.ogg`
  );

  try {
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", inputPath,
      "-c:a", "libopus",
      outputPath,
    ]);

    const stat = fs.statSync(outputPath);

    res.setHeader("Content-Type", "audio/ogg");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="voice_${Date.now()}_wa.ogg"`
    );
    res.setHeader("Content-Length", String(stat.size));

    const stream = fs.createReadStream(outputPath);
    stream.on("close", () => {
      try { fs.unlinkSync(inputPath); } catch {}
      try { fs.unlinkSync(outputPath); } catch {}
    });
    stream.pipe(res);
  } catch (error) {
    try { fs.unlinkSync(inputPath); } catch {}
    try { fs.unlinkSync(outputPath); } catch {}

    return res.status(500).json({
      error: "transcode_failed",
      details: error?.message || String(error),
    });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Audio transcoder listening on port ${port}`);
});
