import styled from 'styled-components';
import { theme } from '../../theme/zooniverseTheme';
import { useClassificationStore } from '../../stores/classificationStore';
import {
  buildZooniverseSubjectTalkUrl,
  isPanoptesSubjectId,
} from '../../utils/zooniverseTalk';

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

const TalkButton = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: transparent;
  border: ${theme.borders.width.thin} solid ${theme.colors.primary};
  border-radius: ${theme.borders.radius.base};
  color: ${theme.colors.primary};
  font-family: ${theme.typography.fontFamily};
  font-size: ${theme.typography.size.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  cursor: pointer;
  text-decoration: none;
  text-align: center;
  transition: all ${theme.transitions.base};

  &:hover:not([aria-disabled='true']) {
    background: ${theme.colors.primaryLight}33;
  }

  &:active:not([aria-disabled='true']) {
    transform: scale(0.98);
  }

  &[aria-disabled='true'] {
    opacity: 0.45;
    cursor: not-allowed;
    pointer-events: none;
  }
`;

const SidebarActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
  margin-top: auto;
`;

const PROJECT_ID = import.meta.env.VITE_ZOONIVERSE_PROJECT_ID || undefined;
const WORKFLOW_ID = import.meta.env.VITE_ZOONIVERSE_WORKFLOW_ID || undefined;
const PROJECT_SLUG = import.meta.env.VITE_ZOONIVERSE_PROJECT_SLUG?.trim() || '';
const SITE_ORIGIN = import.meta.env.VITE_ZOONIVERSE_SITE_ORIGIN?.trim() || undefined;

/**
 * Task sidebar component for displaying and answering Zooniverse workflow tasks.
 * Shows classification questions and input fields, and provides submit button.
 */
export function TaskSidebar() {
  const { taskAnswers, setTaskAnswer, buildPanoptesClassification, subjectId } =
    useClassificationStore(s => ({
      taskAnswers: s.taskAnswers,
      setTaskAnswer: s.setTaskAnswer,
      buildPanoptesClassification: s.buildPanoptesClassification,
      subjectId: s.subjectId,
    }));

  const handleSubmit = async () => {
    if (!PROJECT_ID || !WORKFLOW_ID) {
      console.warn(
        'Set VITE_ZOONIVERSE_PROJECT_ID and VITE_ZOONIVERSE_WORKFLOW_ID to build a full classification payload.'
      );
      return;
    }
    const annotations = await buildPanoptesClassification(PROJECT_ID, WORKFLOW_ID);
    console.log('Classifications (Panoptes format):', annotations);
  };

  const talkHref =
    PROJECT_SLUG && subjectId && isPanoptesSubjectId(subjectId)
      ? buildZooniverseSubjectTalkUrl(PROJECT_SLUG, subjectId, SITE_ORIGIN)
      : undefined;
  const talkDisabledTitle = !PROJECT_SLUG
    ? 'Set VITE_ZOONIVERSE_PROJECT_SLUG in .env (path after /projects/ on zooniverse.org).'
    : !isPanoptesSubjectId(subjectId)
      ? 'Load a Zooniverse subject (Next subject) to open Talk.'
      : undefined;

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
      <SidebarActions>
        <SubmitButton type="button" onClick={handleSubmit}>
          Submit Classification
        </SubmitButton>
        {talkHref ? (
          <TalkButton href={talkHref} target="_blank" rel="noopener noreferrer">
            Go to Talk
          </TalkButton>
        ) : (
          <TalkButton as="span" aria-disabled="true" title={talkDisabledTitle}>
            Go to Talk
          </TalkButton>
        )}
      </SidebarActions>
    </Sidebar>
  );
}
