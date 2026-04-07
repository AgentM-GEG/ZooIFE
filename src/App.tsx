import { useState, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { theme } from './theme/zooniverseTheme';
import { Login } from './components/Login/Login';
import { UserProfile } from './components/UserProfile/UserProfile';
import { ZooniverseImageLoader } from './components/ImageLoader/ZooniverseImageLoader';
import { ImageCanvas } from './components/ImageCanvas/ImageCanvas';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { TaskSidebar } from './components/TaskSidebar/TaskSidebar';
import { segmentWithPoints } from './services/sam2Service';
import { useClassificationStore } from './stores/classificationStore';
import type { AnnotationTool } from './types/annotations';
import { BrushEditableImageHandle } from "./components/ImageMask/BrushEditableImage";

// Styled components
const AppContainer = styled.div`
  min-height: 100vh;
  background-color: ${theme.colors.background.default};
  color: ${theme.colors.text.primary};
  font-family: ${theme.typography.fontFamily};
  display: flex;
  flex-direction: column;
`;

const Header = styled.header`
  padding: ${theme.spacing.lg};
  border-bottom: ${theme.borders.width.thin} solid ${theme.colors.border};
  background-color: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

const HeaderLeft = styled.div`
  flex: 1;
`;

const HeaderTitle = styled.h1`
  margin: 0;
  font-size: ${theme.typography.heading.h2.fontSize};
  font-weight: ${theme.typography.fontWeight.medium};
`;

const HeaderSubtitle = styled.p`
  margin: ${theme.spacing.xs} 0 ${theme.spacing.md};
  color: ${theme.colors.neutral.light};
  font-size: ${theme.typography.size.sm};
`;

const HeaderContent = styled.div`
  display: flex;
  gap: ${theme.spacing.md};
  align-items: center;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
`;

const Main = styled.main`
  display: flex;
  gap: ${theme.spacing.xl};
  padding: ${theme.spacing.xl};
  align-items: flex-start;
  flex: 1;
  overflow: hidden;
`;

const LeftAside = styled.aside`
  flex-shrink: 0;
  width: 15%;
  min-width: 280px;
`;

const CanvasSection = styled.section`
  flex: 1;
  min-width: 0;
  overflow: auto;
  max-height: calc(100vh - 120px);
  background-color: ${theme.colors.background.surface};
  border-radius: ${theme.borders.radius.lg};
  box-shadow: ${theme.shadows.sm};
`;

const RightAside = styled.aside`
  flex-shrink: 0;
  width: 320px;
`;

// TODO: Move to another file
/**
 * Create an SVG data URI for a circular brush cursor.
 * @param size - Brush size in pixels
 * @returns CSS cursor URL string for use in cursor property
 */
function makeSvgCursorUri(size: number) : string {
  const prefix = "data:image/svg+xml";
  const viewBoxSize = 2*size + 25;
  const circleCentre = viewBoxSize/2
  const circle_svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${viewBoxSize}" height="${viewBoxSize}" viewBox="0 0 ${viewBoxSize} ${viewBoxSize}"><circle cx="${circleCentre}" cy="${circleCentre}" r="${2*size}" fill="none" stroke="purple" stroke-width="1"/></svg>`;
  const encoded_circle_svg = encodeURIComponent(circle_svg);
  const circle_uri = `url(${prefix},${encoded_circle_svg}) ${circleCentre} ${circleCentre}, auto`;
  return circle_uri;
}

/**
 * Main app component for Zooniverse image classification interface.
 * Integrates image loading, canvas annotation tools, task sidebar, and SAM2 model.
 */
function App() {
  const [tool, setTool] = useState<AnnotationTool>('point');
  const [brushUri, setBrushUri] = useState<string>(makeSvgCursorUri(5));
  const [brushSize, setBrushSize] = useState<number>(5);
  const [predModBrushSize, setPredModBrushSize] = useState<number>(5);
  const [predModBrushUri, setPredModBrushUri] = useState<string>(makeSvgCursorUri(5));
  const [modelId, setModelId] = useState('sam1-vit_b');
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

  const brushProps = useMemo(() => ({
    brushSize,
    brushUri,
    predModBrushSize,
    predModBrushUri,
    predModBrushMode: brushMode,
    predModBrushRef: brushRef,
  }), [brushSize, brushUri, predModBrushSize, predModBrushUri, brushMode]);

  const handleBrushSizeChange = useCallback((newBrushSize: number) => {
    setBrushSize(newBrushSize);
    setBrushUri(makeSvgCursorUri(newBrushSize));
  }, []);

  const handlePredModBrushModeChange = useCallback((predModBrushMode: string) => {
    setBrushMode(predModBrushMode);
  }, []);

  const handlePredModBrushSizeChange = useCallback((newBrushSize: number) => {
    setPredModBrushSize(newBrushSize);
    setPredModBrushUri(makeSvgCursorUri(newBrushSize));
  }, []);

  return (
    <AppContainer>
      <Header>
        <HeaderLeft>
          <HeaderTitle>ZooIFE</HeaderTitle>
          <HeaderSubtitle>Interactive Image Classification for Zooniverse</HeaderSubtitle>
          <HeaderContent>
            <Login />
            <ZooniverseImageLoader />
          </HeaderContent>
        </HeaderLeft>
        <HeaderRight>
          <UserProfile />
        </HeaderRight>
      </Header>
      <Main>
        <LeftAside>
          <ToolPalette
            tool={tool}
            onToolChange={setTool}
            brushProps={brushProps}
            onBrushSizeChange={handleBrushSizeChange}
            onPredModBrushModeChange={handlePredModBrushModeChange}
            modelId={modelId}
            onModelChange={setModelId}
            showPoints={showPoints}
            onShowPointsChange={setShowPoints}
            onPredModBrushSizeChange={handlePredModBrushSizeChange}
            coordinateFix={coordinateFix}
            onCoordinateFixChange={setCoordinateFix}
            debugCoords={debugCoords}
            onDebugCoordsChange={setDebugCoords}
          />
        </LeftAside>
        <CanvasSection>
          <ImageCanvas tool={tool} brushProps={brushProps} onPointClick={handlePointClick} onUndo={handleUndo} showPoints={showPoints} />
        </CanvasSection>
        <RightAside>
          <TaskSidebar />
        </RightAside>
      </Main>
    </AppContainer>
  );
}

export default App;
