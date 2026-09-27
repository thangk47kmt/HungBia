import { openDB, type IDBPDatabase } from "idb";

const MAX_VIDEO = 12 * 1024 * 1024;

let dbPromise: Promise<IDBPDatabase> | null = null;

function database() {
  if (!dbPromise) {
    dbPromise = openDB("hung-bia-media", 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("images")) db.createObjectStore("images");
      },
    });
  }
  return dbPromise;
}

export function portraitKey(staffId: string) {
  return `portrait:${staffId}`;
}

export function rewardKey(staffId: string, level: number) {
  return `reward:${staffId}:${level}`;
}

export async function getImage(key: string): Promise<Blob | undefined> {
  const db = await database();
  const value = await db.get("images", key);
  return value instanceof Blob ? value : undefined;
}

export async function putImage(key: string, blob: Blob) {
  const db = await database();
  await db.put("images", blob, key);
}

export async function deleteImage(key: string) {
  const db = await database();
  await db.delete("images", key);
}

export async function compressImage(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const max = 960;
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close();
    throw new Error("Không nén được ảnh");
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không nén được ảnh"))),
      "image/jpeg",
      0.82,
    );
  });
}

export async function fileToStoredBlob(file: File): Promise<Blob> {
  if (file.type.startsWith("video/")) {
    if (file.size > MAX_VIDEO) throw new Error("Video tối đa 12 MB");
    return file;
  }
  if (file.type.startsWith("image/")) return compressImage(file);
  throw new Error("Chỉ nhận ảnh hoặc video");
}
