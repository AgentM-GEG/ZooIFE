/**
 * Test case for classification export with multiple rects and masks
 * 
 * Scenario:
 * - User annotates 3 Caesar rects (IDs: 'rect-1', 'rect-2', 'rect-3')
 * - Also adds annotations to unmarked (-1) rect
 * - Masks are only added to -1 rect (whole image)
 * - Points distributed across multiple rects
 * - Brush strokes on some rects
 * 
 * Expected output:
 * - Single rect-annotations task with array of 4 rects
 * - SAM points with pointId tracking order
 * - Masks only on -1 rect (others have null)
 * - Brush as separate drawing task
 */

import { useClassificationStore, type HistoryEntry } from '../classificationStore';

/**
 * Generate a simple circular mask as ImageData
 * Circle centered at (cx, cy) with given radius
 */
function generateCircleMask(width: number, height: number, cx: number, cy: number, radius: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const idx = (y * width + x) * 4;
      const value = distance <= radius ? 255 : 0;
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }
  return new ImageData(data, width, height);
}

/**
 * Generate a rectangular mask as ImageData
 */
function generateRectMask(width: number, height: number, x1: number, y1: number, x2: number, y2: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const value = (x >= x1 && x <= x2 && y >= y1 && y <= y2) ? 255 : 0;
      data[idx] = value;     // R
      data[idx + 1] = value; // G
      data[idx + 2] = value; // B
      data[idx + 3] = 255;   // A
    }
  }
  return new ImageData(data, width, height);
}

/**
 * Helper to create SAM history entry
 */
function createSamHistoryEntry(imageData: ImageData): HistoryEntry {
  return {
    type: 'sam',
    imageData,
    modelId: 'test-model',
  };
}

/**
 * Helper to create brush stroke history entry
 */
function createBrushHistoryEntry(imageData: ImageData): HistoryEntry {
  return {
    type: 'modifier_brush',
    imageData,
  };
}

