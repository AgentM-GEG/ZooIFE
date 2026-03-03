import { useClassificationStore } from '../../stores/classificationStore';
import { SEGMENT_MODELS } from '../../services/sam2Service';
import type { AnnotationTool } from '../../types/annotations';

interface ToolPaletteProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  showPoints: boolean;
  onShowPointsChange: (v: boolean) => void;
  coordinateFix: 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY';
  onCoordinateFixChange: (fix: 'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY') => void;
  debugCoords: boolean;
  onDebugCoordsChange: (v: boolean) => void;
}

const tools: { id: AnnotationTool; label: string }[] = [
  { id: 'point', label: 'Point (SAM)' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'brush', label: 'Brush' },
];

export function ToolPalette({
  tool,
  onToolChange,
  modelId,
  onModelChange,
  showPoints,
  onShowPointsChange,
  coordinateFix,
  onCoordinateFixChange,
  debugCoords,
  onDebugCoordsChange,
}: ToolPaletteProps) {
  const { annotations, clearAnnotations } = useClassificationStore();
  const hasAnnotations = annotations.length > 0;

  return (
    <div className="tool-palette" style={style}>
      <span style={labelStyle}>Tools</span>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => onToolChange(t.id)}
          style={{
            ...btnStyle,
            ...(tool === t.id ? btnActiveStyle : {}),
          }}
        >
          {t.label}
        </button>
      ))}
      {hasAnnotations && (
        <button onClick={clearAnnotations} style={{ ...btnStyle, ...clearBtnStyle }}>
          Clear all
        </button>
      )}
      <span style={{ ...labelStyle, marginTop: 12 }}>Model</span>
      <select
        value={modelId}
        onChange={(e) => onModelChange(e.target.value)}
        style={selectStyle}
      >
        {SEGMENT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={showPoints}
          onChange={(e) => onShowPointsChange(e.target.checked)}
        />
        {' '}Show points
      </label>
      <span style={{ ...labelStyle, marginTop: 12 }}>Coordinate fix</span>
      <select
        value={coordinateFix}
        onChange={(e) => onCoordinateFixChange(e.target.value as typeof coordinateFix)}
        style={selectStyle}
      >
        <option value="none">None</option>
        <option value="flipX">Flip X</option>
        <option value="flipY">Flip Y</option>
        <option value="flipBoth">Flip both</option>
        <option value="swapXY">Swap X/Y</option>
      </select>
      <label style={labelStyle}>
        <input
          type="checkbox"
          checked={debugCoords}
          onChange={(e) => onDebugCoordsChange(e.target.checked)}
        />
        {' '}Debug coords
      </label>
      <span style={{ ...labelStyle, marginTop: 4, fontSize: 11 }}>
        Right-click point to remove
      </span>
    </div>
  );
}

const style: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: 12,
  background: '#1a1a2e',
  borderRadius: 8,
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#888', marginBottom: 4 };
const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid #333',
  borderRadius: 6,
  background: '#16213e',
  color: '#eee',
  cursor: 'pointer',
  textAlign: 'left',
};
const btnActiveStyle: React.CSSProperties = {
  background: '#0f3460',
  borderColor: '#e94560',
};
const clearBtnStyle: React.CSSProperties = {
  marginTop: 4,
  color: '#e94560',
  borderColor: '#e94560',
};
const selectStyle: React.CSSProperties = {
  padding: 6,
  borderRadius: 6,
  background: '#16213e',
  color: '#eee',
  border: '1px solid #333',
};
