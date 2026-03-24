import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  PanResponder,
  Dimensions,
  Modal,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#0087FF';
const DRAW_COLOR = '#FF0000';
const SCREEN_WIDTH = Dimensions.get('window').width;

interface Point {
  x: number;
  y: number;
}

interface DrawPath {
  points: Point[];
}

interface Props {
  imageUri: string;
  visible: boolean;
  onSave: (annotatedUri: string) => void;
  onClose: () => void;
}

export default function PhotoAnnotator({
  imageUri,
  visible,
  onSave,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [paths, setPaths] = useState<DrawPath[]>([]);
  const [circles, setCircles] = useState<{ cx: number; cy: number; r: number }[]>([]);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [tool, setTool] = useState<'draw' | 'circle'>('draw');
  const startPoint = useRef<Point | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (tool === 'draw') {
          setCurrentPath([{ x: locationX, y: locationY }]);
        } else {
          startPoint.current = { x: locationX, y: locationY };
        }
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        if (tool === 'draw') {
          setCurrentPath((prev) => [...prev, { x: locationX, y: locationY }]);
        }
      },
      onPanResponderRelease: (evt) => {
        if (tool === 'draw' && currentPath.length > 1) {
          setPaths((prev) => [...prev, { points: [...currentPath, { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY }] }]);
          setCurrentPath([]);
        } else if (tool === 'circle' && startPoint.current) {
          const end = { x: evt.nativeEvent.locationX, y: evt.nativeEvent.locationY };
          const cx = (startPoint.current.x + end.x) / 2;
          const cy = (startPoint.current.y + end.y) / 2;
          const r = Math.max(
            20,
            Math.sqrt(
              Math.pow(end.x - startPoint.current.x, 2) +
                Math.pow(end.y - startPoint.current.y, 2),
            ) / 2,
          );
          setCircles((prev) => [...prev, { cx, cy, r }]);
          startPoint.current = null;
        }
      },
    }),
  ).current;

  const pathToD = (points: Point[]): string => {
    if (points.length < 2) return '';
    const first = points[0]!;
    return `M ${first.x} ${first.y} ${points
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(' ')}`;
  };

  const handleClear = () => {
    setPaths([]);
    setCircles([]);
    setCurrentPath([]);
  };

  const handleSave = () => {
    // In a real implementation, we'd capture the view as an image
    // For now, pass back the original URI with annotation data
    onSave(imageUri);
  };

  const imageSize = SCREEN_WIDTH - 32;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('jobDetail.annotatePhoto')}</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
            <Text style={[styles.headerBtnText, { color: PRIMARY }]}>
              {t('jobDetail.saveAnnotation')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>{t('jobDetail.annotateHint')}</Text>

        {/* Tool selector */}
        <View style={styles.toolRow}>
          <TouchableOpacity
            style={[styles.toolBtn, tool === 'draw' && styles.toolBtnActive]}
            onPress={() => setTool('draw')}
          >
            <Text style={[styles.toolIcon, tool === 'draw' && { color: '#fff' }]}>✏️</Text>
            <Text style={[styles.toolLabel, tool === 'draw' && { color: '#fff' }]}>Draw</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toolBtn, tool === 'circle' && styles.toolBtnActive]}
            onPress={() => setTool('circle')}
          >
            <Text style={[styles.toolIcon, tool === 'circle' && { color: '#fff' }]}>⭕</Text>
            <Text style={[styles.toolLabel, tool === 'circle' && { color: '#fff' }]}>Circle</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
            <Text style={styles.clearBtnText}>{t('jobDetail.clearAnnotation')}</Text>
          </TouchableOpacity>
        </View>

        {/* Canvas */}
        <View style={[styles.canvas, { width: imageSize, height: imageSize }]} {...panResponder.panHandlers}>
          <Image
            source={{ uri: imageUri }}
            style={[styles.image, { width: imageSize, height: imageSize }]}
            resizeMode="contain"
          />
          <Svg
            style={StyleSheet.absoluteFill}
            width={imageSize}
            height={imageSize}
          >
            {/* Completed paths */}
            {paths.map((p, i) => (
              <Path
                key={`p-${i}`}
                d={pathToD(p.points)}
                stroke={DRAW_COLOR}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {/* Current drawing path */}
            {currentPath.length > 1 && (
              <Path
                d={pathToD(currentPath)}
                stroke={DRAW_COLOR}
                strokeWidth={3}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {/* Circles */}
            {circles.map((c, i) => (
              <Circle
                key={`c-${i}`}
                cx={c.cx}
                cy={c.cy}
                r={c.r}
                stroke={DRAW_COLOR}
                strokeWidth={3}
                fill="none"
              />
            ))}
          </Svg>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0C' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 56,
    backgroundColor: '#1C1C1E',
  },
  headerBtn: { padding: 8 },
  headerBtnText: { color: '#AEAEB2', fontSize: 15, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  hint: { color: '#8E8E93', fontSize: 13, textAlign: 'center', marginVertical: 8 },

  toolRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  toolBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    gap: 6,
    minHeight: 44,
  },
  toolBtnActive: { backgroundColor: DRAW_COLOR },
  toolIcon: { fontSize: 16 },
  toolLabel: { fontSize: 14, fontWeight: '600', color: '#AEAEB2' },
  clearBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#2C2C2E',
    minHeight: 44,
    justifyContent: 'center',
  },
  clearBtnText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600' },

  canvas: {
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  image: { borderRadius: 12 },
});
