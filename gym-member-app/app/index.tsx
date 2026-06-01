import { Redirect } from 'expo-router';

/** Entry point. AuthGate does the real routing; default to the home tab. */
export default function Index() {
  return <Redirect href="/home" />;
}
