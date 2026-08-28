import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Chip, Empty, Label, Loading, Meter, Row, Txt } from './index';
import { Icon, type IconName } from './Icon';
import { InfoDot, InfoNote, InfoBullet } from './InfoTip';
import { Notice, Confirm } from './Notice';
import { chart } from './chart-colors';

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
    <View className="gap-3 py-6">
      <Txt variant="label" tone="t3">
        {title}
      </Txt>
      {children}
    </View>
  );
}

/**
 * One colour, named by the CLASS you would actually write rather than by a
 * token object that no longer exists. A reference that names something
 * uncallable is worse than no reference.
 */
function Swatch({ name, value }: { name: string; value: string }) {
  return (
    <View className="w-[84px] items-center gap-1">
      {/* The swatch IS the colour, so the fill stays inline. */}
      <View
        className="border-border h-14 w-14 rounded-md border"
        style={{ backgroundColor: value }}
      />
      <Txt variant="caption" tone="t3" numberOfLines={1}>
        {name}
      </Txt>
      <Txt variant="caption" tone="t4" numberOfLines={1}>
        {value}
      </Txt>
    </View>
  );
}

/**
 * The spacing and radius steps this app actually uses, as the CLASS you would
 * write. Tailwind's full scale is far larger; listing all of it would document
 * the framework rather than the design.
 */
const SPACING: [string, number][] = [
  ['gap-1', 4],
  ['gap-2', 8],
  ['gap-3', 12],
  ['gap-4', 16],
  ['gap-6', 24],
  ['gap-8', 32],
  ['gap-12', 48],
];

/** Derived from --radius 0.875rem, exactly as the preset derives them. */
const RADII: [string, number][] = [
  ['rounded-sm', 8],
  ['rounded-md', 11],
  ['rounded-lg', 14],
  ['rounded-xl', 20],
  ['rounded-full', 999],
];

const ICONS: IconName[] = [
  'today', 'progress', 'gym', 'community', 'me', 'scan', 'streak', 'target',
  'water', 'nutrition', 'plan', 'coach', 'challenge', 'kudos', 'check', 'alert',
];

export function Gallery() {
  const [confirming, setConfirming] = useState(false);
  const [chipOn, setChipOn] = useState(true);
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <ScrollView className="bg-background flex-1" contentContainerClassName="p-4 pb-12">
      {/*
        Palette first, because it is the thing most often needed and the
        thing a screenshot of a component cannot give you.
      */}
      <Section title="Palette — surfaces">
        <View className="flex-row flex-wrap gap-3">
          <Swatch name="bg-background" value="#fafaf9" />
          <Swatch name="bg-card" value="#ffffff" />
          <Swatch name="bg-secondary" value="#f4f4f5" />
          <Swatch name="bg-muted" value="#f5f5f4" />
          <Swatch name="border-border" value="#e7e5e4" />
        </View>
      </Section>

      <Section title="Palette — ink ladder">
        <View className="flex-row flex-wrap gap-3">
          <Swatch name="foreground (t1)" value="#0c0a09" />
          <Swatch name="ink-2 (t2)" value="#44403b" />
          <Swatch name="muted-fg (t3)" value="#79716b" />
          <Swatch name="ink-4 (t4)" value="#a6a09b" />
        </View>
        <InfoNote>
          <Txt variant="small" tone="t2">
            ink-4 is decorative and disabled ONLY — it clears the 3:1 non-text
            threshold and must never carry information. If a label matters
            enough to read, it is muted-foreground.
          </Txt>
        </InfoNote>
      </Section>

      <Section title="Palette — accent & semantic">
        <View className="flex-row flex-wrap gap-3">
          <Swatch name="primary" value={chart.accent} />
          <Swatch name="success" value={chart.good} />
          <Swatch name="warning" value={chart.warn} />
          <Swatch name="protein" value={chart.protein} />
          <Swatch name="carbs" value={chart.carbs} />
          <Swatch name="fat" value={chart.fat} />
          <Swatch name="water" value={chart.water} />
        </View>
        <InfoNote>
          <Txt variant="small" tone="t2">
            One saturated accent carries actions and nothing else. The semantic
            hues are darkened until they pass 4.5:1 as TEXT on the page
            background — not merely as fills.
          </Txt>
          <Txt variant="small" tone="t2">
            These are the only values a chart may use directly: SVG fill and
            stroke are node props, so no class reaches them. Everything else on
            this page is a className. src/global.css is the source of truth;
            chart-colors.ts mirrors it.
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
        <Card>
          <Txt variant="bodyStrong">Default</Txt>
          <Txt variant="small" tone="t2">A white surface on the grey canvas.</Txt>
        </Card>
        <Card tone="accent">
          <Txt variant="bodyStrong" tone="accent">Accent</Txt>
          <Txt variant="small" tone="t2">Used sparingly — it is the loudest thing on a screen.</Txt>
        </Card>
        <Card tone="good">
          <Txt variant="bodyStrong" tone="good">Good</Txt>
          <Txt variant="small" tone="t2">Streak kept, goal met, session done.</Txt>
        </Card>
      </Section>

      <Section title="Chips">
        <Row className="flex-wrap gap-2">
          <Chip label="Push" on={chipOn} />
          <Chip label="Pull" />
          <Chip label="Legs" />
        </Row>
        <Button title="Toggle first chip" variant="quiet" size="sm" onPress={() => setChipOn((v) => !v)} />
      </Section>

      <Section title="Meter">
        <Meter value={7} max={10} tint={chart.good} />
        <Txt variant="caption" tone="t3">7 of 10 sessions</Txt>
        <Meter value={2100} max={2600} tint={chart.protein} />
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
        <Row className="gap-2">
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
        <View className="flex-row flex-wrap gap-4">
          {ICONS.map((n) => (
            <View key={n} className="w-16 items-center gap-1">
              <Icon name={n} size={22} tone="t2" decorative />
              <Txt variant="caption" tone="t4" numberOfLines={1}>{n}</Txt>
            </View>
          ))}
        </View>
      </Section>

      <Section title="Spacing — Tailwind's scale">
        <View className="gap-2">
          {SPACING.map(([cls, px]) => (
            <Row key={cls} className="gap-3">
              <Txt variant="caption" tone="t3" className="w-14">
                {cls}
              </Txt>
              {/* The bar's width IS the value being documented. */}
              <View className="bg-ink-4 h-2 rounded-sm" style={{ width: px }} />
              <Txt variant="caption" tone="t4">
                {px}pt
              </Txt>
            </Row>
          ))}
        </View>
      </Section>

      <Section title="Radius">
        <Row className="flex-wrap gap-3">
          {RADII.map(([cls, px]) => (
            <View key={cls} className="items-center gap-1">
              <View
                className="border-border bg-secondary h-10 w-14 border"
                style={{ borderRadius: px }}
              />
              <Txt variant="caption" tone="t4">
                {cls}
              </Txt>
            </View>
          ))}
        </Row>
      </Section>
    </ScrollView>
  );
}
