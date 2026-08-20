import { Platform } from 'react-native';

/**
 * ────────────────────────────────────────────────────────────────
 * PROGRESS PHOTOS — picking one, and sending it
 * ────────────────────────────────────────────────────────────────
 *
 * The upload is a three-step dance the server already implements: ask for a
 * signed URL, PUT the bytes straight to storage, then confirm. The bytes never
 * pass through our API, which is what keeps a photo upload from occupying a
 * request thread for as long as the member's connection takes.
 *
 * The bucket is private and the server only ever hands back signed URLs that
 * expire — a progress photo is among the most personal things somebody stores
 * here, and a link that keeps working forever is a link that gets forwarded.
 *
 * expo-image-picker is imported lazily, as every native module here is.
 */

export function photosSupported(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export interface PickedPhoto {
  uri: string;
  mimeType: string;
}

/** Open the library and return one image, or null if the member backed out. */
export async function pickPhoto(): Promise<PickedPhoto | null> {
  if (!photosSupported()) return null;
  const Picker = await import('expo-image-picker');

  const perm = await Picker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await Picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    // Progress photos are looked at side by side on a phone, not printed.
    // Shrinking here saves the member's data as well as our storage.
    quality: 0.7,
  });
  if (res.canceled || !res.assets?.length) return null;

  const a = res.assets[0];
  return { uri: a.uri, mimeType: a.mimeType ?? 'image/jpeg' };
}

/**
 * PUT the file to the signed URL.
 *
 * Kept separate from the picker so the upload can be retried without making
 * somebody choose the photo again.
 */
export async function uploadToSignedUrl(
  uploadUrl: string,
  photo: PickedPhoto,
): Promise<void> {
  const body = await (await fetch(photo.uri)).blob();
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': photo.mimeType },
    body,
  });
  if (!res.ok) {
    throw new Error(`Upload failed (${res.status}).`);
  }
}
