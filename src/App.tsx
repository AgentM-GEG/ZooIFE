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
  const { imageUrl, annotations, setMask } = useClassificationStore();

  const handlePointClick = useCallback(
    async (x: number, y: number, label: 0 | 1) => {
      if (!imageUrl) return;
      const points = [...annotations.filter((a) => a.type === 'point').map((a) => ({ x: a.x, y: a.y, label: (a as { label: 0 | 1 }).label })), { x, y, label }];
      if (points.length === 0) return;
      try {
        const result = await segmentWithPoints(imageUrl, points);
        if (result.image?.url) setMask(result.image.url);
      } catch (err) {
        console.warn('SAM2 not available (need backend proxy):', err);
      }
    },
    [imageUrl, annotations, setMask]
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
          <ToolPalette tool={tool} onToolChange={setTool} />
        </aside>
        <section style={canvasSectionStyle}>
          <ImageCanvas tool={tool} onPointClick={handlePointClick} />
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
const canvasSectionStyle: React.CSSProperties = { flex: 1, minWidth: 0 };
const rightAsideStyle: React.CSSProperties = { flexShrink: 0 };

export default App;
