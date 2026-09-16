/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getServerSupabaseAdminClient } from './auth';

const STORAGE_BUCKET = 'campaign-assets';

export interface StorageUploadResult {
  success: boolean;
  storagePath: string;
  publicUrl: string;
  error?: string;
}

let bucketEnsured = false;

/**
 * Ensures the 'campaign-assets' storage bucket exists in Supabase.
 */
export async function ensureStorageBucket(): Promise<boolean> {
  if (bucketEnsured) return true;
  const client = getServerSupabaseAdminClient();
  if (!client) return false;

  try {
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) {
      console.warn('[Storage] Could not list storage buckets:', error.message);
      return false;
    }

    const exists = buckets?.some((b) => b.name === STORAGE_BUCKET);
    if (!exists) {
      const { error: createErr } = await client.storage.createBucket(STORAGE_BUCKET, {
        public: true, // Asset previews inside workspace
        fileSizeLimit: 20971520, // 20 MB
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
      });
      if (createErr) {
        console.warn('[Storage] Could not auto-create storage bucket:', createErr.message);
        return false;
      }
      console.log(`[Storage] Successfully provisioned Supabase storage bucket: "${STORAGE_BUCKET}"`);
    }

    bucketEnsured = true;
    return true;
  } catch (err) {
    console.warn('[Storage] Bucket inspection exception:', err);
    return false;
  }
}

/**
 * Uploads generated image binary buffer to Supabase Storage.
 * Secure storage path format: campaigns/{campaignId}/{assetId}.{ext}
 */
export async function uploadGeneratedAssetToStorage(
  campaignId: string,
  assetId: string,
  buffer: Buffer,
  mimeType: string
): Promise<StorageUploadResult> {
  const client = getServerSupabaseAdminClient();
  const ext = mimeType.includes('svg') ? 'svg' : mimeType.includes('webp') ? 'webp' : 'png';
  const storagePath = `campaigns/${campaignId}/${assetId}.${ext}`;

  if (!client) {
    // In-memory / data URI fallback when Supabase credentials are not yet configured
    const base64 = buffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;
    return {
      success: true,
      storagePath,
      publicUrl: dataUri,
    };
  }

  try {
    await ensureStorageBucket();

    const { error: uploadError } = await client.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.warn('[Storage] Upload failed, reverting to data URI fallback:', uploadError.message);
      const base64 = buffer.toString('base64');
      return {
        success: true,
        storagePath,
        publicUrl: `data:${mimeType};base64,${base64}`,
        error: uploadError.message,
      };
    }

    // Retrieve public or signed URL
    const { data: urlData } = client.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    const publicUrl = urlData?.publicUrl || `data:${mimeType};base64,${buffer.toString('base64')}`;

    return {
      success: true,
      storagePath,
      publicUrl,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Storage upload exception';
    console.warn('[Storage] Storage error:', errorMsg);
    const base64 = buffer.toString('base64');
    return {
      success: true,
      storagePath,
      publicUrl: `data:${mimeType};base64,${base64}`,
      error: errorMsg,
    };
  }
}
