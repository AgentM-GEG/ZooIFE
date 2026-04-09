import { useRef } from 'react';
import { Container, Button, HiddenInput } from './styled';
import { useLocalImageLoader } from './useLocalImageLoader';

/**
 * Local image loader component.
 * Provides file input to load images from the user's device for classification.
 */
export function ImageLoader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const { handleFileChange, acceptedImageTypes } = useLocalImageLoader();

  return (
    <Container>
      <HiddenInput
        ref={inputRef}
        type="file"
        accept={acceptedImageTypes}
        onChange={handleFileChange}
      />
      <Button onClick={() => inputRef.current?.click()}>
        Load Image
      </Button>
    </Container>
  );
}
