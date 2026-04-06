import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
import { useClassificationStore } from '../../stores/classificationStore';

interface TaskConfig {
  id: string;
  type: 'single' | 'multiple' | 'text';
  question: string;
  options?: string[];
}

const SAMPLE_TASKS: TaskConfig[] = [
  {
    id: 'task-1',
    type: 'single',
    question: 'What best describes the highlighted region?',
    options: ['Animal', 'Plant', 'Artifact', 'Unknown'],
  },
  {
    id: 'task-2',
    type: 'multiple',
    question: 'Select all that apply:',
    options: ['Visible', 'Partially obscured', 'Needs review'],
  },
  {
    id: 'task-3',
    type: 'text',
    question: 'Additional comments (optional)',
  },
];

// Styled Components
const Sidebar = styled.div`
  width: 320px;
  padding: ${theme.spacing.lg};
  background: ${theme.colors.background.surface};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  border-radius: ${theme.borders.radius.lg};
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.lg};
  max-height: calc(100vh - 120px);
  overflow-y: auto;
`;

const Title = styled.h3`
  margin: 0;
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.heading.h4.fontSize};
  font-weight: ${theme.typography.fontWeight.medium};
`;

const TaskBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Question = styled.label`
  color: ${theme.colors.text.primary};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: default;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.xs};
`;

const OptionLabel = styled.label`
  color: ${theme.colors.text.secondary};
  font-size: ${theme.typography.size.sm};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: ${theme.spacing.sm};

  input {
    cursor: pointer;
  }

  &:hover {
    color: ${theme.colors.text.primary};
  }
`;

const TextArea = styled.textarea`
  padding: ${theme.spacing.md};
  border-radius: ${theme.borders.radius.base};
  border: ${theme.borders.width.thin} solid ${theme.colors.border};
  background: ${theme.colors.secondary};
  color: ${theme.colors.text.inverse};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  resize: vertical;
  transition: all ${theme.transitions.base};

  &:focus {
    outline: none;
    border-color: ${theme.colors.primary};
    box-shadow: 0 0 0 3px ${theme.colors.primaryLight}40;
  }

  &::placeholder {
    color: ${theme.colors.neutral.dark};
  }
`;

const SubmitButton = styled.button`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.primary};
  border: none;
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.secondary};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  margin-top: auto;
  transition: all ${theme.transitions.base};

  &:hover {
    opacity: 0.9;
  }

  &:active {
    transform: scale(0.95);
  }
`;

export function TaskSidebar() {
  const { taskAnswers, setTaskAnswer, buildPanoptesAnnotations } = useClassificationStore(s => ({
    taskAnswers: s.taskAnswers,
    setTaskAnswer: s.setTaskAnswer,
    buildPanoptesAnnotations: s.buildPanoptesAnnotations,
  }));

  const handleSubmit = async () => {
    const annotations = await buildPanoptesAnnotations();
    console.log('Classifications (Panoptes format):', annotations);
  };

  return (
    <Sidebar>
      <Title>Tasks</Title>
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
      ))}
      <SubmitButton onClick={handleSubmit}>
        Submit Classification
      </SubmitButton>
    </Sidebar>
  );
}
