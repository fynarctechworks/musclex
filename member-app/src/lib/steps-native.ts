/**
 * The one place `expo-sensors` is loaded.
 *
 * Split into its own module for a testing reason with a real payoff: Jest's
 * CommonJS runtime cannot evaluate a genuine dynamic `import()`, so a test can
 * neither reach nor replace one. Mocking THIS module gives tests the whole
 * pedometer surface while leaving the lazy import exactly as it ships — the
 * iOS path is then verifiable without a physical phone, which is otherwise
 * impossible: a simulator has no motion chip.
 *
 * Still lazy. The import runs when loadPedometer() is called, not when
 * anything imports this file, which is what keeps the native module out of
 * reach on Android and web.
 */
export type PedometerModule = typeof import('expo-sensors').Pedometer;

export async function loadPedometer(): Promise<PedometerModule> {
  return (await import('expo-sensors')).Pedometer;
}
