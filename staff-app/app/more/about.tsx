import React from 'react';
import { Linking, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ExternalLink, FileText, LifeBuoy, Scale } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { RowCard } from '@/ui/RowCard';
import { useToast } from '@/ui/Toast';
import { tokens } from '@/ui/tokens';

/**
 * ────────────────────────────────────────────────────────────────
 * ABOUT & LEGAL
 * ────────────────────────────────────────────────────────────────
 *
 * The privacy-policy link here is REQUIRED, not courtesy. App Store Review
 * Guideline 5.1.1(i): a privacy policy must be linked "in the App Store
 * Connect metadata field AND within the app in an easily accessible manner".
 * The metadata field was set; this is the other half, and its absence is a
 * routine rejection.
 *
 * Links go to the marketing site rather than being duplicated in the app. A
 * policy pasted into a screen is a policy that silently goes stale the day
 * legal changes the web copy, and it is the web page Apple was given.
 */
const LINKS = [
  {
    icon: Scale,
    label: 'Privacy policy',
    hint: 'What we collect and why',
    url: 'https://musclex.infynarc.com/legal/privacy',
  },
  {
    icon: FileText,
    label: 'Terms of service',
    hint: 'The agreement your gym signed',
    url: 'https://musclex.infynarc.com/legal/terms',
  },
  {
    icon: LifeBuoy,
    label: 'Support',
    hint: 'Answers, and how to reach a person',
    url: 'https://musclex.infynarc.com/support',
  },
];

export default function About() {
  const toast = useToast();
  const version = Constants.expoConfig?.version ?? '1.0.0';
  const build =
    Constants.expoConfig?.ios?.buildNumber ??
    String((Constants.expoConfig as { android?: { versionCode?: number } })?.android?.versionCode ?? '');

  async function open(url: string, label: string) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (!ok) throw new Error('unsupported');
      await Linking.openURL(url);
    } catch {
      // A gym network that blocks the browser must not look like a broken
      // button — say what happened and leave the URL on screen to type.
      toast.show(`Could not open ${label}. Visit ${url}`, 'error');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: tokens.background }}>
      <Stack.Screen options={{ headerShown: true, title: 'About' }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32, gap: 16 }}>
        <View style={{ gap: 8 }}>
          {LINKS.map((l) => (
            <RowCard
              key={l.url}
              title={l.label}
              subtitle={l.hint}
              leading={<l.icon size={20} color={tokens.foreground} />}
              trailing={<ExternalLink size={16} color={tokens.mutedForeground} />}
              chevron={false}
              onPress={() => void open(l.url, l.label)}
              testID={`about-${l.label.split(' ')[0].toLowerCase()}`}
            />
          ))}
        </View>

        <View className="rounded-xl border border-border bg-card" style={{ padding: 16, gap: 4 }}>
          <Text className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Version
          </Text>
          <Text className="text-[15px] text-foreground">
            MuscleX Staff {version}
            {build ? ` (${build})` : ''}
          </Text>
          <Text className="text-[13px] leading-5 text-muted-foreground">
            Quote this when you contact support — it tells us exactly which build you
            are on.
          </Text>
        </View>

        <Text className="px-1 text-[13px] leading-5 text-muted-foreground">
          Your gym holds your staff account. To change your details or close your
          account, ask an owner or manager — they can do it from Settings → Staff.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
