import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Empty, Label, Loading, Meter, Row, Txt } from './index';
import { Icon, type IconName } from './Icon';
import { InfoDot, InfoNote, InfoBullet } from './InfoTip';
import { Notice, Confirm } from './Notice';
import { color, radius, space, type } from './theme';

/**
 * ────────────────────────────────────────────────────────────────
 * DESIGN SYSTEM — member app
 * ────────────────────────────────────────────────────────────────
 *
 * The staff app has an equivalent gallery, and this is NOT a copy of it: the
 * two apps have different component layers. Staff is React Native Reusables +
 * uniwind `className`; this app is plain StyleSheet on the tokens in
 * `theme.ts`. Porting the staff gallery verbatim would not compile, and
 * pretending it did would give a reference that lies about what exists here.
 *
 * So this shows what member-app ACTUALLY has, in the same section order as the
 * staff gallery, which is what makes the two comparable when deciding what to
 * unify. Screenshots of the staff side live in `docs/design-system/`.
 *
 * Dev-only surface: it is reached from a `__DEV__`-guarded row on the You tab
 * and ships in no release build.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: space.md, paddingVertical: space.xl }}>
      <Txt variant="label" tone="t3">{title}</Txt>
      {children}
    </View>
  );
}

function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', gap: space.xs, width: 84 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: radius.md,
          backgroundColor: value,
          borderWidth: 1,
          borderColor: color.line,
        }}
      />
      <Txt variant="caption" tone="t3" numberOfLines={1}>{name}</Txt>
      <Txt variant="caption" tone="t4" numberOfLines={1}>{value}</Txt>
    </View>
  );
}

const ICONS: IconName[] = [
  'today', 'progress', 'gym', 'community', 'me', 'scan', 'streak', 'target',
  'water', 'nutrition', 'plan', 'coach', 'challenge', 'kudos', 'check', 'alert',
];

export function Gallery() {
  const [confirming, setConfirming] = useState(false);
  const [chipOn, setChipOn] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{ padding: space.lg, paddingBottom: space['3xl'] }}
    >
      {/*
        Palette first, because it is the thing most often needed and the
        thing a screenshot of a component cannot give you.
      */}
      <Section title="Palette — surfaces">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <Swatch name="bg" value={color.bg} />
          <Swatch name="surface" value={color.surface} />
          <Swatch name="surface2" value={color.surface2} />
          <Swatch name="line" value={color.line} />
          <Swatch name="lineStrong" value={color.lineStrong} />
        </View>
      </Section>

      <Section title="Palette — ink ladder">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <Swatch name="t1 17.4:1" value={color.t1} />
          <Swatch name="t2 7.8:1" value={color.t2} />
          <Swatch name="t3 4.6:1" value={color.t3} />
          <Swatch name="t4 3.1:1" value={color.t4} />
        </View>
        <InfoNote>
          <Txt variant="small" tone="t2">
            t4 is decorative and disabled ONLY — it clears the 3:1 non-text
            threshold and must never carry information. If a label matters
            enough to read, it is t3.
          </Txt>
        </InfoNote>
      </Section>

      <Section title="Palette — accent & semantic">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
          <Swatch name="accent" value={color.accent} />
          <Swatch name="accentText" value={color.accentText} />
          <Swatch name="good" value={color.good} />
          <Swatch name="warn" value={color.warn} />
          <Swatch name="protein" value={color.protein} />
          <Swatch name="carbs" value={color.carbs} />
          <Swatch name="fat" value={color.fat} />
          <Swatch name="water" value={color.water} />
        </View>
        <InfoNote>
          <Txt variant="small" tone="t2">
            One saturated accent carries actions and nothing else. The semantic
            hues are darkened until they pass 4.5:1 as TEXT on the page
            background — not merely as fills.
          </Txt>
        </InfoNote>
      </Section>

      <Section title="Typography">
        <Txt variant="display">Display</Txt>
        <Txt variant="title">Title</Txt>
        <Txt variant="heading">Heading</Txt>
        <Txt variant="body">Body — 42 workouts logged this month.</Txt>
        <Txt variant="bodyStrong">Body strong</Txt>
        <Txt variant="small" tone="t2">Small, on the secondary ink step.</Txt>
        <Txt variant="caption" tone="t3">Caption — metadata and timestamps.</Txt>
        <Label>Section label</Label>
      </Section>

      <Section title="Buttons">
        <Button title="Start workout" onPress={() => {}} />
        <Button title="Secondary" variant="secondary" onPress={() => {}} />
        <Button title="Quiet" variant="quiet" onPress={() => {}} />
        <Button title="Small" size="sm" onPress={() => {}} />
        <Button title="Loading" loading onPress={() => {}} />
        <Button title="Disabled" disabled onPress={() => {}} />
      </Section>

      <Section title="Cards">
        <Card style={{ padding: space.lg }}>
          <Txt variant="bodyStrong">Default</Txt>
          <Txt variant="small" tone="t2">A white surface on the grey canvas.</Txt>
        </Card>
        <Card tone="accent" style={{ padding: space.lg }}>
          <Txt variant="bodyStrong" tone="accent">Accent</Txt>
          <Txt variant="small" tone="t2">Used sparingly — it is the loudest thing on a screen.</Txt>
        </Card>
        <Card tone="good" style={{ padding: space.lg }}>
          <Txt variant="bodyStrong" tone="good">Good</Txt>
          <Txt variant="small" tone="t2">Streak kept, goal met, session done.</Txt>
        </Card>
      </Section>

      <Section title="Chips">
        <Row style={{ gap: space.sm, flexWrap: 'wrap' }}>
          <Chip label="Push" on={chipOn} />
          <Chip label="Pull" />
          <Chip label="Legs" />
        </Row>
        <Button title="Toggle first chip" variant="quiet" size="sm" onPress={() => setChipOn((v) => !v)} />
      </Section>

      <Section title="Meter">
        <Meter value={7} max={10} tint={color.good} />
        <Txt variant="caption" tone="t3">7 of 10 sessions</Txt>
        <Meter value={2100} max={2600} tint={color.protein} />
        <Txt variant="caption" tone="t3">2,100 of 2,600 kcal</Txt>
      </Section>

      <Section title="Notices">
        <Notice tone="error" title="Payment failed" body="Your membership renewal did not go through." />
        <Notice tone="info" title="New plan assigned" body="Your coach updated this week's programme." />
        <Notice tone="success" title="Streak kept" body="14 days in a row." />
      </Section>

      <Section title="Confirm">
        <Button title="Delete this log" variant="secondary" onPress={() => setConfirming(true)} />
        {/* Confirm takes no `open` prop — the caller mounts it or does not. */}
        {confirming ? (
          <Confirm
            title="Delete this log?"
            body="This cannot be undone."
            confirmLabel="Delete"
            onConfirm={() => setConfirming(false)}
            onCancel={() => setConfirming(false)}
          />
        ) : null}
      </Section>

      <Section title="Info tips">
        <Row style={{ gap: space.sm }}>
          <Txt variant="body">One-rep max</Txt>
          {/* Controlled: the dot toggles, the caller decides what to reveal. */}
          <InfoDot
            open={tipOpen}
            onPress={() => setTipOpen((v) => !v)}
            label="What is a one-rep max?"
          />
        </Row>
        {tipOpen ? (
          <InfoNote>
            <Txt variant="small" tone="t2">
              The heaviest weight you could lift once, estimated from your
              working sets.
            </Txt>
          </InfoNote>
        ) : null}
        <InfoBullet>A bulleted point inside an explanation.</InfoBullet>
      </Section>

      <Section title="Empty & loading">
        <Empty title="No workouts yet" body="Log your first session to see it here." />
        <Loading label="Loading your plan" />
      </Section>

      <Section title="Icons">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          {ICONS.map((n) => (
            <View key={n} style={{ alignItems: 'center', gap: space.xs, width: 64 }}>
              <Icon name={n} size={22} tone="t2" decorative />
              <Txt variant="caption" tone="t4" numberOfLines={1}>{n}</Txt>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Spacing & radius">
        <View style={{ gap: space.sm }}>
          {(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'] as const).map((k) => (
            <Row key={k} style={{ gap: space.md }}>
              <Txt variant="caption" tone="t3" style={{ width: 40 }}>{k}</Txt>
              <View style={{ height: 8, width: space[k], backgroundColor: color.t4, borderRadius: 2 }} />
              <Txt variant="caption" tone="t4">{space[k]}pt</Txt>
            </Row>
          ))}
        </View>
        <Row style={{ gap: space.md, flexWrap: 'wrap' }}>
          {(['sm', 'md', 'lg', 'xl', 'pill'] as const).map((k) => (
            <View key={k} style={{ alignItems: 'center', gap: space.xs }}>
              <View
                style={{
                  width: 56, height: 40,
                  borderRadius: radius[k],
                  backgroundColor: color.surface2,
                  borderWidth: 1, borderColor: color.line,
                }}
              />
              <Txt variant="caption" tone="t4">{k}</Txt>
            </View>
          ))}
        </Row>
      </Section>

      <Section title="Type ramp — raw values">
        {(Object.keys(type) as Array<keyof typeof type>).map((k) => (
          <Row key={k}>
            <Txt variant="small" tone="t2">{k}</Txt>
            <Txt variant="caption" tone="t4">
              {String(type[k].fontSize)}pt / {String(type[k].fontWeight)}
            </Txt>
          </Row>
        ))}
      </Section>
    </ScrollView>
  );
}
