import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
  Animated,
  type TextInputProps,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#0087FF';

interface Props extends TextInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

/**
 * A text input with a prominent microphone button.
 * Tapping the mic focuses the input and shows a hint to use device dictation.
 * On iOS: the dictation button appears on the keyboard.
 * On Android: Google voice input is triggered when the mic key is tapped.
 */
export default function VoiceTextInput({
  value,
  onChangeText,
  style,
  ...rest
}: Props) {
  const { t } = useTranslation();
  const [showDictationHint, setShowDictationHint] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (showDictationHint) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      pulse.start();
      const timer = setTimeout(() => setShowDictationHint(false), 4000);
      return () => { pulse.stop(); clearTimeout(timer); };
    }
  }, [showDictationHint, pulseAnim]);

  const handleMicPress = () => {
    // Focus the input to bring up keyboard, then show hint about dictation
    inputRef.current?.focus();
    setShowDictationHint(true);
  };

  return (
    <View style={styles.container}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        style={[styles.input, style]}
        placeholderTextColor="#636366"
        {...rest}
      />
      <TouchableOpacity
        style={styles.micButton}
        onPress={handleMicPress}
        activeOpacity={0.7}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        {showDictationHint ? (
          <Animated.Text style={[styles.micIcon, { transform: [{ scale: pulseAnim }] }]}>
            🎙️
          </Animated.Text>
        ) : (
          <Text style={styles.micIcon}>🎤</Text>
        )}
      </TouchableOpacity>
      {showDictationHint && (
        <View style={styles.hintBubble}>
          <Text style={styles.hintText}>{t('jobDetail.voiceHint')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  input: {
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    paddingEnd: 48,
    fontSize: 15,
    color: '#fff',
    minHeight: 48,
    borderWidth: 1,
    borderColor: '#363638',
  },
  micButton: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#363638',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micIcon: { fontSize: 18 },
  hintBubble: {
    position: 'absolute',
    right: 0,
    top: -32,
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  hintText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