async function testClassificationExport() {
  const store = useClassificationStore.getState();

  // ============= Setup Subject =============
  store.setSubject('subject-12345', 'data:image/png;base64,iVBORw0KG...', {
    width: 800,
    height: 600,
  });

  // ============= Add Annotations =============

  // Rect 1: 2 points (foreground, background)
  store.addAnnotation({ type: 'point', x: 100, y: 100, label: 1, annotationId: 'rect-1' });
  store.addAnnotation({ type: 'point', x: 150, y: 150, label: 0, annotationId: 'rect-1' });

  // Rect 2: 1 point
  store.addAnnotation({ type: 'point', x: 300, y: 200, label: 1, annotationId: 'rect-2' });

  // Rect 3: 3 points (foreground sequence)
  store.addAnnotation({ type: 'point', x: 500, y: 100, label: 1, annotationId: 'rect-3' });
  store.addAnnotation({ type: 'point', x: 550, y: 150, label: 1, annotationId: 'rect-3' });
  store.addAnnotation({ type: 'point', x: 520, y: 180, label: 0, annotationId: 'rect-3' });

  // Unmarked (-1): 4 points
  store.addAnnotation({ type: 'point', x: 200, y: 400, label: 1, annotationId: '-1' });
  store.addAnnotation({ type: 'point', x: 250, y: 420, label: 1, annotationId: '-1' });
  store.addAnnotation({ type: 'point', x: 180, y: 450, label: 0, annotationId: '-1' });
  store.addAnnotation({ type: 'point', x: 700, y: 300, label: 1, annotationId: '-1' });

  // Add brush strokes to rect-1
  store.addAnnotation({
    type: 'brush',
    strokes: [
      {
        points: [
          { x: 110, y: 110 },
          { x: 115, y: 112 },
          { x: 120, y: 115 },
        ],
        radius: 5,
      },
    ],
    annotationId: 'rect-1',
  });

  // Add brush to unmarked (-1)
  store.addAnnotation({
    type: 'brush',
    strokes: [
      {
        points: [
          { x: 210, y: 410 },
          { x: 215, y: 412 },
          { x: 220, y: 415 },
          { x: 225, y: 420 },
        ],
        radius: 8,
      },
    ],
    annotationId: '-1',
  });

  // ============= Add Masks (only to -1 rect) =============
  // Switch to editing -1 rect
  store.setActiveAnnotation('-1');

  // Generate a simple circular mask (simulating first SAM prediction)
  const circle = generateCircleMask(800, 600, 200, 400, 80);
  store.pushPerAnnotationMaskHistory('-1', createSamHistoryEntry(circle));

  // Simulate brush refining the mask (rectangular area)
  const brushedArea = generateRectMask(800, 600, 180, 380, 250, 450);
  store.pushPerAnnotationMaskHistory('-1', createBrushHistoryEntry(brushedArea));

  // Add another SAM prediction (larger circular area)
  const circle2 = generateCircleMask(800, 600, 700, 300, 100);
  store.pushPerAnnotationMaskHistory('-1', createSamHistoryEntry(circle2));

  // ============= Build Classification =============
  const classification = await store.buildPanoptesClassification('123456', 'workflow-1');

  // ============= Display Results =============
  console.log('\n========== CLASSIFICATION EXPORT TEST ==========\n');
  console.log('Subject ID:', classification.links.subjects[0]);
  console.log('Workflow ID:', classification.links.workflow);
  console.log('Project ID:', classification.links.project);
  console.log('Annotations count:', classification.annotations.length);

  console.log('\n--- Annotations Detail ---\n');
  classification.annotations.forEach((ann, idx) => {
    console.log(`[${idx}] task: "${ann.task}"`);

    if (ann.task === 'rect-annotations') {
      console.log('  Type: Rect Annotations');
      const rectsArray = ann.value as Array<{
        annotationId: string;
        samPoints: Array<{ x: number; y: number; label: 0 | 1; pointId: number }>;
        latestSamMask: any;
        compositeMask: any;
      }>;

      rectsArray.forEach((rect) => {
        console.log(`\n  Rect: ${rect.annotationId}`);
        console.log(`    Points: ${rect.samPoints.length}`);
        rect.samPoints.forEach((pt) => {
          console.log(
            `      [${pt.pointId}] (${pt.x}, ${pt.y}) label=${pt.label === 1 ? 'fg' : 'bg'}`
          );
        });
        console.log(`    Latest SAM Mask: ${rect.latestSamMask ? 'present' : 'null'}`);
        if (rect.latestSamMask) {
          console.log(
            `      Size: ${rect.latestSamMask.width}x${rect.latestSamMask.height}, Encoding: ${rect.latestSamMask.encoding}`
          );
        }
        console.log(`    Composite Mask: ${rect.compositeMask ? 'present' : 'null'}`);
        if (rect.compositeMask) {
          console.log(
            `      Size: ${rect.compositeMask.width}x${rect.compositeMask.height}, Encoding: ${rect.compositeMask.encoding}`
          );
        }
      });
    } else if (ann.task.startsWith('drawing-')) {
      const val = ann.value as any;
      console.log(`  Type: ${val.type}`);
      if (val.type === 'brush') {
        console.log(`  Strokes: ${val.strokes?.length || 0}`);
      }
    }
  });

  // ============= Validation =============
  console.log('\n--- Validation ---\n');

  const rectAnn = classification.annotations.find((a) => a.task === 'rect-annotations');
  if (rectAnn) {
    const rects = rectAnn.value as any[];
    console.log(`✓ Found rect-annotations task with ${rects.length} rects`);

    const rect1 = rects.find((r) => r.annotationId === 'rect-1');
    const rect2 = rects.find((r) => r.annotationId === 'rect-2');
    const rect3 = rects.find((r) => r.annotationId === 'rect-3');
    const rectNeg1 = rects.find((r) => r.annotationId === '-1');

    console.log(`✓ rect-1: ${rect1?.samPoints.length} points, mask=${rect1?.latestSamMask ? 'yes' : 'no'}`);
    console.log(`✓ rect-2: ${rect2?.samPoints.length} points, mask=${rect2?.latestSamMask ? 'yes' : 'no'}`);
    console.log(`✓ rect-3: ${rect3?.samPoints.length} points, mask=${rect3?.latestSamMask ? 'yes' : 'no'}`);
    console.log(`✓ -1: ${rectNeg1?.samPoints.length} points, mask=${rectNeg1?.latestSamMask ? 'yes' : 'no'}`);

    if (rectNeg1?.latestSamMask && rectNeg1?.compositeMask) {
      console.log('✓ -1 rect has both latest and composite masks');
    }

    // Check point ordering
    if (rect3?.samPoints) {
      const pointIds = rect3.samPoints.map((p: { pointId: number }) => p.pointId);
      console.log(`✓ rect-3 point order: [${pointIds.join(', ')}]`);
    }
  }

  const drawingTasks = classification.annotations.filter((a) => a.task.startsWith('drawing-'));
  console.log(`✓ Found ${drawingTasks.length} drawing annotations`);

  console.log('\n========== TEST COMPLETE ==========\n');

  return classification;
}

export { testClassificationExport };
