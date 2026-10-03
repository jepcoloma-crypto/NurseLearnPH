import multer from "multer";
import path from "path";
import crypto from "crypto";

const STORAGE_BASE = path.resolve(process.cwd(), "../storage");

function subdirectory(dest: string) {
  const allowed = ["documents", "images", "videos", "question-media", "student-portfolios"];
  return allowed.includes(dest) ? dest : "documents";
}

function storageFor(dest: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(STORAGE_BASE, subdirectory(dest)));
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  });
}

const MAX_SIZES: Record<string, number> = {
  documents: 20 * 1024 * 1024,
  images: 10 * 1024 * 1024,
  videos: 100 * 1024 * 1024,
  "question-media": 10 * 1024 * 1024,
  "student-portfolios": 20 * 1024 * 1024,
};

const ALLOWED_MIME: Record<string, string[]> = {
  documents: ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"],
  images: ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"],
  videos: ["video/mp4", "video/webm", "video/ogg"],
  "question-media": ["image/jpeg", "image/png", "image/gif", "video/mp4"],
  "student-portfolios": ["application/pdf", "image/jpeg", "image/png"],
};

export function uploadMedia(dest: string = "documents") {
  return multer({
    storage: storageFor(dest),
    limits: { fileSize: MAX_SIZES[dest] || 20 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      const allowed = ALLOWED_MIME[dest];
      if (allowed && !allowed.includes(file.mimetype)) {
        cb(new Error(`File type ${file.mimetype} not allowed for ${dest}`));
        return;
      }
      cb(null, true);
    },
  });
}
