import { useState, useCallback, useRef } from 'react';
import { Login } from './components/Login/Login';
import { ZooniverseImageLoader } from './components/ImageLoader/ZooniverseImageLoader';
import { ImageCanvas } from './components/ImageCanvas/ImageCanvas';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { TaskSidebar } from './components/TaskSidebar/TaskSidebar';
import { segmentWithPoints } from './services/sam2Service';
import { useClassificationStore } from './stores/classificationStore';
import type { AnnotationTool } from './types/annotations';
import { BrushEditableImageHandle } from "./components/ImageMask/BrushEditableImage";
import type { BrushProps } from './types/tools';

// TODO: Move to another file
function makeSvgCursorUri(size: number) : string {
  const prefix = "data:image/svg+xml";
  const viewBoxSize = 2*size + 25;
  const circleCentre = viewBoxSize/2
  const circle_svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBoxSize}" height="${viewBoxSize}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"><circle cx="${circleCentre}" cy="${circleCentre}" r="${2*size}" fill="none" stroke="purple" stroke-width="1"/></svg>`;
  const encoded_circle_svg = encodeURIComponent(circle_svg);
  const circle_uri = `url(${prefix},${encoded_circle_svg}) ${circleCentre} ${circleCentre}, auto`;
  return circle_uri;
}

function App() {
  const [tool, setTool] = useState<AnnotationTool>('point');
  const [brushUri, setBrushUri] = useState<string>(makeSvgCursorUri(5));
  const [brushSize, setBrushSize] = useState<number>(5);
  const [predModBrushSize, setPredModBrushSize] = useState<number>(5);
  const [predModBrushUri, setPredModBrushUri] = useState<string>(makeSvgCursorUri(5));
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

  const [brushMode, setBrushMode] = useState("add");

  const brushRef = useRef<BrushEditableImageHandle>(null);

  const brushProps : BrushProps = {
    brushSize:brushSize, 
    brushUri:brushUri, 
    predModBrushSize:predModBrushSize,
    predModBrushUri:predModBrushUri,
    predModBrushMode:brushMode,
    predModBrushRef:brushRef
  };

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <h1 style={titleStyle}>ZooIFE</h1>
        <p style={subtitleStyle}>Interactive Image Classification for Zooniverse</p>
        <ZooniverseImageLoader /> <Login />
      </header>
      <main style={mainStyle}>
        <aside style={leftAsideStyle}>
          <ToolPalette
            tool={tool}
            onToolChange={setTool}
            brushProps={brushProps} 
            onBrushSizeChange={(brushSize:number) => {setBrushSize(brushSize); setBrushUri(makeSvgCursorUri(brushSize))}}
            onPredModBrushModeChange={(predModBrushMode : string) => {setBrushMode(predModBrushMode)}}
            modelId={modelId}
            onModelChange={setModelId}
            showPoints={showPoints}
            onShowPointsChange={setShowPoints}
            onPredModBrushSizeChange={(brushSize:number) => {setPredModBrushSize(brushSize); setPredModBrushUri(makeSvgCursorUri(brushSize))}}
            coordinateFix={coordinateFix}
            onCoordinateFixChange={setCoordinateFix}
            debugCoords={debugCoords}
            onDebugCoordsChange={setDebugCoords}
          />
        </aside>
        <section style={canvasSectionStyle}>
          <ImageCanvas tool={tool} brushProps={brushProps} onPointClick={handlePointClick} onUndo={handleUndo} showPoints={showPoints} />
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
const leftAsideStyle: React.CSSProperties = { flexShrink: 0 , width: '15%'};
const canvasSectionStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'auto',
  maxHeight: 'calc(100vh - 120px)',
};
const rightAsideStyle: React.CSSProperties = { flexShrink: 0 };

export default App;
