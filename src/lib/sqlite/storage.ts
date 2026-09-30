import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";

/** Writes the file to public/uploads/products/{userId}/{productId}/{uuid}.{ext} and returns the path relative to public/. */
export async function saveProductImage(
  userId: string,
  productId: string,
  buffer: Buffer,
  originalName: string,
): Promise<string> {
  const ext = extname(originalName).replace(".", "") || "jpg";
  const relativePath = `uploads/products/${userId}/${productId}/${randomUUID()}.${ext}`;
  const absolutePath = resolve(process.cwd(), "public", relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);
  return relativePath;
}

export async function deleteProductImageFile(relativePath: string): Promise<void> {
  const absolutePath = resolve(process.cwd(), "public", relativePath);
  await unlink(absolutePath).catch(() => {});
}

export function imageUrl(relativePath: string): string {
  return `/${relativePath}`;
}
