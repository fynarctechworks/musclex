import { View } from 'react-native';
import { Card, Row, Txt, Button } from './index';
import { space } from './theme';

/**
 * Inline status message.
 *
 * Replaces Alert.alert, which is a no-op on react-native-web — a failed
 * booking there looked like nothing happened at all. Inline is also simply
 * better: the message sits next to the thing it is about instead of stealing
 * the screen.
 */
export function Notice({
  tone = 'error',
  title,
  body,
  onDismiss,
}: {
  tone?: 'error' | 'info' | 'success';
  title: string;
  body?: string;
  onDismiss?: () => void;
}) {
  return (
    <Card tone={tone === 'error' ? 'accent' : tone === 'success' ? 'good' : 'default'}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1, paddingRight: space.md }}>
          <Txt
            variant="bodyStrong"
            tone={tone === 'error' ? 'accent' : tone === 'success' ? 'good' : 't1'}
          >
            {title}
          </Txt>
          {body ? (
            <Txt variant="small" tone="t2" style={{ marginTop: 4 }}>
              {body}
            </Txt>
          ) : null}
        </View>
        {onDismiss ? (
          <Button title="Dismiss" variant="quiet" size="sm" onPress={onDismiss} />
        ) : null}
      </Row>
    </Card>
  );
}

/** Inline confirm, for destructive actions that must not use Alert either. */
export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Card tone="accent">
      <Txt variant="bodyStrong">{title}</Txt>
      {body ? (
        <Txt variant="small" tone="t2" style={{ marginTop: space.sm }}>
          {body}
        </Txt>
      ) : null}
      <Row style={{ marginTop: space.lg, gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title={confirmLabel} onPress={onConfirm} />
        </View>
      </Row>
    </Card>
  );
}
