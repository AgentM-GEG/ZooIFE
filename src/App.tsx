import { useState, useCallback, useRef, useMemo } from 'react';
import { Login } from './components/Login/Login';
import { UserProfile } from './components/UserProfile/UserProfile';
import { ZooniverseImageLoader } from './components/ImageLoader/ZooniverseImageLoader';
import ImageCanvas from './components/ImageCanvas/ImageCanvas';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { TaskSidebar } from './components/TaskSidebar/TaskSidebar';
import { segmentWithPoints } from './services/sam2Service';
import { useClassificationStore } from './stores/classificationStore';
import type { AnnotationTool } from './types/annotations';
import type { BrushEditableImageHandle } from '@/types/tools';
import {
  AppContainer,
  AppHeader,
  HeaderLeft,
  HeaderTitle,
  HeaderSubtitle,
  HeaderContent,
  HeaderRight,
  AppMain,
  AppLeftAside,
  CanvasSection,
  AppRightAside,
} from './theme/styles';

/**
 * Convert a data URI image to ImageData for storage in mask history.
 * 
 * Used when SAM returns a segmentation mask as a PNG data URI.
 * Converts it to ImageData so it can be stored in the per-annotation mask history
 * and treated as a single undo/redo entry.
 * 
 * @param dataUri - Data URI string (e.g., "data:image/png;base64,...")
 * @returns Promise resolving to ImageData
 */
function dataUriToImageData(dataUri: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = () => reject(new Error('Failed to load image from data URI'));
    img.src = dataUri;
  });
}

/**
 * Main app component for Zooniverse image classification interface.
 * Integrates image loading, canvas annotation tools, task sidebar, and SAM2 model.
 */
