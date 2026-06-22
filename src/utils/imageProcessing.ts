import type { ProcessedPhoto, StoredPhoto } from "../types/models";

export const acceptedImageTypes = ["image/jpeg", "image/png", "image/webp"] as const;
export const maxOriginalImageBytes = 8 * 1024 * 1024;
export const maxStoredImageBytes = 1.6 * 1024 * 1024;
export const maxImageEdge = 1800;
export const thumbnailEdge = 360;

type AcceptedImageMime = StoredPhoto["mimeType"];

function isAcceptedImageType(type: string): type is AcceptedImageMime {
  return acceptedImageTypes.includes(type as AcceptedImageMime);
}

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.ceil(bytes / 1024)} KB`;
}

function targetSize(width: number, height: number, maxEdge: number) {
  const ratio = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("图片文件无法读取，可能已经损坏"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: AcceptedImageMime, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("浏览器无法生成压缩图片"));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

async function renderBlob(
  image: HTMLImageElement,
  maxEdge: number,
  mimeType: AcceptedImageMime,
  quality: number,
) {
  const size = targetSize(image.naturalWidth, image.naturalHeight, maxEdge);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("浏览器不支持图片压缩所需的 Canvas");
  }
  context.drawImage(image, 0, 0, size.width, size.height);
  const blob = await canvasToBlob(canvas, mimeType, quality);
  return { blob, ...size };
}

export async function processImageFile(file: File): Promise<ProcessedPhoto> {
  if (!isAcceptedImageType(file.type)) {
    throw new Error("仅支持 JPG、PNG 和 WebP 图片");
  }

  if (file.size > maxOriginalImageBytes) {
    throw new Error(`单张原图不能超过 ${formatBytes(maxOriginalImageBytes)}`);
  }

  const image = await loadImage(file);
  const outputMimeType: AcceptedImageMime = file.type === "image/png" ? "image/png" : "image/webp";
  const compressed = await renderBlob(image, maxImageEdge, outputMimeType, 0.82);
  const finalCompressed = compressed.blob.size > maxStoredImageBytes
    ? await renderBlob(image, 1400, outputMimeType, 0.72)
    : compressed;

  if (finalCompressed.blob.size > maxStoredImageBytes) {
    throw new Error(`压缩后仍超过 ${formatBytes(maxStoredImageBytes)}，请换一张更小的图片`);
  }

  const thumbnail = await renderBlob(image, thumbnailEdge, "image/webp", 0.72);

  return {
    blob: finalCompressed.blob,
    thumbnailBlob: thumbnail.blob,
    mimeType: outputMimeType,
    width: finalCompressed.width,
    height: finalCompressed.height,
    size: finalCompressed.blob.size,
  };
}

export async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("图片编码失败"));
    reader.readAsDataURL(blob);
  });
}

export function base64ToBlob(base64: string, mimeType: AcceptedImageMime): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function isImportableImageMime(value: unknown): value is AcceptedImageMime {
  return typeof value === "string" && isAcceptedImageType(value);
}
