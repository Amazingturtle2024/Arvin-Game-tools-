import { MAX_FILE_BYTES } from "@/modules/document-analysis";

export const ALLOWED_UPLOAD = /\.(pdf|docx|xlsx|xls|txt|png|jpe?g|webp)$/i;

export function validateUploadList(files: Array<{ name: string; size: number }>): string | null {
  if (files.length === 0) return "Attach one or more PDF, Word, Excel or drawing image files.";
  for (const file of files) {
    if (!ALLOWED_UPLOAD.test(file.name)) {
      return `${file.name} is not a PDF, Word, Excel or image file.`;
    }
    if (file.size > MAX_FILE_BYTES) {
      return `${file.name} is larger than 15 MB.`;
    }
  }
  return null;
}
