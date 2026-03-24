import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#0087FF';

const STEPS = [
  { key: 'received', icon: '📥' },
  { key: 'diagnosing', icon: '🔍' },
  { key: 'awaiting_approval', icon: '📋' },
  { key: 'in_progress', icon: '🔧' },
  { key: 'quality_check', icon: '✅' },
  { key: 'ready', icon: '🚗' },
  { key: 'invoiced', icon: '🧾' },
] as const;

const STEP_COLORS: Record<string, string> = {
  received: '#2196F3',
  diagnosing: '#9C27B0',
  awaiting_approval: '#FF9800',
  in_progress: '#0087FF',
  awaiting_parts: '#FFC107',
  quality_check: '#00BCD4',
  ready: '#8BC34A',
  invoiced: '#607D8B',
};

interface Props {
  currentStatus: string;
}

export default function RepairTracker({ currentStatus }: Props) {
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const currentIndex = STEPS.findIndex((s) => s.key === currentStatus);
  const progress = currentIndex >= 0 ? currentIndex / (STEPS.length - 1) : 0;

  // Pulse animation for current step
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Progress bar animation
  useEffect(() => {
    Animated.spring(progressAnim, {
      toValue: progress,
      useNativeDriver: false,
      tension: 20,
      friction: 7,
    }).start();
  }, [progress, progressAnim]);

  const currentColor = STEP_COLORS[currentStatus] ?? PRIMARY;
  const trackerMessage = t(`jobDetail.tracker.${currentStatus}`, '');

  return (
    <View style={styles.container}>
      {/* Status message banner */}
      <View style={[styles.messageBanner, { backgroundColor: currentColor + '15', borderColor: currentColor + '40' }]}>
        <Text style={styles.messageIcon}>
          {STEPS.find((s) => s.key === currentStatus)?.icon ?? '🔧'}
        </Text>
        <Text style={[styles.messageText, { color: currentColor }]}>
          {trackerMessage}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: currentColor,
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>

      {/* Step dots */}
      <View style={styles.stepsContainer}>
        {STEPS.map((step, i) => {
          const isCompleted = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isFuture = i > currentIndex;
          const stepColor = isCurrent
            ? currentColor
            : isCompleted
              ? '#8BC34A'
              : '#E5E5EA';

          return (
            <View key={step.key} style={styles.stepColumn}>
              {isCurrent ? (
                <Animated.View
                  style={[
                    styles.stepDot,
                    styles.stepDotCurrent,
                    {
                      backgroundColor: stepColor,
                      transform: [{ scale: pulseAnim }],
                      shadowColor: stepColor,
                    },
                  ]}
                >
                  <Text style={styles.stepIcon}>{step.icon}</Text>
                </Animated.View>
              ) : (
                <View
                  style={[
                    styles.stepDot,
                    { backgroundColor: stepColor },
                    isCompleted && styles.stepDotCompleted,
                  ]}
                >
                  {isCompleted ? (
                    <Text style={styles.checkIcon}>✓</Text>
                  ) : (
                    <Text style={[styles.stepIconSmall, isFuture && { opacity: 0.4 }]}>
                      {step.icon}
                    </Text>
                  )}
                </View>
              )}
              <Text
                style={[
                  styles.stepLabel,
                  isCurrent && { color: currentColor, fontWeight: '700' },
                  isFuture && { opacity: 0.4 },
                ]}
                numberOfLines={2}
              >
                {t(`jobs.status.${step.key}`, step.key)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  // Message banner
  messageBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
    gap: 10,
  },
  messageIcon: { fontSize: 24 },
  messageText: { fontSize: 15, fontWeight: '600', flex: 1, lineHeight: 20 },

  // Progress bar
  progressBarBg: {
    height: 6,
    backgroundColor: '#E5E5EA',
    borderRadius: 3,
    marginBottom: 20,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },

  // Steps
  stepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepColumn: {
    alignItems: 'center',
    flex: 1,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  stepDotCurrent: {
    width: 40,
    height: 40,
    borderRadius: 20,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  stepDotCompleted: {},
  checkIcon: { color: '#fff', fontSize: 14, fontWeight: '800' },
  stepIcon: { fontSize: 18 },
  stepIconSmall: { fontSize: 14 },
  stepLabel: {
    fontSize: 9,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 12,
  },
});
