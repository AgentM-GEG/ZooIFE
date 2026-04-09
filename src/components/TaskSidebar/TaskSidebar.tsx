import { useClassificationStore } from '@/stores/classificationStore';
import { PROJECT_ID, WORKFLOW_ID } from '@/services/panoptesService';
import { Sidebar, SubmitButton } from './styled';

/**
 * Task sidebar component for displaying and answering Zooniverse workflow tasks.
 * Shows classification questions and input fields, and provides submit button.
 */
export function TaskSidebar() {
  const { buildPanoptesClassification } = useClassificationStore(s => ({
    buildPanoptesClassification: s.buildPanoptesClassification,
  }));

  const handleSubmit = async () => {
    const annotations = await buildPanoptesClassification(PROJECT_ID, WORKFLOW_ID);
    console.log('Classifications (Panoptes format):', annotations);
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
    </Sidebar>
  );
}
