import { useAuth } from '@/auth/AuthContext';
import { useCaesarClient } from '@/hooks/useCaesarClient';
import { CAESAR_REDUCTION_OPTS } from '@/services/caesarService';
import { WORKFLOW_ID } from '@/services/panoptesService';
import { Container, Button } from './styled';
import { useCaesarReductions } from './useCaesarReductions';
import { useSubjectLoader } from './useSubjectLoader';

/**
 * Zooniverse image loader component for loading subjects from the Zooniverse platform.
 * Fetches subjects from the configured workflow and processes Caesar ML annotations.
 */
export function ZooniverseImageLoader() {
  const { token } = useAuth();

  // Call all hooks unconditionally (at the top level of the component)
  // This ensures consistent hook counts across all renders
  const accessToken = token?.access_token;
  const caesarClient = useCaesarClient(accessToken, CAESAR_REDUCTION_OPTS);
  const processCaesarReductions = useCaesarReductions(caesarClient, WORKFLOW_ID, accessToken);
  const { loadNextSubject, isLoading } = useSubjectLoader(accessToken, processCaesarReductions);

  // Only render content if authenticated
  if (!accessToken) {
    return <Container />;
  }

  return (
    <Container>
      <Button onClick={() => loadNextSubject()} disabled={isLoading}>
        {isLoading ? 'Loading...' : 'Next subject'}
      </Button>
    </Container>
  );
}
