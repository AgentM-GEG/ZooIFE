import { useState, useCallback } from 'react';
import { ImageLoader } from './components/ImageLoader/ImageLoader';
import { ImageCanvas } from './components/ImageCanvas/ImageCanvas';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { TaskSidebar } from './components/TaskSidebar/TaskSidebar';
import { segmentWithPoints } from './services/sam2Service';
import { useClassificationStore } from './stores/classificationStore';
import type { AnnotationTool } from './types/annotations';

function App() {
  const [tool, setTool] = useState<AnnotationTool>('point');
  const [modelId, setModelId] = useState('sam2-hiera-large');
  const [coordinateFix, setCoordinateFix] = useState<
    'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY'
  >('none');
  const [debugCoords, setDebugCoords] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const { imageUrl, annotations, undoLastAnnotation, setMask, setDebugImage, imageDimensions } =
    useClassificationStore();

  const handleUndo = useCallback(async () => {
    const removed = undoLastAnnotation();
    if (!removed) return;
    const remaining = useClassificationStore.getState().annotations;
    const points = remaining
      .filter((a) => a.type === 'point')
      .map((a) => ({ x: a.x, y: a.y, label: (a as { label: 0 | 1 }).label }));

    if (points.length === 0) {
      setMask(null);
      setDebugImage(null);
      return;
    }
    if (!imageUrl) return;
    try {
      const result = await segmentWithPoints(imageUrl, points, '', {
        debug: debugCoords,
        imageSize: imageDimensions ?? undefined,
        coordinateFix,
        modelId,
      });
      if (debugCoords && result.debug_url) {
        setDebugImage(result.debug_url);
        setMask(null);
      } else {
        setDebugImage(null);
        if (result.image?.url) setMask(result.image.url);
      }
    } catch (err) {
      console.warn('SAM2 not available:', err);
    }
  }, [imageUrl, undoLastAnnotation, setMask, setDebugImage, imageDimensions, coordinateFix, debugCoords, modelId]);

  const handlePointClick = useCallback(
    async (x: number, y: number, label: 0 | 1) => {
      if (!imageUrl) return;
      const points = [
        ...annotations
          .filter((a) => a.type === 'point')
          .map((a) => ({ x: a.x, y: a.y, label: (a as { label: 0 | 1 }).label })),
        { x, y, label },
      ];
      if (points.length === 0) return;
      try {
        const result = await segmentWithPoints(imageUrl, points, '', {
          debug: debugCoords,
          imageSize: imageDimensions ?? undefined,
          coordinateFix,
          modelId,
        });
        if (debugCoords) {
          if (result.debug_url) {
            setDebugImage(result.debug_url);
            setMask(null);
          } else {
            setDebugImage(null);
            console.warn('Debug requested but no debug_url in response:', result);
            if (result.image?.url) setMask(result.image.url);
          }
        } else {
          setDebugImage(null);
          if (result.image?.url) setMask(result.image.url);
        }
      } catch (err) {
        console.warn('SAM2 not available:', err);
      }
    },
    [imageUrl, annotations, setMask, setDebugImage, imageDimensions, coordinateFix, debugCoords, modelId]
  );

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>ZooIFE</h1>
        <p style={subtitleStyle}>Interactive Image Classification for Zooniverse</p>
        <ImageLoader />
      </header>
      <main style={mainStyle}>
        <aside style={leftAsideStyle}>
          <ToolPalette
            tool={tool}
            onToolChange={setTool}
            modelId={modelId}
            onModelChange={setModelId}
            showPoints={showPoints}
            onShowPointsChange={setShowPoints}
            coordinateFix={coordinateFix}
            onCoordinateFixChange={setCoordinateFix}
            debugCoords={debugCoords}
            onDebugCoordsChange={setDebugCoords}
          />
        </aside>
        <section style={canvasSectionStyle}>
          <ImageCanvas tool={tool} onPointClick={handlePointClick} onUndo={handleUndo} showPoints={showPoints} />
        </section>
        <aside style={rightAsideStyle}>
          <TaskSidebar />
        </aside>
      </main>
    </div>
  );
}

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f0f23',
  color: '#eee',
  fontFamily: 'system-ui, sans-serif',
};
const headerStyle: React.CSSProperties = {
  padding: '20px 24px',
  borderBottom: '1px solid #1a1a2e',
};
const titleStyle: React.CSSProperties = { margin: 0, fontSize: 24 };
const subtitleStyle: React.CSSProperties = { margin: '4px 0 16px', color: '#888', fontSize: 14 };
const mainStyle: React.CSSProperties = {
  display: 'flex',
  gap: 24,
  padding: 24,
  alignItems: 'flex-start',
};
const leftAsideStyle: React.CSSProperties = { flexShrink: 0 };
const canvasSectionStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};
const rightAsideStyle: React.CSSProperties = { flexShrink: 0 };

export default App;
