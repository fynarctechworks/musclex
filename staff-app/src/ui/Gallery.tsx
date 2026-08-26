/**
 * ────────────────────────────────────────────────────────────────
 * TEST FIXTURE — not a screen
 * ────────────────────────────────────────────────────────────────
 *
 * There is no `/gallery` route any more. This app ships to the App Store, and
 * a dev-only design-system screen has no business in a release bundle even
 * behind a `__DEV__` link — the ROUTE FILE itself is bundled by expo-router
 * regardless of who links to it, which left it reachable by deep link.
 *
 * The component survives because `src/__tests__/gallery.test.tsx` mounts every
 * primitive in one render, which is the cheapest guard there is against a
 * registry re-pull or a token change breaking a component. It already caught
 * the RNR/uniwind `placeholderClassName` defect once. Nothing under `app/`
 * imports this file, so it is not in the shipped bundle.
 *
 * The live, navigable version now lives in member-app (More → Design system),
 * and screenshots of this one are in `docs/design-system/`.
 *
 * DO NOT add a route back. If you need to see it on a device, add the route
 * locally and delete it before committing.
 */

import React from 'react';
import { ScrollView, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { TriangleAlert } from 'lucide-react-native';
import { RowCard } from '@/ui/RowCard';
import { StatTile } from '@/ui/StatTile';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { EmptyState, ErrorState, OfflineState } from '@/ui/States';
import { BarChart, DonutChart, LineChart, Sparkline } from '@/charts';
import { formatCurrency, formatCurrencyCompact, formatRelative } from '@/lib/format';
import { tokens } from '@/ui/tokens';
import { useToast } from '@/ui/Toast';
import { SwipeActions } from '@/ui/SwipeActions';
import { FilterSheet } from '@/ui/Sheet';
import { DateField, DateRangeField, TimeField, type DateRange } from '@/ui/DatePicker';
import { ScheduleCalendar } from '@/ui/ScheduleCalendar';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';


/**
 * Design-system gallery.
 *
 * The reference surface for Phase 2: every primitive rendered against the
 * MuscleX tokens in src/global.css, with copy drawn from the actual product so
 * the components are judged the way they will be used — a member row, a dues
 * figure, a class name — rather than as lorem ipsum.
 *
 * Not linked from the tab bar: it is a developer surface reached at /gallery.
 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-3 py-4">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </Text>
      {children}
      <Separator className="mt-2" />
    </View>
  );
}

export function Gallery() {
  const [checked, setChecked] = React.useState(true);
  const [notify, setNotify] = React.useState(false);
  const [tab, setTab] = React.useState('today');
  const [range, setRange] = React.useState<'today' | 'week' | 'month'>('week');
  const toast = useToast();
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [when, setWhen] = React.useState(new Date('2026-09-12T18:30:00'));
  const [span, setSpan] = React.useState<DateRange>({
    from: new Date('2026-08-01T00:00:00'),
    to: new Date('2026-08-31T00:00:00'),
  });
  const [day, setDay] = React.useState(new Date('2026-08-26T00:00:00'));

  return (
    <>
    <ScrollView
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pb-16"
      >
        <Section title="Typography">
          <Text className="text-2xl font-semibold text-foreground">Front desk</Text>
          <Text className="text-base text-foreground">
            42 members checked in today.
          </Text>
          <Text className="text-sm text-muted-foreground">
            Secondary copy sits on the muted step — the AA floor for normal text.
          </Text>
        </Section>

        <Section title="Buttons">
          <View className="flex-row flex-wrap gap-2">
            <Button>
              <Text>Collect payment</Text>
            </Button>
            <Button variant="secondary">
              <Text>Add member</Text>
            </Button>
            <Button variant="outline">
              <Text>Filter</Text>
            </Button>
            <Button variant="ghost">
              <Text>Cancel</Text>
            </Button>
            <Button variant="destructive">
              <Text>Delete</Text>
            </Button>
          </View>
        </Section>

        <Section title="Badges">
          <View className="flex-row flex-wrap gap-2">
            <Badge variant="success">
              <Text>Active</Text>
            </Badge>
            <Badge variant="warning">
              <Text>Expiring</Text>
            </Badge>
            <Badge variant="secondary">
              <Text>Paused</Text>
            </Badge>
            <Badge variant="destructive">
              <Text>Overdue</Text>
            </Badge>
            <Badge variant="outline">
              <Text>Trial</Text>
            </Badge>
          </View>
        </Section>

        <Section title="Card — the member row pattern">
          <Card>
            <CardHeader>
              <View className="flex-row items-center gap-3">
                <Avatar alt="Member avatar">
                  <AvatarFallback>
                    <Text>RS</Text>
                  </AvatarFallback>
                </Avatar>
                <View className="flex-1">
                  <CardTitle>Rahul Sharma</CardTitle>
                  <CardDescription>Gold · expires 12 Sep</CardDescription>
                </View>
                <Badge variant="destructive">
                  <Text>₹2,400 due</Text>
                </Badge>
              </View>
            </CardHeader>
            <CardContent>
              <Text className="text-sm text-muted-foreground">
                Last visit 3 days ago · 14 visits this month
              </Text>
            </CardContent>
          </Card>
        </Section>

        <Section title="Form controls">
          <View className="gap-2">
            <Label>
              <Text>Member name</Text>
            </Label>
            <Input placeholder="Search members" />
            <Textarea placeholder="Note visible to staff only" />
            <View className="mt-2 flex-row items-center gap-3">
              <Checkbox checked={checked} onCheckedChange={setChecked} />
              <Text className="text-sm text-foreground">Send receipt by WhatsApp</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm text-foreground">Push notifications</Text>
              <Switch checked={notify} onCheckedChange={setNotify} />
            </View>
          </View>
        </Section>

        <Section title="Feedback">
          <Progress value={68} />
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Subscription expires in 6 days</AlertTitle>
            <AlertDescription>Renew to keep collecting payments.</AlertDescription>
          </Alert>
        </Section>

        <Section title="Interactive — portal-backed overlays">
          <View className="flex-row flex-wrap gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline"><Text>Dialog</Text></Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Collect payment</DialogTitle>
                  <DialogDescription>
                    ₹2,400 due from Rahul Sharma.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button><Text>Mark paid</Text></Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Text>Delete</Text></Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this member?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes their history. It cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel><Text>Cancel</Text></AlertDialogCancel>
                  <AlertDialogAction><Text>Delete</Text></AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline"><Text>Popover</Text></Button>
              </PopoverTrigger>
              <PopoverContent className="w-64">
                <Text className="text-sm text-foreground">
                  14 visits this month, up from 9.
                </Text>
              </PopoverContent>
            </Popover>
          </View>

          <Select>
            <SelectTrigger>
              <SelectValue placeholder="Membership plan" className="text-foreground" />
            </SelectTrigger>
            <SelectContent>
              {/* SelectItem renders its own label — it takes no children. */}
              <SelectItem label="Gold" value="gold" />
              <SelectItem label="Silver" value="silver" />
            </SelectContent>
          </Select>
        </Section>

        <Section title="Disclosure">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="flex-row">
              <TabsTrigger value="today" className="flex-1"><Text>Today</Text></TabsTrigger>
              <TabsTrigger value="week" className="flex-1"><Text>Week</Text></TabsTrigger>
            </TabsList>
            <TabsContent value="today">
              <Text className="pt-2 text-sm text-muted-foreground">42 check-ins today.</Text>
            </TabsContent>
          </Tabs>

          <Accordion type="single" collapsible>
            <AccordionItem value="a">
              <AccordionTrigger><Text>Payment history</Text></AccordionTrigger>
              <AccordionContent>
                <Text className="text-sm text-muted-foreground">3 payments, ₹7,200 total.</Text>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Section>

        <Section title="Metrics">
          <View className="flex-row gap-3">
            <StatTile
              className="flex-1"
              label="Collected"
              value={formatCurrencyCompact(248000, 'INR')}
              deltaPercent={12.4}
              intent="up-is-good"
              hint="vs last week"
            />
            <StatTile
              className="flex-1"
              label="At risk"
              value="17"
              deltaPercent={8.1}
              intent="up-is-bad"
              hint="members"
            />
          </View>
          <StatTile label="Check-ins today" value="42" hint="Neutral metric — no colour implied" />
        </Section>

        <Section title="Charts (react-native-svg, replacing recharts)">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted-foreground">Sparkline</Text>
            <Sparkline values={[4, 9, 6, 11, 8, 14, 12]} />
          </View>
          <LineChart values={[12, 18, 9, 22, 17, 25, 21]} width={320} height={110} />
          <BarChart values={[8, 14, 6, 19, 11, 22, 16]} width={320} height={110} />
          <View className="flex-row items-center gap-4">
            <DonutChart
              center="248"
              slices={[
                { value: 120, color: tokens.foreground },
                { value: 78, color: tokens.success },
                { value: 50, color: tokens.destructive },
              ]}
            />
            <View className="gap-1">
              <Text className="text-sm text-muted-foreground">Gold · 120</Text>
              <Text className="text-sm text-muted-foreground">Silver · 78</Text>
              <Text className="text-sm text-muted-foreground">Lapsed · 50</Text>
            </View>
          </View>
        </Section>

        <Section title="Segmented control">
          <SegmentedControl
            value={range}
            onChange={setRange}
            segments={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
        </Section>

        <Section title="Row card — the table replacement">
          <RowCard
            initials="RS"
            title="Rahul Sharma"
            subtitle="Gold · expires 12 Sep"
            meta={`Last visit ${formatRelative('2026-08-22T10:00:00', new Date('2026-08-25T12:00:00'))} · 14 visits`}
            trailing={<Badge variant="destructive"><Text>{formatCurrency(2400, 'INR')} due</Text></Badge>}
            onPress={() => {}}
          />
          <RowCard
            initials="AK"
            title="Anita Kumar"
            subtitle="Silver · expires 4 Nov"
            meta="Last visit 2 hours ago · 22 visits"
            trailing={<Badge variant="success"><Text>Active</Text></Badge>}
            onPress={() => {}}
          />
        </Section>

        <Section title="Empty / error / offline">
          <EmptyState title="No members yet" body="Add your first member to get started." />
          <ErrorState onRetry={() => {}} />
          <OfflineState lastSynced="9:05 am" onRetry={() => {}} />
        </Section>

        <Section title="Toast">
          <View className="flex-row flex-wrap gap-2">
            <Button variant="outline" onPress={() => toast.show('Payment recorded')}>
              <Text>Success</Text>
            </Button>
            <Button variant="outline" onPress={() => toast.show('Card declined', 'error')}>
              <Text>Error</Text>
            </Button>
          </View>
        </Section>

        <Section title="Swipe actions — reveal, never auto-fire">
          <SwipeActions actionLabel="Mark paid" onAction={() => toast.show('Marked paid')}>
            <RowCard
              initials="RS"
              title="Rahul Sharma"
              subtitle="Gold · expires 12 Sep"
              trailing={<Badge variant="destructive"><Text>₹2,400 due</Text></Badge>}
              chevron={false}
            />
          </SwipeActions>
        </Section>

        <Section title="Filter sheet">
          <Button variant="outline" onPress={() => setFiltersOpen(true)}>
            <Text>Filters · 2</Text>
          </Button>
        </Section>

        <Section title="Date & time">
          <DateField label="Expires on" value={when} onChange={setWhen} />
          <TimeField label="Session time" value={when} onChange={setWhen} />
        </Section>

        <Section title="Calendar">
          <ScheduleCalendar
            selected={day}
            onSelect={setDay}
            marks={[
              { date: '2026-08-26', count: 4 },
              { date: '2026-08-28', count: 2, tone: 'warning' },
              { date: '2026-08-30', count: 1, tone: 'danger' },
            ]}
          />
        </Section>

        <Section title="Loading">
          <View className="gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </View>
        </Section>
    </ScrollView>

    {/*
      A bottom sheet MUST be a sibling of the scroll view, never a child.
      Nested inside, it positions itself within the scroll CONTENT and lands
      off-screen — it mounts, state flips, and nothing appears.
    */}
        <FilterSheet
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          onClear={() => setFiltersOpen(false)}
          activeCount={2}>
          <SegmentedControl
            value={range}
            onChange={setRange}
            segments={[
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Week' },
              { value: 'month', label: 'Month' },
            ]}
          />
          <DateRangeField value={span} onChange={setSpan} />
        </FilterSheet>
    </>
  );
}
