import { PDFDocument } from 'pdf-lib';

export type Rect = { x: number; y: number; width: number; height: number };

export async function paintLetterhead(source: Buffer, image: Buffer, mediaType: string, rect: Rect): Promise<Buffer> {
  const pdf = await PDFDocument.load(source);
  const embedded = mediaType === 'image/png' ? await pdf.embedPng(image) : await pdf.embedJpg(image);
  for (const page of pdf.getPages()) {
    page.drawImage(embedded, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  }
  return Buffer.from(await pdf.save());
}
