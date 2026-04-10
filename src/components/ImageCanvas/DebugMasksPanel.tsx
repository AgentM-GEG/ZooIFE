import styled from 'styled-components';
import { useState, useRef, useEffect } from 'react';
import { theme } from '@/theme/zooniverseTheme';
import { loggers } from '@/utils/logger';

/**
 * Panel for displaying candidate masks from SAM with their IoU scores.
 * Shows the zoomed debug image with point overlays and a toggleable mask overlay
 * for comparing different mask candidates.
 */

const PanelContainer = styled.div`
  background: ${theme.colors.background};
  border: 2px solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  padding: ${theme.spacing.md};
  margin-top: ${theme.spacing.md};
`;

const Title = styled.h3`
  margin: 0 0 ${theme.spacing.md} 0;
  font-size: ${theme.typography.size.base};
  font-weight: ${theme.typography.fontWeight.bold};
  color: ${theme.colors.text.primary};
`;

const ControlsRow = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  margin-bottom: ${theme.spacing.md};
  align-items: center;
  flex-wrap: wrap;
`;

const ControlLabel = styled.label`
  font-size: ${theme.typography.size.sm};
  color: ${theme.colors.text.secondary};
  font-weight: ${theme.typography.fontWeight.medium};
`;

const Select = styled.select`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${theme.colors.secondary};
  color: ${theme.colors.text.light};
  font-size: ${theme.typography.size.sm};
  cursor: pointer;

  &:hover {
    border-color: ${theme.colors.primary};
  }

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
  }
`;

const SliderContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};
`;

const Slider = styled.input`
  width: 150px;
`;

const OpacityValue = styled.span`
  font-size: ${theme.typography.size.xs};
  color: ${theme.colors.text.secondary};
  min-width: 40px;
`;

const CanvasContainer = styled.div`
  position: relative;
  display: block;
  margin-bottom: ${theme.spacing.md};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.base};
  background: ${theme.colors.secondary};
  overflow: auto;
  width: 100%;
  max-height: 700px;
`;

const Canvas = styled.canvas`
  display: block;
  width: 100%;
  height: auto;
  image-rendering: crisp-edges;
`;

const PointsSvg = styled.svg`
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
`;

const InfoBox = styled.div`
  background: ${theme.colors.secondary};
  border-radius: ${theme.borders.radius.base};
  padding: ${theme.spacing.sm};
  font-size: ${theme.typography.size.xs};
  color: ${theme.colors.text.secondary};
  line-height: 1.6;
`;

const InfoRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${theme.spacing.xs};

  &:last-child {
    margin-bottom: 0;
  }
`;

const Badge = styled.span<{ $color: string }>`
  display: inline-block;
  background: ${(props) => props.$color};
  color: white;
  padding: 2px 6px;
  border-radius: ${theme.borders.radius.base};
  font-size: ${theme.typography.size.xs};
  font-weight: ${theme.typography.fontWeight.bold};
  margin: 0 ${theme.spacing.xs};
