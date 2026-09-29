// Candidatos instrumentales de F002 (tablero de tareas) para el ensayo de generación y auditoría de una familia
// nueva (npm run pipeline:rehearse-family -- F002). Material de prueba escrito por Claude: nunca es referencia
// del corpus. Cada versión implementa solo los requisitos activos de esa versión (V0: R001–R002, V1: +R003,
// V2: +R004, V3: +R005), con useReducer y sin efectos ni persistencia, como exige el perfil de F002.
const LEVEL = { V0: 0, V1: 1, V2: 2, V3: 3 };

function tasksModule(level) {
  const create = level >= 1;
  const undo = level >= 3;
  return `import fixture from '../fixtures/tasks.json';

export type Status = 'pendiente' | 'en_curso' | 'hecha';
export type Task = { id: string; title: string; priority: string; status: Status; estimate: number };
export type Filter = 'todas' | Status;

export const FILTERS: { value: Filter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'pendiente', label: 'Pendientes' },
  { value: 'en_curso', label: 'En curso' },
  { value: 'hecha', label: 'Hechas' }
];
const NEXT: Record<Status, Status | null> = { pendiente: 'en_curso', en_curso: 'hecha', hecha: null };

export type State = { tasks: Task[]${undo ? '; history: Task[][]' : ''} };
export type Action =
  | { type: 'advance'; id: string }${create ? `
  | { type: 'create'; title: string; hours: number }` : ''}${undo ? `
  | { type: 'undo' }` : ''};

export const initialState = (): State => ({ tasks: (fixture as Task[]).map(task => ({ ...task }))${undo ? ', history: []' : ''} });

export function visibleTasks(tasks: Task[], filter: Filter): Task[] {
  return filter === 'todas' ? tasks : tasks.filter(task => task.status === filter);
}
${create ? `
export function nextId(tasks: Task[]): string {
  const max = Math.max(0, ...tasks.map(task => Number(task.id.slice(1))));
  return 'K' + String(max + 1).padStart(3, '0');
}

// Devuelve el aviso o null si los datos son válidos.
export function validate(title: string, hours: string): string | null {
  if (!title.trim()) return 'El título es obligatorio';
  if (!/^\\d+$/.test(hours) || Number(hours) < 1 || Number(hours) > 8) return 'Las horas deben ser un número entero entre 1 y 8';
  return null;
}
` : ''}
function apply(tasks: Task[], action: Action): Task[] {
  switch (action.type) {
    case 'advance':
      return tasks.map(task => (task.id === action.id && NEXT[task.status] ? { ...task, status: NEXT[task.status] as Status } : task));${create ? `
    case 'create':
      return [...tasks, { id: nextId(tasks), title: action.title.trim(), priority: 'media', status: 'pendiente', estimate: action.hours }];` : ''}
    default:
      return tasks;
  }
}

export function reducer(state: State, action: Action): State {${undo ? `
  if (action.type === 'undo') {
    if (!state.history.length) return state;
    return { tasks: state.history[state.history.length - 1], history: state.history.slice(0, -1) };
  }
  return { tasks: apply(state.tasks, action), history: [...state.history, state.tasks] };` : `
  return { tasks: apply(state.tasks, action) };`}
}
${level >= 2 ? `
export function summary(tasks: Task[]) {
  const count = (status: Status) => tasks.filter(task => task.status === status).length;
  const hours = tasks.filter(task => task.status !== 'hecha').reduce((sum, task) => sum + task.estimate, 0);
  return \`Pendientes: \${count('pendiente')} · En curso: \${count('en_curso')} · Hechas: \${count('hecha')} · Horas restantes: \${hours}\`;
}
` : ''}`;
}

function appModule(level) {
  const create = level >= 1;
  const undo = level >= 3;
  return `import { useReducer, useState } from 'react';
import { FILTERS, initialState, reducer, visibleTasks${create ? ', validate' : ''}${level >= 2 ? ', summary' : ''}, type Filter, type Task${create ? ', type Action' : ''} } from './tasks';

function StatusFilter({ value, onChange }: { value: Filter; onChange: (value: Filter) => void }) {
  return (
    <label>Estado{' '}
      <select value={value} onChange={event => onChange(event.target.value as Filter)}>
        {FILTERS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function TaskItem({ task, onAdvance }: { task: Task; onAdvance: (id: string) => void }) {
  return (
    <li>
      <span>{task.id}</span> <span>{task.title}</span>{' '}
      {task.status !== 'hecha' && <button type="button" onClick={() => onAdvance(task.id)}>Avanzar</button>}
    </li>
  );
}

function TaskList({ tasks, onAdvance }: { tasks: Task[]; onAdvance: (id: string) => void }) {
  return <ul aria-label="Tareas">{tasks.map(task => <TaskItem key={task.id} task={task} onAdvance={onAdvance} />)}</ul>;
}
${create ? `
function CreateForm({ dispatch }: { dispatch: (action: Action) => void }) {
  const [title, setTitle] = useState('');
  const [hours, setHours] = useState('1');
  const [error, setError] = useState<string | null>(null);
  return (
    <form onSubmit={event => {
      event.preventDefault();
      const problem = validate(title, hours);
      setError(problem);
      if (problem) return;
      dispatch({ type: 'create', title, hours: Number(hours) });
      setTitle('');
      setHours('1');
    }}>
      <label>Título <input type="text" value={title} onChange={event => setTitle(event.target.value)} /></label>{' '}
      <label>Horas <input type="number" value={hours} onChange={event => setHours(event.target.value)} /></label>{' '}
      <button type="submit">Añadir</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}
` : ''}${level >= 2 ? `
function Summary({ tasks }: { tasks: Task[] }) {
  return <p role="status" aria-label="Resumen">{summary(tasks)}</p>;
}
` : ''}
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [filter, setFilter] = useState<Filter>('todas');
  return (
    <main>
      <h1>Tablero de tareas</h1>
      <StatusFilter value={filter} onChange={setFilter} />${create ? `
      <CreateForm dispatch={dispatch} />` : ''}${level >= 2 ? `
      <Summary tasks={state.tasks} />` : ''}${undo ? `
      <button type="button" disabled={state.history.length === 0} onClick={() => dispatch({ type: 'undo' })}>Deshacer</button>` : ''}
      <TaskList tasks={visibleTasks(state.tasks, filter)} onAdvance={id => dispatch({ type: 'advance', id })} />
    </main>
  );
}
`;
}

function testModule(level) {
  return `import { expect, it } from 'vitest';
import { initialState, reducer, visibleTasks${level >= 1 ? ', validate' : ''} } from './tasks';

it('filtra por estado conservando el orden del fixture', () => {
  const { tasks } = initialState();
  expect(visibleTasks(tasks, 'todas')).toHaveLength(24);
  expect(visibleTasks(tasks, 'en_curso').map(task => task.id)).toEqual(['K002', 'K005', 'K011', 'K012', 'K015', 'K021', 'K023']);
});

it('avanza una tarea un paso y no toca las demás', () => {
  const state = reducer(initialState(), { type: 'advance', id: 'K001' });
  expect(state.tasks[0].status).toBe('en_curso');
  expect(state.tasks[3].status).toBe('pendiente');
});
${level >= 1 ? `
it('valida y crea tareas con el siguiente ID', () => {
  expect(validate('  ', '1')).toBe('El título es obligatorio');
  expect(validate('Algo', '9')).toBe('Las horas deben ser un número entero entre 1 y 8');
  const state = reducer(initialState(), { type: 'create', title: ' Nueva ', hours: 2 });
  expect(state.tasks.at(-1)).toMatchObject({ id: 'K025', title: 'Nueva', status: 'pendiente', estimate: 2 });
});
` : ''}${level >= 3 ? `
it('deshace hasta el estado inicial y libera el ID', () => {
  let state = reducer(initialState(), { type: 'create', title: 'A', hours: 1 });
  state = reducer(state, { type: 'undo' });
  expect(state.tasks).toHaveLength(24);
  expect(reducer(state, { type: 'create', title: 'B', hours: 1 }).tasks.at(-1)?.id).toBe('K025');
});
` : ''}`;
}

export function candidate(version) {
  const level = LEVEL[version];
  if (level === undefined) throw new Error(`Versión desconocida: ${version}`);
  return { 'src/tasks.ts': tasksModule(level), 'src/App.tsx': appModule(level), 'src/tasks.test.ts': testModule(level) };
}
