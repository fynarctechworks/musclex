import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/endpoints';

/**
 * Pick a progress photo and upload it directly to object storage via a signed
 * URL (TRD §9 — media stays out of the API; photos private by default), then
 * confirm it with the BFF. Returns true if a photo was uploaded.
 */
export async function pickAndUploadPhoto(): Promise<boolean> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return false;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [3, 4],
  });
  if (picked.canceled || !picked.assets?.[0]) return false;

  const asset = picked.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';

  const target = await api.photoUploadUrl(contentType);
  if (!target.uploadUrl || !target.photoId) {
    throw new Error('Upload target unavailable.');
  }

  // Direct PUT to the signed URL (the file body, not multipart).
  const blob = await (await fetch(asset.uri)).blob();
  const put = await fetch(target.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!put.ok) throw new Error('Photo upload failed.');

  await api.confirmPhoto(target.photoId, new Date().toISOString());
  return true;
}
