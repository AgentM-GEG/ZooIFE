import { useClassificationStore } from '../../stores/classificationStore';
import { SEGMENT_MODELS } from '../../services/sam2Service';
import type { AnnotationTool } from '../../types/annotations';
import { BrushProps } from '@/types/tools';

interface ToolPaletteProps {
  tool: AnnotationTool;
  onToolChange: (tool: AnnotationTool) => void;
  brushProps: BrushProps;
  onBrushSizeChange: (brushSize: number) => void;
  onPredModBrushModeChange: (brushMode: string) => void;
  modelId: string;
  onModelChange: (id: string) => void;
  showPoints: boolean;
  onShowPointsChange: (v: boolean) => void;
  onPredModBrushSizeChange: (brushSize: number) => void,
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
  brushProps,
  onBrushSizeChange,
  onPredModBrushModeChange,
  modelId,
  onModelChange,
  showPoints,
  onShowPointsChange,
  onPredModBrushSizeChange,
  coordinateFix,
  onCoordinateFixChange,
  debugCoords,
  onDebugCoordsChange,
}: ToolPaletteProps) {

  const annotations = useClassificationStore(s => s.annotations);
  const clearAnnotations = useClassificationStore(s => s.clearAnnotations);
  // const currentMaskUrl = useClassificationStore(s => s.currentMaskUrl);
  const maskHistory = useClassificationStore(s => s.maskHistory);
  const maskHistoryIndex = useClassificationStore(s => s.maskHistoryIndex);

  const hasAnnotations = annotations.length > 0;

  // console.log([maskHistoryIndex, maskHistory]);

  const undoMaskPossible = maskHistoryIndex >= 0;
  const redoMaskPossible = maskHistoryIndex < maskHistory.length - 1;

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={labelStyle}>Brush size</span>
      {(
        <input type="range" min="1" max="10" defaultValue="5" id="brush_size_slider" onChange={(event) => {
          onBrushSizeChange(parseFloat(event.target.value))
        }
        } />
      )}
      </div>
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
      {(
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",          // spacing between items
            alignItems: "flex-start", // optional: left-align contents
            marginTop: "12px"
          }}
        >
          <div><button
            onClick={() => onToolChange("modifier_brush")}
            style={{ ...btnStyle, ...(tool === "modifier_brush" ? btnActiveStyle : {}) }}
          >
            Modify prediction
          </button>
            {undoMaskPossible &&
              <button
                onClick={() => brushProps.predModBrushRef?.current?.undo()}
                style={btnStyle}
              >
                Undo
              </button>
            }
            {redoMaskPossible &&
              <button
                onClick={() => brushProps.predModBrushRef?.current?.redo()}
                style={btnStyle}
              >
                Redo
              </button>
            }
          </div>
          <label style={{ display: "flex", alignItems: "left", gap: "10px" }}>
            <span style={labelStyle}>
              Modifier mode:
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="1"
              value={brushProps.predModBrushMode === "subtract" ? 0 : 1}
              onChange={(e) =>
                onPredModBrushModeChange(e.target.value === "0" ? "subtract" : "add")
              }
              // onClick={() => onPredModBrushModeChange(brushProps.predModBrushMode === "subtract" ? "add" : "subtract")}
              style={predModBrushToggleStyle}
            />
            <span style={labelStyle}>
              {brushProps.predModBrushMode === "add" ? "Add" : "Subtract"}
            </span>

          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={labelStyle}>Modifier brush size</span>

          <input
            type="range"
            min="1"
            max="10"
            defaultValue="5"
            id="predmod_brush_size_slider"
            onChange={(event) =>
              onPredModBrushSizeChange(parseFloat(event.target.value))
            }
          />
          </div>
        </div>
      )}
      {/* <span style={{ ...labelStyle, marginTop: 12 }}>Coordinate fix</span>
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
      </label> */}
      <span style={{ ...labelStyle, marginTop: 4, fontSize: 11, lineHeight: '1.5' }}>
        Left-click: positive point (green)<br />
        Right-click: negative point (red)<br />
        Undo: Ctrl+Z / ⌘Z
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
  width: '100%'
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: '#888', marginBottom: 4 };
const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  border: '1px solid',
  borderColor: '#333',
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
const predModBrushToggleStyle: React.CSSProperties = {
  width: '40px',
  cursor: "pointer",
  background: `linear-gradient(
      to right,
      #5cb85c 0%,
      #5cb85c 50%,
      #d9534f 50%,
      #d9534f 100%
    )`,
  borderRadius: "6px",
  border: '1px solid white',
  height: "11px",
  appearance: "none",
};


