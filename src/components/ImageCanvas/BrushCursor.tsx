import React from 'react';
import { BRUSH_CURSOR_COLORS, BRUSH_CURSOR_STYLES } from '@/utils/cursor/constants';

import type { AnnotationTool } from '@/types/annotations';

interface BrushCursorProps {
  /**
   * Current annotation tool
   */
  tool: AnnotationTool;
  /**
   * Brush size in pixels (radius)
   */
  size: number;
  /**
   * Whether cursor should be visible
   */
  visible: boolean;
  /**
   * Mouse X position in viewport coordinates
   */
  x: number;
  /**
   * Mouse Y position in viewport coordinates
   */
  y: number;
}

/**
 * Visual brush cursor overlay that follows the mouse.
 * Provides real-time visual feedback of brush radius.
 * 
 * Renders a circular outline cursor that tracks mouse position,
 * giving users clear visibility of their brush size before drawing.
 * Color changes based on tool: lime green for brush, cyan for modifier brush.
 * Only visible when brush tools are active and not in debug mode.
 * 
 * @param props - Configuration for cursor rendering
 */
const BrushCursor: React.FC<BrushCursorProps> = ({ 
  tool,
  size, 
  visible, 
  x, 
  y
}) => {
  if (!visible) return null;

  // Compute cursor color based on tool type
  const color = tool === 'modifier_brush' ? BRUSH_CURSOR_COLORS.MODIFIER : BRUSH_CURSOR_COLORS.PRIMARY;
  const diameter = size * 2;

  return (
    <div
      style={{
        position: 'fixed',
        left: `${x - size}px`,
        top: `${y - size}px`,
        width: `${diameter}px`,
        height: `${diameter}px`,
        border: `${BRUSH_CURSOR_STYLES.BORDER_WIDTH}px solid ${color}`,
        borderRadius: '50%',
        pointerEvents: 'none',
        zIndex: BRUSH_CURSOR_STYLES.Z_INDEX,
        boxShadow: BRUSH_CURSOR_STYLES.BOX_SHADOW,
        transition: 'none', // No transition for smooth tracking
      }}
    />
  );
};

export default BrushCursor;
