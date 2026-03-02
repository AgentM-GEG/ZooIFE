import { useClassificationStore } from '../../stores/classificationStore';
import type { AnnotationTool } from '../../types/annotations';

interface ToolPaletteProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
}

const tools: { id: AnnotationTool; label: string }[] = [
  { id: 'point', label: 'Point (SAM2)' },
  { id: 'freehand', label: 'Freehand' },
  { id: 'brush', label: 'Brush' },
];

export function ToolPalette({ tool, onToolChange }: ToolPaletteProps) {
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
      <span style={{ ...labelStyle, marginTop: 12, fontSize: 11 }}>
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
