import { apiUrl, readApiJson } from "@/lib/api";

/**
 * Resizes an image file client-side (max dimension, JPEG compression) and
 * uploads it to the backend, which stores it in MongoDB and returns a URL
 * served from /recruit-public/uploads/:id. No external storage bucket needed.
 */
export async function uploadImage(file: File, token: string, maxDimension = 512): Promise<string> {
  const dataUrl = await resizeImageToDataUrl(file, maxDimension);
  const contentType = "image/jpeg";

  const res = await fetch(apiUrl("/recruit/uploads/image"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ data: dataUrl, contentType }),
  });

  if (!res.ok) {
    const body = await readApiJson(res).catch(() => null);
    throw new Error(body?.error || "Upload failed.");
  }

  const body = await readApiJson(res);
  const path: string = body.url;
  // Backend returns a relative path; resolve against the API origin so it renders correctly.
  return apiUrl(path);
}

function resizeImageToDataUrl(file: File, maxDimension: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Could not read image."));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas not supported."));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
