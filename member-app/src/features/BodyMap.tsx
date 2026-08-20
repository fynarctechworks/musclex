import React from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { Txt } from '../ui';
import { color, space } from '../ui/theme';
import { MIRROR_X, REGIONS, regionTotals, shade, type Side } from '../lib/body-map';

/**
 * ────────────────────────────────────────────────────────────────
 * BODY MAP
 * ────────────────────────────────────────────────────────────────
 *
 * Two schematic silhouettes, front and back, with each region shaded by how
 * much it was worked relative to the member's hardest-worked muscle.
 *
 * Built from the actual target muscle of every SET logged. Strava ships a
 * muscle map inferred from a stopwatch; this is the version you can only draw
 * if you know what somebody actually lifted.
 */

const FILL = [
  color.surface2,
  'rgba(225,6,0,0.18)',
  'rgba(225,6,0,0.36)',
  'rgba(225,6,0,0.62)',
  color.accent,
] as const;

export function BodyMap({ byMuscle }: { byMuscle: { muscle: string; sets: number }[] }) {
  const totals = regionTotals(byMuscle);
  const max = Math.max(0, ...totals.values());

  return (
    <View style={{ flexDirection: 'row', gap: space.lg, justifyContent: 'center' }}>
      {(['front', 'back'] as Side[]).map((side) => (
        <View key={side} style={{ alignItems: 'center', flex: 1 }}>
          <Svg viewBox="0 0 100 220" width="100%" height={220}>
            {/* Head and torso outline, so the shapes read as a body rather
                than a bar chart standing up. */}
            <Rect x={40} y={8} width={20} height={24} rx={10} fill={color.surface2} />
            <Rect x={22} y={38} width={56} height={78} rx={14} fill={color.surface2} />
            <Rect x={28} y={116} width={44} height={92} rx={16} fill={color.surface2} />

            {REGIONS.filter((r) => r.side === side).map((r) => {
              const fill = FILL[shade(totals.get(r.key) ?? 0, max)];
              // Arms are stored once and mirrored, so a single region lights
              // both sides rather than needing a duplicate entry.
              const mirrored = r.key === 'arms' || r.key === 'arms_back';
              return (
                <React.Fragment key={r.key}>
                  <Rect x={r.x} y={r.y} width={r.w} height={r.h} rx={r.rx} fill={fill} />
                  {mirrored ? (
                    <Rect
                      x={MIRROR_X - r.x - r.w}
                      y={r.y}
                      width={r.w}
                      height={r.h}
                      rx={r.rx}
                      fill={fill}
                    />
                  ) : null}
                </React.Fragment>
              );
            })}
          </Svg>
          <Txt variant="caption" tone="t3" style={{ marginTop: space.xs }}>
            {side === 'front' ? 'Front' : 'Back'}
          </Txt>
        </View>
      ))}
    </View>
  );
}
