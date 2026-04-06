import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
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

// Styled Components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  padding: ${theme.spacing.md};
  background: ${theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  width: 100%;
`;

const Label = styled.span`
  font-size: ${theme.typography.size.xs};
  color: ${theme.colors.text.secondary};
  margin-bottom: ${theme.spacing.xs};
  display: block;
  font-weight: ${theme.typography.fontWeight.medium};
`;

const Button = styled.button<{ $active?: boolean }>`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border: 1px solid ${(props) => props.$active ? theme.colors.primary : theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${(props) => props.$active ? theme.colors.primary : theme.colors.secondary};
  color: ${(props) => props.$active ? theme.colors.secondary : theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};
  text-align: left;
  width: 100%;

  &:hover:not(:disabled) {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
    border-color: ${theme.colors.primary};
  }

  &:active:not(:disabled) {
    transform: scale(0.95);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: ${theme.colors.secondary};
    color: ${theme.colors.neutral.dark};
    border-color: ${theme.colors.border};
  }
`;

const ClearButton = styled(Button)`
  color: ${theme.colors.error};
  border-color: ${theme.colors.error};
  background: ${theme.colors.secondary};
  margin-top: ${theme.spacing.xs};

  &:hover {
    background: ${theme.colors.error};
    color: ${theme.colors.text.inverse};
  }
`;

const Select = styled.select`
  padding: ${theme.spacing.xs} ${theme.spacing.md};
  border-radius: ${theme.borders.radius.base};
  background: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  border: 1px solid ${theme.colors.border};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  cursor: pointer;
  transition: all ${theme.transitions.base};

  &:hover {
    border-color: ${theme.colors.primary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}40;
  }
`;

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.md};
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.primary};
  cursor: pointer;

  input {
    cursor: pointer;
  }
`;

const FlexContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const RangeSlider = styled.input`
  cursor: pointer;
  flex: 1;
`;

const PredModContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  align-items: flex-start;
  margin-top: ${theme.spacing.md};
`;

const ModifierToggle = styled.input`
  width: 40px;
  cursor: pointer;
  background: linear-gradient(
    to right,
    ${theme.colors.success} 0%,
    ${theme.colors.success} 50%,
    ${theme.colors.error} 50%,
    ${theme.colors.error} 100%
  );
  border-radius: ${theme.borders.radius.base};
  border: 1px solid ${theme.colors.text.inverse};
  height: 11px;
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
`;

const HelpText = styled.span`
  font-size: 11px;
  line-height: 1.5;
  color: ${theme.colors.text.secondary};
  margin-top: ${theme.spacing.md};
  display: block;
  white-space: pre-line;
`;

const ButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  width: 100%;
`;

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

  const { annotations, clearAnnotations, maskHistory, maskHistoryIndex } =
    useClassificationStore(s => ({
      annotations: s.annotations,
      clearAnnotations: s.clearAnnotations,
      maskHistory: s.maskHistory,
      maskHistoryIndex: s.maskHistoryIndex,
    }));

  const hasAnnotations = annotations.length > 0;

  const undoMaskPossible = maskHistoryIndex >= 0;
  const redoMaskPossible = maskHistoryIndex < maskHistory.length - 1;

  return (
    <Container>
      <Label>Tools</Label>
      <ButtonGroup>
        {tools.map((t) => (
          <Button
            key={t.id}
            $active={tool === t.id}
            onClick={() => onToolChange(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </ButtonGroup>

      <FlexContainer>
        <Label style={{ margin: 0 }}>Brush size</Label>
        <RangeSlider
          type="range"
          min="1"
          max="10"
          defaultValue="5"
          id="brush_size_slider"
          onChange={(event) => {
            onBrushSizeChange(parseFloat(event.target.value))
          }}
        />
      </FlexContainer>

      {hasAnnotations && (
        <ClearButton onClick={clearAnnotations}>
          Clear all
        </ClearButton>
      )}

      <Label style={{ marginTop: theme.spacing.md }}>Model</Label>
      <Select
        value={modelId}
        onChange={(e) => onModelChange(e.target.value)}
      >
        {SEGMENT_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </Select>

      <CheckboxLabel>
        <input
          type="checkbox"
          checked={showPoints}
          onChange={(e) => onShowPointsChange(e.target.checked)}
        />
        Show points
      </CheckboxLabel>

      <PredModContainer>
        <ButtonGroup>
          <Button
            $active={tool === "modifier_brush"}
            onClick={() => onToolChange("modifier_brush")}
          >
            Modify prediction
          </Button>
          <Button
            disabled={!undoMaskPossible}
            onClick={() => brushProps.predModBrushRef?.current?.undo()}
          >
            Undo
          </Button>
          <Button
            disabled={!redoMaskPossible}
            onClick={() => brushProps.predModBrushRef?.current?.redo()}
          >
            Redo
          </Button>
        </ButtonGroup>

        <FlexContainer>
          <Label style={{ margin: 0 }}>Modifier mode:</Label>
          <ModifierToggle
            type="range"
            min="0"
            max="1"
            step="1"
            value={brushProps.predModBrushMode === "subtract" ? 0 : 1}
            onChange={(e) =>
              onPredModBrushModeChange(e.target.value === "0" ? "subtract" : "add")
            }
          />
          <Label style={{ margin: 0 }}>
            {brushProps.predModBrushMode === "add" ? "Add" : "Subtract"}
          </Label>
        </FlexContainer>

        <FlexContainer>
          <Label style={{ margin: 0 }}>Modifier brush size</Label>
          <RangeSlider
            type="range"
            min="1"
            max="10"
            defaultValue="5"
            id="predmod_brush_size_slider"
            onChange={(event) =>
              onPredModBrushSizeChange(parseFloat(event.target.value))
            }
          />
        </FlexContainer>
      </PredModContainer>

      <HelpText>
        Left-click: positive point (green){'\n'}
        Right-click: negative point (red){'\n'}
        Undo: Ctrl+Z / ⌘Z
      </HelpText>
    </Container>
  );
}
