import { useClassificationStore } from '@/stores/classificationStore';
import { createClassification, PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';
import { Sidebar, SubmitButton, DebugDownloadButton } from './styled';
import { loggers } from '@/utils/logger';
import { getToken } from '@/auth/tokenStore';

/**
 * Task sidebar component for displaying and answering Zooniverse workflow tasks.
 * Shows classification questions and input fields, and provides submit button.
 * In debug mode, also shows a button to download the classification JSON.
 */
export function TaskSidebar() {
  const { buildPanoptesClassification, subjectId } = useClassificationStore(s => ({
    buildPanoptesClassification: s.buildPanoptesClassification,
    subjectId: s.subjectId,
  }));

  const isDebugMode = import.meta.env.VITE_SHOW_DEBUG_UI === 'true' || import.meta.env.VITE_SHOW_DEBUG_UI === true;

  const handleSubmit = async () => {
    const classification = await buildPanoptesClassification(PROJECT_ID, WORKFLOW_ID);
    loggers.app('Classifications (Panoptes format):', classification);
    const token = getToken();
    if(token){
      loggers.panoptes(JSON.stringify(classification), token.access_token);
      const panoptes_response = await createClassification(classification, token.access_token);
      loggers.panoptes("Submission response:", panoptes_response);
      // TODO: Next subject? 
    }
  };

  const handleDebugDownload = async () => {
    try {
      const classification = await buildPanoptesClassification(PROJECT_ID, WORKFLOW_ID);
      
      // Create JSON blob
      const jsonString = JSON.stringify(classification, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `classification-${subjectId || 'debug'}-${Date.now()}.json`;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      loggers.app('Classification JSON downloaded');
    } catch (error) {
      loggers.app('Error downloading classification:', error);
    }
  };

  return (
    <Sidebar>
      {/* <Title>Tasks</Title>
      {SAMPLE_TASKS.map((task) => (
        <TaskBlock key={task.id}>
          <Question>{task.question}</Question>
          {task.type === 'single' && (
            <OptionsContainer>
              {task.options?.map((opt) => (
                <OptionLabel key={opt}>
                  <input
                    type="radio"
                    name={task.id}
                    value={opt}
                    checked={(taskAnswers[task.id] as string) === opt}
                    onChange={() => setTaskAnswer(task.id, opt)}
                  />
                  {opt}
                </OptionLabel>
              ))}
            </OptionsContainer>
          )}
          {task.type === 'multiple' && (
            <OptionsContainer>
              {task.options?.map((opt) => (
                <OptionLabel key={opt}>
                  <input
                    type="checkbox"
                    value={opt}
                    checked={((taskAnswers[task.id] as string[]) ?? []).includes(opt)}
                    onChange={(e) => {
                      const current = ((taskAnswers[task.id] as string[]) ?? []) as string[];
                      const next = e.target.checked
                        ? [...current, opt]
                        : current.filter((x) => x !== opt);
                      setTaskAnswer(task.id, next);
                    }}
                  />
                  {opt}
                </OptionLabel>
              ))}
            </OptionsContainer>
          )}
          {task.type === 'text' && (
            <TextArea
              placeholder="Free-form text..."
              value={(taskAnswers[task.id] as string) ?? ''}
              onChange={(e) => setTaskAnswer(task.id, e.target.value)}
              rows={3}
            />
          )}
        </TaskBlock>
      ))} */}
      <SubmitButton onClick={handleSubmit}>
        Submit Classification
      </SubmitButton>
      {isDebugMode && (
        <DebugDownloadButton onClick={handleDebugDownload}>
          ⬇ Download Classification JSON
        </DebugDownloadButton>
      )}
    </Sidebar>
  );
}
