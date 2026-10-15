// EvoGuard S010 · T004 — fila AUTO-SYNC en el resumen.
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

const auto = (name: string, automated: object = {prune: false, selfHeal: false}) => app(name, 'Synced', 'Healthy', undefined, {automated});

describe('evoguard S010 T004 — auto-sync row', () => {
    it('counts applications with automated sync and shows the percentage', async () => {
        await renderSummary([auto('a'), auto('b', {prune: true, selfHeal: true}), app('c', 'Synced', 'Healthy'), app('d', 'OutOfSync', 'Healthy', undefined, {syncOptions: ['CreateNamespace=true']})]);
        expect(valueOf('AUTO-SYNC')).toBe('2 (50%)');
    });

    it('an automated policy explicitly disabled does not count', async () => {
        await renderSummary([auto('a', {enabled: false}), auto('b', {enabled: true}), auto('c')]);
        expect(valueOf('AUTO-SYNC')).toBe('2 (67%)');
    });

    it('shows only 0 without applications', async () => {
        await renderSummary([]);
        expect(valueOf('AUTO-SYNC')).toBe('0');
    });

    it('sits between HYDRATED and CLUSTERS', async () => {
        await renderSummary([auto('a')]);
        const following = (a: string, b: string) =>
            screen.getByText(a).compareDocumentPosition(screen.getByText(b)) & Node.DOCUMENT_POSITION_FOLLOWING;
        expect(following('HYDRATED', 'AUTO-SYNC')).toBeTruthy();
        expect(following('AUTO-SYNC', 'CLUSTERS')).toBeTruthy();
        expect(valueOf('SYNCED')).toBe('1 (100%)');
        expect(valueOf('NEEDS ATTENTION')).toBe('0');
    });
});
