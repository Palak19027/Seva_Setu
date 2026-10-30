import { supabase } from '@/lib/supabase';

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DOCUMENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

export const MAX_DONATION_IMAGES = 4;

function extensionFor(file: File): string {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]{2,4}$/.test(fromName)) return fromName;
  return file.type.split('/')[1] ?? 'bin';
}

export function validateImageFile(file: File): string | null {
  if (!IMAGE_TYPES.includes(file.type)) return `${file.name} must be a JPG, PNG or WEBP image.`;
  if (file.size > MAX_IMAGE_BYTES) return `${file.name} is larger than 5 MB.`;
  return null;
}

export function validateDocumentFile(file: File): string | null {
  if (!DOCUMENT_TYPES.includes(file.type)) return 'Upload a PDF, JPG or PNG document.';
  if (file.size > MAX_DOCUMENT_BYTES) return 'The document is larger than 10 MB.';
  return null;
}

export function donationImageUrl(path: string): string {
  return supabase.storage.from('donation-images').getPublicUrl(path).data.publicUrl;
}

export async function uploadDonationImages(userId: string, files: File[]): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const path = `${userId}/${crypto.randomUUID()}.${extensionFor(file)}`;
    const { error } = await supabase.storage
      .from('donation-images')
      .upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (error) throw new Error(`Could not upload ${file.name}: ${error.message}`);
    paths.push(path);
  }
  return paths;
}

export async function removeDonationImages(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  await supabase.storage.from('donation-images').remove(paths);
}

export async function uploadVerificationDocument(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${extensionFor(file)}`;
  const { error } = await supabase.storage
    .from('verification-docs')
    .upload(path, file, { contentType: file.type });
  if (error) throw new Error(`Could not upload the document: ${error.message}`);
  return path;
}

export async function openVerificationDocument(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('verification-docs').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw new Error('The document could not be opened.');
  return data.signedUrl;
}
