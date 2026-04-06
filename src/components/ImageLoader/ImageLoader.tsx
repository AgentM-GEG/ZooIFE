import { useRef } from 'react';
import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
import { useClassificationStore } from '../../stores/classificationStore';
import {
  loadImageAsDataUrl,
  getImageDimensions,
  normalizeImageForDisplay,
} from '../../services/imageService';

const Container = styled.div`
  display: inline-block;
`;

const Button = styled.button`
  padding: ${theme.spacing.sm} ${theme.spacing.lg};
  background: ${theme.colors.secondary};
  border: 1px solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.text.inverse};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  transition: all ${theme.transitions.base};

  &:hover {
    background: ${theme.colors.primary};
    color: ${theme.colors.secondary};
  }

  &:active {
    transform: scale(0.95);
  }
`;

const HiddenInput = styled.input`
  display: none;
`;

/**
 * Local image loader component.
 * Provides file input to load images from the user's device for classification.
 */
export function ImageLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSubject } = useClassificationStore();

  /**
   * Handle local file selection and normalization.
   * @param e - File input change event
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await loadImageAsDataUrl(file);
      // Normalize so display and SAM2 see the same pixels (fixes EXIF coordinate mismatch)
      const normalizedUrl = await normalizeImageForDisplay(dataUrl);
      const dims = await getImageDimensions(normalizedUrl);
      setSubject(`local-${file.name}`, normalizedUrl, dims);
    } catch (err) {
      console.error('Failed to load image:', err);
    }
  };

  return (
    <Container>
      <HiddenInput
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()}>
        Load Image
      </Button>
    </Container>
  );
}
