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

export function TaskSidebar() {
  const { taskAnswers, setTaskAnswer, buildPanoptesAnnotations } = useClassificationStore();

  const handleSubmit = async () => {
    const annotations = await buildPanoptesAnnotations();
    console.log('Classifications (Panoptes format):', annotations);
  };

  return (
    <div className="task-sidebar" style={sidebarStyle}>
      <h3 style={titleStyle}>Tasks</h3>
      {SAMPLE_TASKS.map((task) => (
        <div key={task.id} style={taskBlockStyle}>
          <label style={questionStyle}>{task.question}</label>
          {task.type === 'single' && (
            <div style={optionsStyle}>
              {task.options?.map((opt) => (
                <label key={opt} style={labelStyle}>
                  <input
                    type="radio"
                    name={task.id}
                    value={opt}
                    checked={(taskAnswers[task.id] as string) === opt}
                    onChange={() => setTaskAnswer(task.id, opt)}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
          {task.type === 'multiple' && (
            <div style={optionsStyle}>
              {task.options?.map((opt) => (
                <label key={opt} style={labelStyle}>
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
                </label>
              ))}
            </div>
          )}
          {task.type === 'text' && (
            <textarea
              placeholder="Free-form text..."
              value={(taskAnswers[task.id] as string) ?? ''}
              onChange={(e) => setTaskAnswer(task.id, e.target.value)}
              style={textareaStyle}
              rows={3}
            />
          )}
        </div>
      ))}
      <button onClick={handleSubmit} style={submitStyle}>
        Submit Classification
      </button>
    </div>
  );
}

const sidebarStyle: React.CSSProperties = {
  width: 280,
  padding: 16,
  background: '#1a1a2e',
  borderRadius: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};
const titleStyle: React.CSSProperties = { margin: 0, color: '#eee', fontSize: 16 };
const taskBlockStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 8 };
const questionStyle: React.CSSProperties = { color: '#bbb', fontSize: 14 };
const optionsStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const labelStyle: React.CSSProperties = { color: '#ddd', fontSize: 13, cursor: 'pointer' };
const textareaStyle: React.CSSProperties = {
  padding: 8,
  borderRadius: 6,
  border: '1px solid #333',
  background: '#16213e',
  color: '#eee',
  resize: 'vertical',
};
const submitStyle: React.CSSProperties = {
  padding: '10px 16px',
  background: '#e94560',
  border: 'none',
  borderRadius: 6,
  color: 'white',
  cursor: 'pointer',
  marginTop: 'auto',
};
