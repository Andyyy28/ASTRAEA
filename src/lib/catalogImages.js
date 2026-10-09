export const CATALOG_IMAGE_BUCKETS = ['bouquets', 'other-products', 'addons', 'images'];
export const MAX_CATALOG_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME_EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const validateCatalogImage = (file) => {
  if (!file || !MIME_EXTENSIONS[file.type] || !Number.isFinite(file.size) || file.size < 1 || file.size > MAX_CATALOG_IMAGE_BYTES) {
    throw new Error('Use a JPEG, PNG, or WebP image up to 10 MiB.');
  }
  return MIME_EXTENSIONS[file.type];
};

export const uploadCatalogImage = async (supabase, bucket, file) => {
  const extension = validateCatalogImage(file);
  const objectPath = `catalog/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(bucket).upload(objectPath, file, {
    cacheControl: '31536000', upsert: false, contentType: file.type
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return { objectPath, publicUrl: data.publicUrl };
};

export const getStoragePath = (url, bucket) => {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length));
};
