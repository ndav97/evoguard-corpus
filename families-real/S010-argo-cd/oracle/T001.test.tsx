// EvoGuard S010 · T001 — porcentajes en el resumen de aplicaciones.
import {act, fireEvent, render, screen} from '@testing-library/react';
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

const app = (name: string, sync: string, health: string, phase?: string) =>
    ({
        metadata: {name, namespace: 'argocd'},
        spec: {destination: {server: 'https://kubernetes.default.svc', namespace: 'default'}},
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

describe('evoguard S010 T001 — summary percentages', () => {
    it('shows count and percentage of the total for SYNCED, HEALTHY and HYDRATED', async () => {
        await renderSummary([
            app('a', 'Synced', 'Healthy', 'Hydrated'),
            app('b', 'Synced', 'Healthy'),
            app('c', 'Synced', 'Degraded'),
            app('d', 'OutOfSync', 'Missing')
        ]);

        expect(valueOf('APPLICATIONS')).toBe('4');
        expect(valueOf('SYNCED')).toBe('3 (75%)');
        expect(valueOf('HEALTHY')).toBe('2 (50%)');
        expect(valueOf('HYDRATED')).toBe('1 (25%)');
    });

    it('rounds percentages to the nearest integer', async () => {
        await renderSummary([app('a', 'Synced', 'Healthy'), app('b', 'Synced', 'Degraded'), app('c', 'OutOfSync', 'Degraded')]);

        expect(valueOf('SYNCED')).toBe('2 (67%)');
        expect(valueOf('HEALTHY')).toBe('1 (33%)');
        expect(valueOf('HYDRATED')).toBe('0 (0%)');
    });

    it('shows 100% when every application matches', async () => {
        await renderSummary([app('a', 'Synced', 'Healthy'), app('b', 'Synced', 'Healthy')]);

        expect(valueOf('SYNCED')).toBe('2 (100%)');
        expect(valueOf('HEALTHY')).toBe('2 (100%)');
    });

    it('shows plain zeros without percentages when there are no applications', async () => {
        await renderSummary([]);

        expect(valueOf('APPLICATIONS')).toBe('0');
        expect(valueOf('SYNCED')).toBe('0');
        expect(valueOf('HEALTHY')).toBe('0');
        expect(valueOf('HYDRATED')).toBe('0');
    });

    it('does not add percentages to CLUSTERS or NAMESPACES', async () => {
        await renderSummary([app('a', 'Synced', 'Healthy'), app('b', 'OutOfSync', 'Healthy')]);

        expect(valueOf('CLUSTERS')).toBe('1');
        expect(valueOf('NAMESPACES')).toBe('1');
    });
});
