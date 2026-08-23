import { supabaseAdmin } from './supabase';

const BUCKET_NAME = 'generated-results';

/**
 * Automatically archives an external media URL (e.g. from RunningHub temporary CDN)
 * to our permanent Supabase Storage bucket `generated-results`.
 *
 * If the URL is already on our Supabase Storage or is local, returns the URL as-is.
 */
export async function archiveMediaToSupabaseStorage(
  externalUrl: string,
  userId: string = 'shared',
  taskId: string = 'task',
  index: number = 0
): Promise<string> {
  if (!externalUrl || typeof externalUrl !== 'string') return externalUrl;

  // Already hosted on Supabase Storage or relative
  if (externalUrl.includes('.supabase.co/storage/v1/object/public/') || externalUrl.startsWith('/')) {
    return externalUrl;
  }

  try {
    const res = await fetch(externalUrl);
    if (!res.ok) {
      console.warn(`[storage-archiver] Failed to fetch external URL: ${externalUrl} (status: ${res.status})`);
      return externalUrl;
    }

    const contentType = res.headers.get('content-type') || 'image/png';
    const buffer = Buffer.from(await res.arrayBuffer());

    let ext = 'png';
    if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('mp4')) ext = 'mp4';
    else if (contentType.includes('webm')) ext = 'webm';
    else if (contentType.includes('audio') || contentType.includes('mp3')) ext = 'mp3';
    else if (externalUrl.includes('.mp4')) ext = 'mp4';
    else if (externalUrl.includes('.jpg') || externalUrl.includes('.jpeg')) ext = 'jpg';

    const safeTaskId = taskId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = `users/${safeUserId}/${safeTaskId}_${index}_${Date.now()}.${ext}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });

    if (uploadError) {
      console.error('[storage-archiver upload error]', uploadError);
      return externalUrl;
    }

    const { data: publicUrlData } = supabaseAdmin.storage
      .from(BUCKET_NAME)
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl || externalUrl;
  } catch (error) {
    console.error('[storage-archiver exception]', error);
    return externalUrl;
  }
}

/**
 * Processes an array of outputs or a single output object, archiving all external URLs
 * to Supabase Storage and returning the normalized outputs array.
 */
export async function archiveOutputsList(
  outputs: any[],
  userId: string = 'shared',
  taskId: string = 'task'
): Promise<any[]> {
  if (!Array.isArray(outputs) || outputs.length === 0) return outputs || [];

  const processedOutputs = await Promise.all(
    outputs.map(async (item: any, idx: number) => {
      if (typeof item === 'string') {
        const permanentUrl = await archiveMediaToSupabaseStorage(item, userId, taskId, idx);
        return { fileUrl: permanentUrl, url: permanentUrl, fileType: item.endsWith('.mp4') ? 'video' : 'image' };
      }

      if (item && typeof item === 'object') {
        const originalUrl = item.fileUrl || item.url || item.outputUrl || item.download_url || item.src;
        if (originalUrl) {
          const permanentUrl = await archiveMediaToSupabaseStorage(originalUrl, userId, taskId, idx);
          return {
            ...item,
            fileUrl: permanentUrl,
            url: permanentUrl,
            outputUrl: permanentUrl,
            archivedToStorage: true,
          };
        }
      }

      return item;
    })
  );

  return processedOutputs;
}
