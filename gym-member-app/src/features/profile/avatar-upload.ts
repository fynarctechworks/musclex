import * as ImagePicker from 'expo-image-picker';
import { api } from '../../api/endpoints';

/**
 * Pick a profile photo and upload it directly to object storage via a signed
 * URL, then confirm it with the BFF. The confirmed photo is written to
 * `members.profile_photo_url`, so it appears in BOTH the member app and the
 * admin panel. Returns the new avatar URL, or null if the user cancelled.
 */
export async function pickAndUploadAvatar(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
    allowsEditing: true,
    aspect: [1, 1], // square crop for a circular avatar
  });
  if (picked.canceled || !picked.assets?.[0]) return null;

  const asset = picked.assets[0];
  const contentType = asset.mimeType ?? 'image/jpeg';

  const target = await api.avatarUploadUrl(contentType);
  if (!target.uploadUrl || !target.avatarId) {
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

  const confirmed = await api.confirmAvatar(target.avatarId);
  return confirmed.avatarUrl ?? null;
}