function App() {
  const [tool, setTool] = useState<AnnotationTool>('point');
  const [brushSize, setBrushSize] = useState<number>(5);
  const [predModBrushSize, setPredModBrushSize] = useState<number>(5);
  const [modelId, setModelId] = useState('sam1-vit_b');
  const [coordinateFix, setCoordinateFix] = useState<
    'none' | 'flipX' | 'flipY' | 'flipBoth' | 'swapXY'
  >('none');
  const [debugCoords, setDebugCoords] = useState(false);
  const [showPoints, setShowPoints] = useState(true);
  const {
    imageUrl,
    annotations,
    undoLastAnnotation,
    setDebugImage,
    setPerAnnotationMask,
    pushPerAnnotationMaskHistory,
    imageDimensions,
    activeAnnotationId,
  } = useClassificationStore();

  /**
   * Handle undo of point annotations.
   * When a point is undone, re-run SAM with remaining points to update mask.
   * 
   * This allows users to undo individual point clicks and see the mask update
   * accordingly. The SAM mask stored in history is replaced with the new result.
   * 
   * Note: The mask history (SAM results + brush strokes) is separate from the
   * annotation history (point clicks). Undoing a point updates the mask but
   * doesn't undo mask refinements (those use mask undo/redo buttons).
   */
  const handleUndo = useCallback(async () => {
    const removed = undoLastAnnotation();
    if (!removed) return;
    const remaining = useClassificationStore.getState().annotations;
    const points = remaining
      .filter((a) => a.type === 'point')
      .map((a) => ({ x: a.x, y: a.y, label: (a as { label: 0 | 1 }).label }));

    const currentAnnotationId = activeAnnotationId || '-1';

    if (points.length === 0) {
      setPerAnnotationMask(currentAnnotationId, null);
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
        setPerAnnotationMask(currentAnnotationId, null);
      } else {
        setDebugImage(null);
        if (result.image?.url) {
          // Convert SAM mask to ImageData and add to history
          const maskUrl = result.image.url;
          dataUriToImageData(maskUrl).then((imageData) => {
            pushPerAnnotationMaskHistory(currentAnnotationId, imageData);
            setPerAnnotationMask(currentAnnotationId, maskUrl);
          }).catch((err) => {
            console.warn('Failed to convert SAM mask to ImageData:', err);
            setPerAnnotationMask(currentAnnotationId, maskUrl);
          });
        }
      }
    } catch (err) {
      console.warn('SAM2 not available:', err);
    }
  }, [imageUrl, undoLastAnnotation, setPerAnnotationMask, setDebugImage, imageDimensions, coordinateFix, debugCoords, modelId, activeAnnotationId, pushPerAnnotationMaskHistory]);

  /**
   * Handle point click for SAM segmentation.
   * Calls SAM with accumulated point prompts and stores resulting mask in history.
   * 
   * Flow:
   * 1. Collect all existing points + new click
   * 2. Call SAM server with point coordinates
   * 3. Convert returned PNG data URI to ImageData
   * 4. Push ImageData to per-annotation mask history as single entry
   * 5. Display mask to canvas
   * 
   * Each SAM result counts as one undo/redo entry, even though SAM internally
   * runs multiple iterations to generate the mask.
   */
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

      const currentAnnotationId = activeAnnotationId || '-1';

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
            setPerAnnotationMask(currentAnnotationId, null);
          } else {
            setDebugImage(null);
            console.warn('Debug requested but no debug_url in response:', result);
            if (result.image?.url) {
              // Convert SAM mask to ImageData and add to history
              const maskUrl = result.image.url;
              dataUriToImageData(maskUrl).then((imageData) => {
                pushPerAnnotationMaskHistory(currentAnnotationId, imageData);
                setPerAnnotationMask(currentAnnotationId, maskUrl);
              }).catch((err) => {
                console.warn('Failed to convert SAM mask to ImageData:', err);
                setPerAnnotationMask(currentAnnotationId, maskUrl);
              });
            }
          }
        } else {
          setDebugImage(null);
          if (result.image?.url) {
            // Convert SAM mask to ImageData and add to history
            const maskUrl = result.image.url;
            dataUriToImageData(maskUrl).then((imageData) => {
              pushPerAnnotationMaskHistory(currentAnnotationId, imageData);
              setPerAnnotationMask(currentAnnotationId, maskUrl);
            }).catch((err) => {
              console.warn('Failed to convert SAM mask to ImageData:', err);
              setPerAnnotationMask(currentAnnotationId, maskUrl);
            });
          }
        }
      } catch (err) {
        console.warn('SAM2 not available:', err);
      }
    },
    [imageUrl, annotations, setPerAnnotationMask, setDebugImage, imageDimensions, coordinateFix, debugCoords, modelId, activeAnnotationId, pushPerAnnotationMaskHistory]
  );

  const [brushMode, setBrushMode] = useState("add");

  const brushRef = useRef<BrushEditableImageHandle>(null);

  const brushProps = useMemo(() => ({
    brushSize,
    predModBrushSize,
    predModBrushMode: brushMode,
    predModBrushRef: brushRef,
  }), [brushSize, predModBrushSize, brushMode]);

  const handleBrushSizeChange = useCallback((newBrushSize: number) => {
    setBrushSize(newBrushSize);
  }, []);

  const handlePredModBrushModeChange = useCallback((predModBrushMode: string) => {
    setBrushMode(predModBrushMode);
  }, []);

  const handlePredModBrushSizeChange = useCallback((newBrushSize: number) => {
    setPredModBrushSize(newBrushSize);
  }, []);

  return (
    <AppContainer>
      <AppHeader>
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
      </AppHeader>
      <AppMain>
        <AppLeftAside>
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
        </AppLeftAside>
        <CanvasSection>
          <ImageCanvas tool={tool} brushProps={brushProps} onPointClick={handlePointClick} onUndo={handleUndo} showPoints={showPoints} />
        </CanvasSection>
        <AppRightAside>
          <TaskSidebar />
        </AppRightAside>
      </AppMain>
    </AppContainer>
  );
}

export default App;
