import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const BUCKET = 'vehicle-photos';

interface UploadResult {
  url: string;
  path: string;
}

export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File, folder?: string): Promise<UploadResult | null> => {
    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `${folder ? folder + '/' : ''}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        setError(uploadError.message);
        return null;
      }

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      return { url: urlData.publicUrl, path: fileName };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const uploadMultiple = async (files: FileList | File[], folder?: string): Promise<string[]> => {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const result = await upload(file, folder);
      if (result) urls.push(result.url);
    }
    return urls;
  };

  return { upload, uploadMultiple, uploading, error };
}
