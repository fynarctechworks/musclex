import * as React from 'react';
import { Info, TriangleAlert } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * ────────────────────────────────────────────────────────────────
 * DESIGN SYSTEM — shadcn preset bKsI1x32
 * ────────────────────────────────────────────────────────────────
 *
 * The reference for redesigning this app: every token and component the new
 * system provides, on one scrollable screen, built the same way staff-app's
 * gallery is — React Native Reusables components styled with uniwind
 * classNames against src/global.css.
 *
 * This is NOT the same screen as src/ui/Gallery.tsx. That one documents the
 * app as it stands today: theme.ts, plain StyleSheet, the four-step ink ladder.
 * Both are reachable while the migration runs, deliberately — the whole point
 * of a migration reference is being able to hold the current thing and the
 * target thing side by side. Gallery.tsx goes when the last screen stops
 * importing theme.ts, not before.
 *
 * Swatches read their colour from a className, never from a hardcoded hex, so
 * a token edit in global.css moves this screen with it. The hex printed beneath
 * each swatch is a caption for the eye and is the one thing here that CAN drift
 * — the tests pin the important ones.
 */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <View className="gap-0.5">
        <Text className="text-foreground text-base font-semibold">{title}</Text>
        {hint ? <Text className="text-muted-foreground text-xs">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

/** A colour chip plus the name a designer would say out loud and the hex. */
function Swatch({ className, name, hex, border }: { className: string; name: string; hex: string; border?: boolean }) {
  return (
    <View className="gap-1">
      <View className={`h-14 w-full rounded-lg ${className} ${border ? 'border-border border' : ''}`} />
      <Text className="text-foreground text-xs font-medium">{name}</Text>
      <Text className="text-muted-foreground text-[10px]">{hex}</Text>
    </View>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <View className="flex-row flex-wrap gap-3">{children}</View>;
}

/** Fixed-width cell so swatches line up in a three-column grid. */
function Cell({ children }: { children: React.ReactNode }) {
  return <View style={{ width: '31%' }}>{children}</View>;
}

export function PresetGallery() {
  const [checked, setChecked] = React.useState(true);
  const [on, setOn] = React.useState(true);
  const [unit, setUnit] = React.useState('kg');
  const [goal, setGoal] = React.useState('lose');
  const [bold, setBold] = React.useState(false);
  const [muscles, setMuscles] = React.useState<string[]>(['chest']);

  return (
    <ScrollView
      className="bg-background flex-1"
      contentContainerClassName="gap-8 p-5 pb-24"
      testID="preset-gallery">
      <View className="gap-1">
        <Text className="text-foreground text-2xl font-bold">Design system</Text>
        <Text className="text-muted-foreground text-xs">
          shadcn preset bKsI1x32 · base-luma · stone · red · radius large · lucide
        </Text>
      </View>

      <Section title="Surfaces" hint="background and card are both pure white in this preset — a card is held by its border, not its tone.">
        <Grid>
          <Cell><Swatch className="bg-background" name="background" hex="#ffffff" border /></Cell>
          <Cell><Swatch className="bg-card" name="card" hex="#ffffff" border /></Cell>
          <Cell><Swatch className="bg-popover" name="popover" hex="#ffffff" border /></Cell>
          <Cell><Swatch className="bg-secondary" name="secondary" hex="#f4f4f5" /></Cell>
          <Cell><Swatch className="bg-muted" name="muted" hex="#f5f5f4" /></Cell>
          <Cell><Swatch className="bg-accent" name="accent" hex="#f5f5f4" /></Cell>
        </Grid>
      </Section>

      <Section title="Ink" hint="foreground carries all body copy; muted-foreground is the only secondary step this preset defines.">
        <Grid>
          <Cell><Swatch className="bg-foreground" name="foreground" hex="#0c0a09" /></Cell>
          <Cell><Swatch className="bg-muted-foreground" name="muted-foreground" hex="#79716b" /></Cell>
          <Cell><Swatch className="bg-secondary-foreground" name="secondary-fg" hex="#18181b" /></Cell>
          <Cell><Swatch className="bg-accent-foreground" name="accent-fg" hex="#1c1917" /></Cell>
          <Cell><Swatch className="bg-border" name="border / input" hex="#e7e5e4" /></Cell>
          <Cell><Swatch className="bg-ring" name="ring" hex="#a6a09b" /></Cell>
        </Grid>
      </Section>

      <Section title="Primary & semantic" hint="primary and destructive are neighbouring reds here. Fine in this app — a member never deletes a member — but never use colour alone to tell them apart.">
        <Grid>
          <Cell><Swatch className="bg-primary" name="primary" hex="#c10007" /></Cell>
          <Cell><Swatch className="bg-destructive" name="destructive" hex="#e7000b" /></Cell>
          <Cell><Swatch className="bg-success" name="success" hex="#11823b" /></Cell>
          <Cell><Swatch className="bg-warning" name="warning" hex="#a36108" /></Cell>
        </Grid>
      </Section>

      <Section title="Nutrition" hint="Not from the preset. Kept because a macro ring with no per-macro hue cannot be read at all.">
        <Grid>
          <Cell><Swatch className="bg-protein" name="protein" hex="#2563eb" /></Cell>
          <Cell><Swatch className="bg-carbs" name="carbs" hex="#b45309" /></Cell>
          <Cell><Swatch className="bg-fat" name="fat" hex="#7c3aed" /></Cell>
          <Cell><Swatch className="bg-water" name="water" hex="#0276b3" /></Cell>
        </Grid>
      </Section>

      <Section title="Charts" hint="A five-step neutral ramp, darkest last.">
        <Grid>
          <Cell><Swatch className="bg-chart-1" name="chart-1" hex="#d6d3d1" /></Cell>
          <Cell><Swatch className="bg-chart-2" name="chart-2" hex="#79716b" /></Cell>
          <Cell><Swatch className="bg-chart-3" name="chart-3" hex="#57534d" /></Cell>
          <Cell><Swatch className="bg-chart-4" name="chart-4" hex="#44403b" /></Cell>
          <Cell><Swatch className="bg-chart-5" name="chart-5" hex="#292524" /></Cell>
        </Grid>
      </Section>

      <Section title="Typography">
        <View className="gap-2">
          <Text className="text-foreground text-3xl font-bold">Display 30</Text>
          <Text className="text-foreground text-2xl font-bold">Title 24</Text>
          <Text className="text-foreground text-lg font-semibold">Heading 18</Text>
          <Text className="text-foreground text-base">Body 16 — the default reading size.</Text>
          <Text className="text-muted-foreground text-sm">Secondary 14 — supporting copy.</Text>
          <Text className="text-muted-foreground text-xs">Caption 12 — metadata and hints.</Text>
        </View>
      </Section>

      <Section title="Buttons">
        <View className="gap-2">
          <Button><Text>Default</Text></Button>
          <Button variant="secondary"><Text>Secondary</Text></Button>
          <Button variant="outline"><Text>Outline</Text></Button>
          <Button variant="ghost"><Text>Ghost</Text></Button>
          <Button variant="destructive"><Text>Destructive</Text></Button>
          <Button variant="link"><Text>Link</Text></Button>
          <View className="flex-row items-center gap-2">
            <Button size="sm"><Text>Small</Text></Button>
            <Button size="lg"><Text>Large</Text></Button>
            <Button disabled><Text>Disabled</Text></Button>
          </View>
        </View>
      </Section>

      <Section title="Badges">
        <View className="flex-row flex-wrap items-center gap-2">
          <Badge><Text>Default</Text></Badge>
          <Badge variant="secondary"><Text>Secondary</Text></Badge>
          <Badge variant="outline"><Text>Outline</Text></Badge>
          <Badge variant="destructive"><Text>Destructive</Text></Badge>
        </View>
      </Section>

      <Section title="Card">
        <Card>
          <CardHeader>
            <CardTitle>Push day</CardTitle>
            <CardDescription>6 exercises · 45 min</CardDescription>
          </CardHeader>
          <CardContent>
            <Text className="text-muted-foreground text-sm">
              Chest, shoulders and triceps. Last done four days ago.
            </Text>
          </CardContent>
          <CardFooter className="gap-2">
            <Button size="sm"><Text>Start</Text></Button>
            <Button size="sm" variant="outline"><Text>Edit</Text></Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Form controls">
        <View className="gap-4">
          <View className="gap-1.5">
            <Label><Text>Body weight</Text></Label>
            <Input placeholder="72.5 kg" />
          </View>
          <View className="flex-row items-center gap-3">
            <Checkbox checked={checked} onCheckedChange={setChecked} />
            <Text className="text-foreground text-sm">Warm-up sets counted</Text>
          </View>
          <View className="flex-row items-center gap-3">
            <Switch checked={on} onCheckedChange={setOn} />
            <Text className="text-foreground text-sm">Rest timer</Text>
          </View>
        </View>
      </Section>

      <Section title="Progress & skeleton">
        <View className="gap-3">
          <Progress value={62} />
          <Skeleton className="h-4 w-2/3 rounded-md" />
          <Skeleton className="h-4 w-1/3 rounded-md" />
        </View>
      </Section>

      <Section title="Avatar & separator">
        <View className="flex-row items-center gap-3">
          <Avatar alt="Member avatar">
            <AvatarImage source={{ uri: 'https://i.pravatar.cc/100' }} />
            <AvatarFallback><Text>RS</Text></AvatarFallback>
          </Avatar>
          <Separator orientation="vertical" className="h-8" />
          <Text className="text-foreground text-sm">Rahul Sharma</Text>
        </View>
        <Separator />
      </Section>


      <Section title="Alerts" hint="Replaces the app's Notice. Icon plus title plus body, never colour alone.">
        <View className="gap-2">
          <Alert icon={Info}>
            <AlertTitle>New plan assigned</AlertTitle>
            <AlertDescription>Your coach updated this week's programme.</AlertDescription>
          </Alert>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Payment failed</AlertTitle>
            <AlertDescription>Your membership renewal did not go through.</AlertDescription>
          </Alert>
        </View>
      </Section>

      <Section title="Dialog" hint="Portal-backed. Renders into the PortalHost in app/_layout.tsx — without that host it opens nothing and logs nothing.">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline"><Text>Log food</Text></Button>
          </DialogTrigger>
          <DialogContent className="w-[92%]">
            <DialogHeader>
              <DialogTitle>Log food</DialogTitle>
              <DialogDescription>Search or scan a barcode.</DialogDescription>
            </DialogHeader>
            <Input placeholder="Porridge, 60g" />
            <DialogFooter>
              <Button><Text>Add</Text></Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      <Section title="Alert dialog" hint="For destructive confirmation only — it cannot be dismissed by tapping outside.">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive"><Text>Delete this log</Text></Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="w-[92%]">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this log?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the session and its sets. It cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel><Text>Cancel</Text></AlertDialogCancel>
              <AlertDialogAction><Text>Delete</Text></AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Section>

      <Section title="Select" hint="Units and other single-value choices.">
        <Select value={{ value: unit, label: unit }} onValueChange={(o) => setUnit(o?.value ?? 'kg')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Unit" className="text-foreground text-sm" />
          </SelectTrigger>
          <SelectContent className="w-40">
            <SelectItem label="kg" value="kg" />
            <SelectItem label="lb" value="lb" />
          </SelectContent>
        </Select>
      </Section>

      <Section title="Radio group" hint="One choice from a short, visible set — onboarding and goals.">
        <RadioGroup value={goal} onValueChange={setGoal} className="gap-3">
          {[['lose', 'Lose fat'], ['gain', 'Build muscle'], ['hold', 'Maintain']].map(([v, label]) => (
            <View key={v} className="flex-row items-center gap-3">
              <RadioGroupItem value={v} aria-labelledby={`goal-${v}`} />
              <Text nativeID={`goal-${v}`} className="text-foreground text-sm">{label}</Text>
            </View>
          ))}
        </RadioGroup>
      </Section>

      <Section title="Toggle & toggle group" hint="Replaces the app's Chip. Toggle group is the muscle filter row.">
        <View className="gap-3">
          <Toggle pressed={bold} onPressedChange={setBold} variant="outline">
            <Text>Warm-ups</Text>
          </Toggle>
          <ToggleGroup type="multiple" value={muscles} onValueChange={setMuscles} className="flex-row flex-wrap gap-2">
            {['chest', 'back', 'legs', 'arms'].map((m) => (
              <ToggleGroupItem key={m} value={m} variant="outline"><Text>{m}</Text></ToggleGroupItem>
            ))}
          </ToggleGroup>
        </View>
      </Section>

      <Section title="Tooltip" hint="Replaces InfoTip. Also portal-backed.">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm"><Text>What is a streak?</Text></Button>
          </TooltipTrigger>
          <TooltipContent>
            <Text>Consecutive days with at least one logged session.</Text>
          </TooltipContent>
        </Tooltip>
      </Section>

      <Section title="Radius" hint="Derived from --radius 0.875rem exactly as the preset derives it.">
        <View className="flex-row flex-wrap gap-3">
          {([['sm', 'rounded-sm', '8px'], ['md', 'rounded-md', '11px'], ['lg', 'rounded-lg', '14px'], ['xl', 'rounded-xl', '20px'], ['2xl', 'rounded-2xl', '25px'], ['full', 'rounded-full', '999px']] as const).map(
            ([name, cls, px]) => (
              <View key={name} className="items-center gap-1">
                <View className={`bg-secondary border-border h-14 w-14 border ${cls}`} />
                <Text className="text-foreground text-xs">{name}</Text>
                <Text className="text-muted-foreground text-[10px]">{px}</Text>
              </View>
            )
          )}
        </View>
      </Section>

      <Section title="Spacing" hint="Tailwind's 4pt scale; the numbers are what gap-N and p-N resolve to.">
        <View className="gap-2">
          {([['1', 'w-1', 4], ['2', 'w-2', 8], ['3', 'w-3', 12], ['4', 'w-4', 16], ['6', 'w-6', 24], ['8', 'w-8', 32], ['12', 'w-12', 48]] as const).map(
            ([n, cls, px]) => (
              <View key={n} className="flex-row items-center gap-3">
                <Text className="text-muted-foreground w-8 text-xs">{n}</Text>
                <View className={`bg-primary h-3 rounded-sm ${cls}`} />
                <Text className="text-muted-foreground text-[10px]">{px}pt</Text>
              </View>
            )
          )}
        </View>
      </Section>
    </ScrollView>
  );
}
