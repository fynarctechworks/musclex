import { useMemo } from 'react';
import { useProfile } from '../api/queries';
import {
  formatHeight,
  formatVolume,
  formatWeight,
  fromKg,
  roundWeight,
  toKg,
  type HeightUnit,
  type WeightUnit,
} from './units';

/**
 * The member's display units, with the conversions bound to them.
 *
 * Screens should never reach for the raw converters — taking them from here
 * means a screen cannot accidentally render kg to someone who set pounds,
 * which is the failure mode that makes a units feature worse than not having
 * one.
 */
export function useUnits() {
  const { data: profile } = useProfile();
  const weightUnit = (profile?.weightUnit as WeightUnit) ?? 'kg';
  const heightUnit = (profile?.heightUnit as HeightUnit) ?? 'cm';

  return useMemo(
    () => ({
      weightUnit,
      heightUnit,
      /** Display value for an input field, already rounded to a real increment. */
      w: (kg: number | null | undefined) =>
        kg == null ? '' : String(roundWeight(fromKg(kg, weightUnit), weightUnit)),
      /** "62.5 kg" */
      fw: (kg: number | null | undefined) => formatWeight(kg, weightUnit),
      /** "62.5kg" for dense rows */
      fwc: (kg: number | null | undefined) => formatWeight(kg, weightUnit, true),
      /** "1,445 kg" */
      fv: (kg: number) => formatVolume(kg, weightUnit),
      /** Back to canonical kg for the API. */
      toKg: (value: number) => toKg(value, weightUnit),
      fh: (cm: number | null | undefined) => formatHeight(cm, heightUnit),
    }),
    [weightUnit, heightUnit],
  );
}