`;

interface DebugMasksPanelProps {
  debugImageUrl: string | null;
  debugMasks: Array<{
    idx: number;
    iou: number;
    url: string;
    is_selected: boolean;
  }> | null;
  maskSelectionInfo: {
    selected_idx: number;
    selected_iou: number;
    all_iou_scores: number[];
    has_background_prompts: boolean;
  } | null;
  debugCrop: {
    crop_x0: number;
    crop_y0: number;
    crop_w: number;
    crop_h: number;
  } | null;
  debugPrompts: Array<{
    x: number;
    y: number;
    label: 0 | 1;
  }> | null;
}

export const DebugMasksPanel = ({
  debugImageUrl,
  debugMasks,
  maskSelectionInfo,
  debugCrop,
  debugPrompts,
}: DebugMasksPanelProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedMaskIdx, setSelectedMaskIdx] = useState<number | null>(null);
  const [maskOpacity, setMaskOpacity] = useState(0.5);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });

  // Initialize selected mask to SAM-selected one
  useEffect(() => {
    if (debugMasks && debugMasks.length > 0 && maskSelectionInfo) {
      // Default to SAM-selected mask
      setSelectedMaskIdx(maskSelectionInfo.selected_idx);
    }
  }, [debugMasks, maskSelectionInfo]);

  // Render canvas when image or mask changes
  useEffect(() => {
    if (!canvasRef.current || !debugImageUrl) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load and draw debug image
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      setCanvasDimensions({ width: img.width, height: img.height });
      ctx.drawImage(img, 0, 0);

      // Draw selected mask as overlay if available
      const shouldDrawMask = selectedMaskIdx !== null && typeof selectedMaskIdx === 'number' && debugMasks;
      if (shouldDrawMask) {
        const selectedMask = debugMasks.find((m) => m.idx === selectedMaskIdx);
        if (selectedMask) {
          const maskImg = new Image();
          maskImg.onload = () => {
            ctx.globalAlpha = maskOpacity;
            ctx.drawImage(maskImg, 0, 0);
            ctx.globalAlpha = 1.0;
          };
          maskImg.onerror = () => {
            loggers.debug('[DebugMasksPanel] Failed to load mask image');
          };
          maskImg.src = selectedMask.url;
        }
      }
    };
    img.src = debugImageUrl;
  }, [debugImageUrl, selectedMaskIdx, maskOpacity, debugMasks]);

  if (!debugImageUrl || !debugMasks || !maskSelectionInfo || !debugPrompts) {
    return null;
  }

  const positivePoints = debugPrompts.filter((p) => p.label === 1).length;
  const negativePoints = debugPrompts.filter((p) => p.label === 0).length;

  return (
    <PanelContainer>
      <Title>Debug: SAM Mask Analysis</Title>

      <ControlsRow>
        <div>
          <ControlLabel htmlFor="mask-selector">Overlay mask:</ControlLabel>&nbsp;
          <Select
            id="mask-selector"
            value={selectedMaskIdx !== null ? selectedMaskIdx : ''}
            onChange={(e) => setSelectedMaskIdx(e.target.value === '' ? null : parseInt(e.target.value))}
          >
            <option value="">None (image only)</option>
            {debugMasks.map((mask) => (
              <option key={mask.idx} value={mask.idx}>
                Mask {mask.idx} (IoU: {mask.iou.toFixed(3)})
                {mask.is_selected ? ' [SAM Selected]' : ''}
              </option>
            ))}
          </Select>
        </div>

        {selectedMaskIdx !== null && (
          <SliderContainer>
            <ControlLabel htmlFor="opacity-slider">Opacity:</ControlLabel>
            <Slider
              id="opacity-slider"
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={maskOpacity}
              onChange={(e) => setMaskOpacity(parseFloat(e.target.value))}
            />
            <OpacityValue>{Math.round(maskOpacity * 100)}%</OpacityValue>
          </SliderContainer>
        )}
      </ControlsRow>

      <CanvasContainer ref={containerRef}>
        <Canvas ref={canvasRef} />
        <PointsSvg 
          ref={svgRef}
          viewBox={`0 0 ${canvasDimensions.width} ${canvasDimensions.height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {debugPrompts && debugCrop && debugPrompts.map((p, idx) => {
            const croppedX = p.x - debugCrop.crop_x0;
            const croppedY = p.y - debugCrop.crop_y0;
            const isPositive = p.label === 1;
            const color = isPositive ? '#22c55e' : '#ef4444';
            const radius = Math.max(3, Math.min(canvasDimensions.width, canvasDimensions.height) / 40);
            const crossSize = radius + 5;

            // Skip points outside bounds
            if (croppedX < 0 || croppedY < 0 || croppedX > canvasDimensions.width || croppedY > canvasDimensions.height) {
              return null;
            }

            return (
              <g key={idx}>
                {/* Main filled circle */}
                <circle
                  cx={croppedX}
                  cy={croppedY}
                  r={radius}
                  fill={color}
                  fillOpacity={0.75}
                />
                {/* White outline */}
                <circle
                  cx={croppedX}
                  cy={croppedY}
                  r={radius}
                  fill="none"
                  stroke="white"
                  strokeWidth="0.5"
                />
                {/* Inner color outline */}
                <circle
                  cx={croppedX}
                  cy={croppedY}
                  r={radius - 1}
                  fill="none"
                  stroke={color}
                  strokeWidth="1"
                />
                {/* Crosshair */}
                <line
                  x1={croppedX - crossSize}
                  y1={croppedY}
                  x2={croppedX + crossSize}
                  y2={croppedY}
                  stroke="white"
                  strokeWidth="0.5"
                />
                <line
                  x1={croppedX}
                  y1={croppedY - crossSize}
                  x2={croppedX}
                  y2={croppedY + crossSize}
                  stroke="white"
                  strokeWidth="0.5"
                />
              </g>
            );
          })}
        </PointsSvg>
      </CanvasContainer>

      <InfoBox>
        <InfoRow>
          <span>
            Prompts:
            <Badge $color="#22c55e">{positivePoints} positive</Badge>
            <Badge $color="#ef4444">{negativePoints} negative</Badge>
          </span>
        </InfoRow>

        <InfoRow>
          <span>Crop region: {debugCrop?.crop_w}×{debugCrop?.crop_h}px</span>
        </InfoRow>

        {selectedMaskIdx !== null && (
          <InfoRow>
            <span>
              Selected mask:
              {selectedMaskIdx === maskSelectionInfo.selected_idx && <Badge $color="#4285f4">Alternative {selectedMaskIdx} (SAM Selected)</Badge>}
              {selectedMaskIdx !== maskSelectionInfo.selected_idx && <Badge $color="#42f4c2">Alternative {selectedMaskIdx}</Badge>}
            </span>
            <span>IoU: {debugMasks.find((m) => m.idx === selectedMaskIdx)?.iou.toFixed(3)}</span>
          </InfoRow>
        )}

        {maskSelectionInfo.has_background_prompts && (
          <InfoRow>
            <span style={{ color: '#ef9800', fontStyle: 'italic' }}>
              ⚠ Background prompts detected. Check if mask respects them.
            </span>
          </InfoRow>
        )}

        <InfoRow>
          <span>All IoU scores: {maskSelectionInfo.all_iou_scores.map((s) => s.toFixed(3)).join(', ')}</span>
        </InfoRow>
      </InfoBox>
    </PanelContainer>
  );
};
