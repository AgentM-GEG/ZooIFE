import { useRef } from 'react';
import { useClassificationStore } from '../../stores/classificationStore';
import { loadImageAsDataUrl, getImageDimensions } from '../../services/imageService';

export function ImageLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSubject } = useClassificationStore();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await loadImageAsDataUrl(file);
      const dims = await getImageDimensions(dataUrl);
      setSubject(`local-${file.name}`, dataUrl, dims);
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  };

  return (
    <div style={containerStyle}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button onClick={() => inputRef.current?.click()} style={btnStyle}>
        Load Image
      </button>
    </div>
  );
}

const containerStyle: React.CSSProperties = { display: 'inline-block' };
const btnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: '#0f3460',
  border: '1px solid #e94560',
  borderRadius: 6,
  color: '#eee',
  cursor: 'pointer',
};
