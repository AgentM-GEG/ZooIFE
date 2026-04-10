import { useState, useCallback, useRef, useMemo } from 'react';
import { Login } from './components/Login/Login';
import { UserProfile } from './components/UserProfile/UserProfile';
import { ZooniverseImageLoader } from './components/ImageLoader/ZooniverseImageLoader';
import ImageCanvas from './components/ImageCanvas/ImageCanvas';
import { ToolPalette } from './components/ToolPalette/ToolPalette';
import { TaskSidebar } from './components/TaskSidebar/TaskSidebar';
import { segmentWithPoints } from './services/sam2Service';
import { useClassificationStore } from './stores/classificationStore';
import { compositeImageDataMasks } from '@/utils/image/maskCompositing';
import { getCompositeForHistoryIndex } from '@/utils/image/maskCompositing';
import { loggers } from '@/utils/logger';
import type { AnnotationTool, PointAnnotation } from './types/annotations';
import type { BrushEditableImageHandle } from '@/types/tools';
import type { HistoryEntry } from '@/stores/classificationStore';
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
 * Convert ImageData to data URI PNG.
 * Opposite of dataUriToImageData.
 * @param imageData - ImageData to convert
 * @returns PNG data URI string
 */
function imageDataToDataUri(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to get canvas context');
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

/**
 * Create a SAM history entry that stores both the raw prediction and the composited result.
 * The composited result = pre-SAM modifier strokes + SAM prediction (preserves user refinements).
 * 
 * @param rawSamImageData - Raw ImageData from SAM segmentation
 * @param annotationId - ID of the annotation being edited
 * @returns HistoryEntry with type 'sam' and samPredictionRaw set
 */
function createSamHistoryEntry(rawSamImageData: ImageData, annotationId: string): HistoryEntry {
  const state = useClassificationStore.getState();
  const maskState = state.perAnnotationMasks[annotationId];
  
  // Composite with existing mask to preserve any modifier strokes made before this SAM call
  let compositedImageData = rawSamImageData;
  if (maskState && maskState.history.length > 0 && maskState.historyIndex >= 0) {
    // Get the composite of everything up to current history point
    const currentComposite = getCompositeForHistoryIndex(maskState.history, maskState.historyIndex);
    if (currentComposite) {
      // Layer the new SAM prediction on top of the current composite
      compositedImageData = compositeImageDataMasks([currentComposite, rawSamImageData]) || rawSamImageData;
      loggers.app(`[createSamHistoryEntry] Composited new SAM with existing composite (historyIndex=${maskState.historyIndex})`);
    }
  }

  return {
    type: 'sam',
    imageData: compositedImageData,
    samPredictionRaw: rawSamImageData,
  };
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
    setDebugMasks,
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
    const currentAnnotationId = activeAnnotationId || '-1';
    const points = remaining
      .filter((a) => a.type === 'point' && ((a as PointAnnotation).annotationId || '-1') === currentAnnotationId)
      .map((a) => {
        const pa = a as PointAnnotation;
        return { x: pa.x, y: pa.y, label: pa.label };
      });

    if (points.length === 0) {
      setPerAnnotationMask(currentAnnotationId, null);
      setDebugImage(null);
      setDebugMasks(null, null);
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
        if (result.debug_masks && result.mask_selection) {
          const debugPrompts = points.map((p: any) => ({ x: p.x, y: p.y, label: p.label }));
          setDebugMasks(result.debug_masks, result.mask_selection, result.debug_crop || undefined, debugPrompts);
        }
        setPerAnnotationMask(currentAnnotationId, null);
      } else {
        setDebugImage(null);
        setDebugMasks(null, null);
        if (result.image?.url) {
          // Convert SAM mask to ImageData and add to history
          const maskUrl = result.image.url;
          dataUriToImageData(maskUrl).then((imageData) => {
            // Create SAM history entry with raw prediction
            const samEntry = createSamHistoryEntry(imageData, currentAnnotationId);
            pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);
            // Display the composited result (SAM + pre-SAM modifiers)
            const compositedMaskUrl = imageDataToDataUri(samEntry.imageData);
            setPerAnnotationMask(currentAnnotationId, compositedMaskUrl);
          }).catch((err) => {
            loggers.app('Failed to convert SAM mask to ImageData:', err);
            setPerAnnotationMask(currentAnnotationId, maskUrl);
          });
        }
      }
    } catch (err) {
      loggers.app('SAM2 not available:', err);
    }
  }, [imageUrl, undoLastAnnotation, setPerAnnotationMask, setDebugImage, setDebugMasks, imageDimensions, coordinateFix, debugCoords, modelId, activeAnnotationId, pushPerAnnotationMaskHistory]);

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
      const currentAnnotationId = activeAnnotationId || '-1';
      const points = [
        ...annotations
          .filter((a) => a.type === 'point' && ((a as PointAnnotation).annotationId || '-1') === currentAnnotationId)
          .map((a) => {
            const pa = a as PointAnnotation;
            return { x: pa.x, y: pa.y, label: pa.label };
          }),
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
        loggers.sam2('[handlePointClick] SAM response: %O', { debugMode: debugCoords, hasDebugUrl: !!result.debug_url, hasDebugMasks: !!result.debug_masks, maskSelection: result.mask_selection, debugMasksLength: result.debug_masks?.length });
        if (debugCoords) {
          if (result.debug_url) {
            setDebugImage(result.debug_url);
            if (result.debug_masks && result.mask_selection) {
              loggers.debug('[handlePointClick] Setting debug masks: %d masks', result.debug_masks.length);
              const debugPrompts = points.map((p: any) => ({ x: p.x, y: p.y, label: p.label }));
              setDebugMasks(result.debug_masks, result.mask_selection, result.debug_crop || undefined, debugPrompts);
            } else {
              loggers.debug('[handlePointClick] Debug masks missing: %O', { hasDebugMasks: !!result.debug_masks, hasMaskSelection: !!result.mask_selection });
            }
            setPerAnnotationMask(currentAnnotationId, null);
          } else {
            setDebugImage(null);
            setDebugMasks(null, null);
            loggers.debug('Debug requested but no debug_url in response: %O', result);
            if (result.image?.url) {
              // Convert SAM mask to ImageData and add to history
              const maskUrl = result.image.url;
              dataUriToImageData(maskUrl).then((imageData) => {
                // Create SAM history entry with raw prediction
                const samEntry = createSamHistoryEntry(imageData, currentAnnotationId);
                pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);
                // Display the composited result (SAM + pre-SAM modifiers)
                const compositedMaskUrl = imageDataToDataUri(samEntry.imageData);
                setPerAnnotationMask(currentAnnotationId, compositedMaskUrl);
              }).catch((err) => {
                loggers.app('Failed to convert SAM mask to ImageData: %O', err);
                setPerAnnotationMask(currentAnnotationId, maskUrl);
              });
            }
          }
        } else {
          setDebugImage(null);
          setDebugMasks(null, null);
          if (result.image?.url) {
            // Convert SAM mask to ImageData and add to history
            const maskUrl = result.image.url;
            dataUriToImageData(maskUrl).then((imageData) => {
              // Create SAM history entry with raw prediction
              const samEntry = createSamHistoryEntry(imageData, currentAnnotationId);
              pushPerAnnotationMaskHistory(currentAnnotationId, samEntry);
              // Display the composited result (SAM + pre-SAM modifiers)
              const compositedMaskUrl = imageDataToDataUri(samEntry.imageData);
              setPerAnnotationMask(currentAnnotationId, compositedMaskUrl);
            }).catch((err) => {
              loggers.app('Failed to convert SAM mask to ImageData:', err);
              setPerAnnotationMask(currentAnnotationId, maskUrl);
            });
          }
        }
      } catch (err) {
        loggers.app('SAM2 not available:', err);
      }
    },
    [imageUrl, annotations, setPerAnnotationMask, setDebugImage, setDebugMasks, imageDimensions, coordinateFix, debugCoords, modelId, activeAnnotationId, pushPerAnnotationMaskHistory]
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
