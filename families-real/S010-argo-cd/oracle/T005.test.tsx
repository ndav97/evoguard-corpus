// EvoGuard S010 · T005 — fila PROJECTS en el resumen.
import {act, render, screen} from '@testing-library/react';
import * as React from 'react';

import {ClusterCtx} from '../shared/components';
import * as models from '../shared/models';
import {ApplicationsSummary} from '../applications/components/applications-list/applications-summary';

jest.mock('react-svg-piechart', () => ({default: () => null}));
jest.mock('../applications/components/utils', () => ({
    ComparisonStatusIcon: () => null,
    HealthStatusIcon: () => null,
    HydrateOperationPhaseIcon: () => null
}));

const app = (name: string, sync: string, health: string, phase?: string, syncPolicy?: object, project?: string) =>
    ({
        metadata: {name, namespace: 'argocd'},
        spec: {destination: {server: 'https://kubernetes.default.svc', namespace: 'default'}, ...(syncPolicy ? {syncPolicy} : {}), ...(project ? {project} : {})},
        status: {
            sync: {status: sync},
            health: {status: health},
            ...(phase ? {sourceHydrator: {currentOperation: {phase}}} : {})
        }
    }) as unknown as models.Application;

async function renderSummary(applications: models.Application[], props: Record<string, unknown> = {}) {
    const result = render(
        <ClusterCtx.Provider value={Promise.resolve([] as models.Cluster[])}>
            <ApplicationsSummary applications={applications} {...props} />
        </ClusterCtx.Provider>
    );
    await act(async () => {
        await Promise.resolve();
    });
    return result;
}

const valueCell = (title: string) => screen.getByText(title).nextElementSibling as HTMLElement;
const valueOf = (title: string) => valueCell(title).textContent.trim();

const inProject = (name: string, project?: string) => app(name, 'Synced', 'Healthy', undefined, undefined, project);

describe('evoguard S010 T005 — projects row', () => {
    it('counts distinct projects and lists them by number of applications', async () => {
        await renderSummary([inProject('a', 'team-b'), inProject('b', 'default'), inProject('c', 'team-b'), inProject('d', 'team-a'), inProject('e', 'default')]);
        expect(valueOf('PROJECTS')).toBe('3');
        expect(valueCell('PROJECTS')).toHaveAttribute('title', 'default (2), team-b (2), team-a (1)');
    });

    it('applications without project count as default', async () => {
        await renderSummary([inProject('a'), inProject('b', 'default'), inProject('c', 'ops')]);
        expect(valueOf('PROJECTS')).toBe('2');
        expect(valueCell('PROJECTS')).toHaveAttribute('title', 'default (2), ops (1)');
    });

    it('lists at most five projects and summarises the rest', async () => {
        const apps = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((p, i) => inProject(`app-${i}`, p));
        apps.push(inProject('extra', 'p7'));
        await renderSummary(apps);
        expect(valueOf('PROJECTS')).toBe('7');
        expect(valueCell('PROJECTS')).toHaveAttribute('title', 'p7 (2), p1 (1), p2 (1), p3 (1), p4 (1), +2 more');
    });

    it('shows 0 without tooltip when there are no applications', async () => {
        await renderSummary([]);
        expect(valueOf('PROJECTS')).toBe('0');
        expect(valueCell('PROJECTS')).not.toHaveAttribute('title');
    });

    it('sits after NAMESPACES and before NEEDS ATTENTION, without percentage', async () => {
        await renderSummary([inProject('a', 'x')]);
        const following = (a: string, b: string) =>
            screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING;
        expect(following('NAMESPACES', 'PROJECTS')).toBeTruthy();
        expect(following('PROJECTS', 'NEEDS ATTENTION')).toBeTruthy();
        expect(valueOf('PROJECTS')).toBe('1');
        expect(screen.getByText('PROJECTS').parentElement).not.toHaveClass('white-box__details-row--attention');
    });
});
