import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef, useCallback } from 'react';
import { apiGet, apiPost } from '../../src/lib/api';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Job {
  id: string;
  job_number: string;
  status: string;
  reported_problem?: string;
  vehicle?: {
    plate_number?: string;
    make?: string;
    model?: string;
  };
}

interface TimeEntry {
  id: string;
  job_id: string;
  status: string;
  started_at: string;
  paused_at?: string;
  total_paused_seconds?: number;
  job?: { job_number?: string; vehicle?: { plate_number?: string } };
}

interface ClockRecord {
  id: string;
  clock_in: string;
  clock_out?: string;
  total_hours?: number;
}

interface Technician {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function calcElapsed(entry: TimeEntry): number {
  const start = new Date(entry.started_at).getTime();
  const now = Date.now();
  const raw = Math.floor((now - start) / 1000);
  const paused = entry.total_paused_seconds ?? 0;
  return Math.max(0, raw - paused);
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#FFB300',
  DIAGNOSED: '#2196F3',
  APPROVED: '#4CAF50',
  IN_PROGRESS: '#FF9800',
  COMPLETED: '#8BC34A',
  DELIVERED: '#9E9E9E',
  CANCELLED: '#F44336',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function JobsScreen() {
  const { t } = useTranslation();

  const [techId, setTechId] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntry | null>(null);
  const [clockRecord, setClockRecord] = useState<ClockRecord | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Resolve technician ID ---- */
  const resolveTechnician = useCallback(async () => {
    try {
      const techs = await apiGet<Technician[]>('/technicians');
      if (techs.length > 0) {
        setTechId(techs[0].id);
        return techs[0].id;
      }
    } catch (_e) {
      // ignore
    }
    return null;
  }, []);

  /* ---- Fetch all data ---- */
  const fetchData = useCallback(
    async (tid?: string | null) => {
      const id = tid ?? techId;
      try {
        const [jobsData] = await Promise.all([
          apiGet<Job[]>('/jobs'),
        ]);
        setJobs(jobsData);

        if (id) {
          try {
            const active = await apiGet<TimeEntry | null>(`/time/active/${id}`);
            setActiveEntry(active);
            if (active && active.status === 'RUNNING') {
              setElapsed(calcElapsed(active));
            }
          } catch (_e) {
            setActiveEntry(null);
          }

          try {
            const clock = await apiGet<ClockRecord | null>(`/clock/today/${id}`);
            setClockRecord(clock);
          } catch (_e) {
            setClockRecord(null);
          }
        }
      } catch (_e) {
        // ignore fetch errors silently
      }
    },
    [techId],
  );

  /* ---- Initial load ---- */
  useEffect(() => {
    (async () => {
      const tid = await resolveTechnician();
      await fetchData(tid);
      setInitialLoading(false);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Timer tick ---- */
  useEffect(() => {
    if (activeEntry && activeEntry.status === 'RUNNING') {
      timerRef.current = setInterval(() => {
        setElapsed(calcElapsed(activeEntry));
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeEntry]);

  /* ---- Pull-to-refresh ---- */
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  /* ---- Actions ---- */
  const handleClockIn = async () => {
    if (!techId) return;
    setLoadingAction(true);
    try {
      const record = await apiPost<ClockRecord>('/clock/in', { technician_id: techId });
      setClockRecord(record);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed');
    }
    setLoadingAction(false);
  };

  const handleClockOut = async () => {
    if (!techId) return;
    setLoadingAction(true);
    try {
      const record = await apiPost<ClockRecord>('/clock/out', { technician_id: techId });
      setClockRecord(record);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed');
    }
    setLoadingAction(false);
  };

  const handleStartTimer = async (jobId: string) => {
    if (!techId) return;
    setLoadingAction(true);
    try {
      const entry = await apiPost<TimeEntry>('/time/start', {
        job_id: jobId,
        technician_id: techId,
      });
      setActiveEntry(entry);
      setElapsed(0);
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed');
    }
    setLoadingAction(false);
  };

  const handlePauseResume = async () => {
    if (!activeEntry) return;
    setLoadingAction(true);
    try {
      if (activeEntry.status === 'RUNNING') {
        const updated = await apiPost<TimeEntry>(`/time/${activeEntry.id}/pause`);
        setActiveEntry(updated);
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        const updated = await apiPost<TimeEntry>(`/time/${activeEntry.id}/resume`);
        setActiveEntry(updated);
      }
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed');
    }
    setLoadingAction(false);
  };

  const handleStopTimer = async () => {
    if (!activeEntry) return;
    setLoadingAction(true);
    try {
      await apiPost(`/time/${activeEntry.id}/stop`);
      setActiveEntry(null);
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      await fetchData();
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : 'Failed');
    }
    setLoadingAction(false);
  };

  /* ---- Clock hours today ---- */
  const clockHoursToday = (): string => {
    if (!clockRecord?.clock_in) return '0:00';
    if (clockRecord.total_hours != null) {
      const h = Math.floor(clockRecord.total_hours);
      const m = Math.round((clockRecord.total_hours - h) * 60);
      return `${h}:${String(m).padStart(2, '0')}`;
    }
    const start = new Date(clockRecord.clock_in).getTime();
    const diff = Math.floor((Date.now() - start) / 1000 / 60);
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h}:${String(m).padStart(2, '0')}`;
  };

  /* ---- Render ---- */
  if (initialLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  const isClockedIn = clockRecord != null && clockRecord.clock_out == null;
  const hasActiveTimer = activeEntry != null && (activeEntry.status === 'RUNNING' || activeEntry.status === 'PAUSED');
  const isPaused = activeEntry?.status === 'PAUSED';

  const renderJobCard = ({ item }: { item: Job }) => {
    const statusColor = STATUS_COLORS[item.status] ?? '#636366';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.jobNumber}>{item.job_number}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>
              {t(`status.${item.status}`, item.status)}
            </Text>
          </View>
        </View>

        {item.vehicle && (
          <Text style={styles.vehicleInfo}>
            {item.vehicle.plate_number}
            {item.vehicle.make ? ` - ${item.vehicle.make}` : ''}
            {item.vehicle.model ? ` ${item.vehicle.model}` : ''}
          </Text>
        )}

        {item.reported_problem ? (
          <Text style={styles.problem} numberOfLines={2}>
            {t('jobs.reportedProblem')}: {item.reported_problem}
          </Text>
        ) : null}

        {!hasActiveTimer && (
          <TouchableOpacity
            style={styles.startButton}
            onPress={() => handleStartTimer(item.id)}
            disabled={loadingAction}
            activeOpacity={0.7}
          >
            <Text style={styles.startButtonText}>{t('jobs.startTimer')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const ListHeader = () => (
    <View>
      {/* ---- Active Timer Banner ---- */}
      {hasActiveTimer && (
        <View style={styles.timerBanner}>
          <Text style={styles.timerLabel}>{t('timer.activeTimer')}</Text>
          <Text style={styles.timerJobInfo}>
            {activeEntry?.job?.job_number ?? '---'}
            {activeEntry?.job?.vehicle?.plate_number
              ? `  |  ${activeEntry.job.vehicle.plate_number}`
              : ''}
          </Text>
          <Text style={styles.timerDisplay}>
            {isPaused ? formatElapsed(elapsed) : formatElapsed(elapsed)}
          </Text>
          {isPaused && <Text style={styles.pausedLabel}>PAUSED</Text>}
          <View style={styles.timerActions}>
            <TouchableOpacity
              style={[styles.timerBtn, isPaused ? styles.resumeBtn : styles.pauseBtn]}
              onPress={handlePauseResume}
              disabled={loadingAction}
              activeOpacity={0.7}
            >
              <Text style={styles.timerBtnText}>
                {isPaused ? t('timer.resume') : t('timer.pause')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timerBtn, styles.stopBtn]}
              onPress={handleStopTimer}
              disabled={loadingAction}
              activeOpacity={0.7}
            >
              <Text style={styles.timerBtnText}>{t('timer.stop')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ---- Clock In/Out ---- */}
      <TouchableOpacity
        style={[styles.clockButton, isClockedIn ? styles.clockOutBtn : styles.clockInBtn]}
        onPress={isClockedIn ? handleClockOut : handleClockIn}
        disabled={loadingAction}
        activeOpacity={0.7}
      >
        <Text style={styles.clockButtonText}>
          {isClockedIn ? t('clock.clockOut') : t('clock.clockIn')}
        </Text>
        {isClockedIn && (
          <Text style={styles.clockHours}>
            {t('clock.hoursToday')}: {clockHoursToday()}
          </Text>
        )}
      </TouchableOpacity>

      {/* ---- Section Title ---- */}
      <Text style={styles.sectionTitle}>{t('jobs.assignedJobs')}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        renderItem={renderJobCard}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('jobs.noJobs')}</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#4CAF50"
            colors={['#4CAF50']}
          />
        }
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0C',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },

  /* Timer Banner */
  timerBanner: {
    backgroundColor: '#1B5E20',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A5D6A7',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timerJobInfo: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  timerDisplay: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginVertical: 8,
    letterSpacing: 2,
  },
  pausedLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFB300',
    letterSpacing: 2,
    marginBottom: 4,
  },
  timerActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  timerBtn: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minHeight: 52,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 120,
  },
  pauseBtn: {
    backgroundColor: '#FF9800',
  },
  resumeBtn: {
    backgroundColor: '#4CAF50',
  },
  stopBtn: {
    backgroundColor: '#F44336',
  },
  timerBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  /* Clock In/Out */
  clockButton: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    minHeight: 64,
    justifyContent: 'center',
  },
  clockInBtn: {
    backgroundColor: '#4CAF50',
  },
  clockOutBtn: {
    backgroundColor: '#D32F2F',
  },
  clockButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  clockHours: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
    opacity: 0.9,
  },

  /* Section */
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },

  /* Job Cards */
  card: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  jobNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  vehicleInfo: {
    fontSize: 15,
    color: '#AEAEB2',
    marginBottom: 4,
  },
  problem: {
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  emptyText: {
    textAlign: 'center',
    color: '#636366',
    fontSize: 16,
    marginTop: 48,
  },
});
