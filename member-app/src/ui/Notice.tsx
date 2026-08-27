import { View } from 'react-native';
import { Card, Row, Txt, Button } from './index';

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
      <Row className="items-start">
        <View className="flex-1 pr-3">
          <Txt
            variant="bodyStrong"
            tone={tone === 'error' ? 'accent' : tone === 'success' ? 'good' : 't1'}
          >
            {title}
          </Txt>
          {body ? (
            <Txt variant="small" tone="t2" className="mt-1">
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
        <Txt variant="small" tone="t2" className="mt-2">
          {body}
        </Txt>
      ) : null}
      <Row className="mt-4 gap-2">
        <View className="flex-1">
          <Button title="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View className="flex-1">
          <Button title={confirmLabel} onPress={onConfirm} />
        </View>
      </Row>
    </Card>
  );
}
