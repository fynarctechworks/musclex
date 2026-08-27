import { useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Empty, Label, Loading, Row, Txt } from '../src/ui';
import { Notice } from '../src/ui/Notice';
import { ScreenHeader } from '../src/ui/ScreenHeader';
import { shortDate } from '../src/lib/datetime';
import { photosSupported, pickPhoto, uploadToSignedUrl } from '../src/lib/photos';
import { useAddProgressPhoto, useProgressPhotos } from '../src/api/queries';

/**
 * PROGRESS PHOTOS — the same pose, months apart.
 *
 * The bytes go straight from the phone to storage on a signed URL; only the
 * confirmation passes through our API. The photos come back on URLs that
 * expire, and the screen says so — somebody storing pictures of their own body
 * should know what a shared link does and does not keep working.
 */
export default function PhotosScreen() {
  const insets = useSafeAreaInsets();
  const { data, isLoading } = useProgressPhotos();
  const add = useAddProgressPhoto();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; title: string; body?: string } | null>(null);

  if (isLoading) return <Loading label="Loading photos" />;

  const photos = data?.photos ?? [];

  async function addOne() {
    setNotice(null);
    setBusy(true);
    try {
      const picked = await pickPhoto();
      // Backing out of the picker is not an error, so it says nothing.
      if (!picked) return;
      await add.mutateAsync({
        contentType: picked.mimeType,
        upload: (url) => uploadToSignedUrl(url, picked),
      });
      setNotice({ tone: 'success', title: 'Photo added' });
    } catch (e) {
      setNotice({
        tone: 'error',
        title: 'Could not add it',
        body: e instanceof Error ? e.message : 'Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="bg-background flex-1" style={{ paddingTop: insets.top }}>
      <ScreenHeader title="Progress photos" />
      <ScrollView
        contentContainerClassName="gap-3 px-4 pb-32"
      >
        {notice ? <Notice {...notice} onDismiss={() => setNotice(null)} /> : null}

        <Button
          title={photosSupported() ? 'Add a photo' : 'Add a photo on your phone'}
          disabled={!photosSupported()}
          loading={busy || add.isPending}
          onPress={addOne}
        />

        <Card>
          <Label>Who can see these</Label>
          <Txt variant="small" tone="t2" className="mt-2">
            Only you. They are not on your profile, not in any feed, and the links the app uses
            expire after an hour — so one that gets forwarded stops working.
          </Txt>
        </Card>

        {photos.length === 0 ? (
          <Empty
            title="No photos yet"
            body="Same pose, same light, every few weeks. That is what makes them worth comparing."
          />
        ) : (
          <View className="flex-row flex-wrap gap-2">
            {photos.map((p) => (
              <View key={p.id} style={{ width: '48%' }}>
                <View
                  className="border-border bg-secondary items-center justify-center overflow-hidden rounded-md border"
                  style={{ aspectRatio: 0.75 }}>
                  {p.url ? (
                    <Image source={{ uri: p.url }} style={{ width: '100%', height: '100%' }} />
                  ) : (
                    // Signing failed. Say so rather than showing a broken
                    // image icon and letting them think the photo is gone.
                    <Txt variant="caption" tone="t3" className="p-3 text-center">
                      Could not load this one. Pull down to try again.
                    </Txt>
                  )}
                </View>
                <Txt variant="caption" tone="t3" className="mt-1">
                  {shortDate(p.takenAt)}
                </Txt>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
