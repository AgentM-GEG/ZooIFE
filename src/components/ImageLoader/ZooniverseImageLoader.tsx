import { useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { useCaesarClient } from '@/hooks/useCaesarClient';
import { CAESAR_REDUCTION_OPTS } from '@/services/caesarService';
import { WORKFLOW_ID } from '@/services/panoptesService';
import { Container, Button, ControlsRow, DebugInput } from './styled';
import { useCaesarReductions } from './useCaesarReductions';
import { useSubjectLoader } from './useSubjectLoader';

/**
 * Zooniverse image loader component for loading subjects from the Zooniverse platform.
 * Fetches subjects from the configured workflow and processes Caesar ML annotations.
 */
export function ZooniverseImageLoader() {
  const { token } = useAuth();
  const [debugSubjectId, setDebugSubjectId] = useState('');

  // Call all hooks unconditionally (at the top level of the component)
  // This ensures consistent hook counts across all renders
  const accessToken = token?.access_token;
  const isDebugMode = import.meta.env.VITE_SHOW_DEBUG_UI === 'true' || import.meta.env.VITE_SHOW_DEBUG_UI === '1';
  const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
  const processCaesarReductions = useCaesarReductions(caesarClient, WORKFLOW_ID, accessToken);
  const { loadNextSubject, isLoading } = useSubjectLoader(accessToken, processCaesarReductions);

  // Only render content if authenticated
  if (!accessToken) {
    return <Container />;
  }

  return (
    <Container>
      <ControlsRow>
        <Button onClick={() => loadNextSubject()} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Next subject'}
        </Button>
        {isDebugMode && (
          <DebugInput
            type="text"
            value={debugSubjectId}
            onChange={(event) => setDebugSubjectId(event.target.value)}
            placeholder="Debug subject ID"
          />
        )}
        {isDebugMode && (
          <Button
            onClick={() => loadNextSubject(debugSubjectId)}
            disabled={isLoading || !debugSubjectId.trim()}
          >
            {isLoading ? 'Loading...' : 'Load subject ID'}
          </Button>
        )}
      </ControlsRow>
    </Container>
  );
}
