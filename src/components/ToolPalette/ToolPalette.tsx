import { useClassificationStore } from '@/stores/classificationStore';
import { SEGMENT_MODELS } from '@/services/sam2Service';
import { theme } from '@/theme/zooniverseTheme';
import {
  Container,
  Label,
  Button,
  ClearButton,
  UndoButton,
  RedoButton,
  HiddenToolButton,
  HiddenBrushSizeContainer,
  Select,
  CheckboxLabel,
  FlexContainer,
  RangeSlider,
  PredModContainer,
  ModifierToggle,
  HelpText,
  ButtonGroup,
} from './styled';
import { TOOLS } from './constants';
import type { ToolPaletteProps } from './types';

/**
 * Tool palette component for selecting annotation tools and configuring settings.
 * Includes tools (point, freehand, brush), brush size, SAM model selection,
 * and debug/coordinate fix options.
 * @param props - ToolPaletteProps configuration
 */
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

  const { annotations, activeAnnotationId, clearSamPoints } =
    useClassificationStore(s => ({
      annotations: s.annotations,
      activeAnnotationId: s.activeAnnotationId,
      clearSamPoints: s.clearSamPoints,
    }));

  const hasAnnotations = annotations.length > 0;

  return (
    <Container>
      <Label>Tools</Label>
      <ButtonGroup>
        {TOOLS.map((t) => {
          const ToolButtonComponent = (t.id === 'freehand' || t.id === 'brush') ? HiddenToolButton : Button;
          return (
            <ToolButtonComponent
              key={t.id}
              $active={tool === t.id}
              onClick={() => onToolChange(t.id)}
            >
              {t.label}
            </ToolButtonComponent>
          );
        })}
      </ButtonGroup>

      <HiddenBrushSizeContainer>
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
      </HiddenBrushSizeContainer>

      {hasAnnotations && (
        <ClearButton onClick={() => clearSamPoints(activeAnnotationId ?? '-1')}>
          Clear SAM points
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
        Show SAM points
      </CheckboxLabel>

      {/* VITE_SHOW_DEBUG_UI shows/hides the Debug Options section for development tools */}
      {(import.meta.env.VITE_SHOW_DEBUG_UI === 'true' || import.meta.env.VITE_SHOW_DEBUG_UI === '1') && (
        <>
          <Label style={{ marginTop: theme.spacing.md }}>Debug Options</Label>
          <CheckboxLabel>
            <input
              type="checkbox"
              checked={debugCoords}
              onChange={(e) => onDebugCoordsChange(e.target.checked)}
            />
            Debug SAM masks &amp; coordinates
          </CheckboxLabel>

          <Label style={{ marginTop: theme.spacing.sm }}>Coordinate Fix</Label>
          <Select
            value={coordinateFix}
            onChange={(e) => onCoordinateFixChange(e.target.value as any)}
          >
            <option value="none">None</option>
            <option value="flipX">Flip horizontally</option>
            <option value="flipY">Flip vertically</option>
            <option value="flipBoth">Flip both axes</option>
            <option value="swapXY">Swap X/Y</option>
          </Select>
        </>
      )}

      <PredModContainer>
        <ButtonGroup>
          <Button
            $active={tool === "modifier_brush"}
            onClick={() => onToolChange(tool === "modifier_brush" ? "point" : "modifier_brush")}
          >
            Modify prediction
          </Button>
          <UndoButton
            disabled={true}
            onClick={() => brushProps.predModBrushRef?.current?.undo()}
          >
            Undo
          </UndoButton>
          <RedoButton
            disabled={true}
            onClick={() => brushProps.predModBrushRef?.current?.redo()}
          >
            Redo
          </RedoButton>
        </ButtonGroup>

        <FlexContainer>
          <Label style={{ margin: 0 }}>Modifier mode:</Label>
          <ModifierToggle
            type="range"
            min="0"
            max="1"
            step="1"
            $mode={brushProps.predModBrushMode as "add" | "subtract"}
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
