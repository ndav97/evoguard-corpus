// EvoGuard S010 · T003 — fila NEEDS ATTENTION en el resumen.
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

describe('evoguard S010 T003 — needs attention', () => {
    it('counts OutOfSync, Degraded and Missing applications once each', async () => {
        await renderSummary([
            app('zeta', 'OutOfSync', 'Healthy'),
            app('alpha', 'Synced', 'Degraded'),
            app('mid', 'OutOfSync', 'Missing'),
            app('ok', 'Synced', 'Healthy'),
            app('busy', 'Synced', 'Progressing'),
            app('paused', 'Unknown', 'Suspended')
        ]);

        expect(valueOf('NEEDS ATTENTION')).toBe('3');
        expect(valueCell('NEEDS ATTENTION')).toHaveAttribute('title', 'alpha, mid, zeta');
        expect(screen.getByText('NEEDS ATTENTION').parentElement).toHaveClass('white-box__details-row--attention');
    });

    it('shows zero without tooltip or highlight when everything is fine', async () => {
        await renderSummary([app('a', 'Synced', 'Healthy'), app('b', 'Synced', 'Progressing')]);

        expect(valueOf('NEEDS ATTENTION')).toBe('0');
        expect(valueCell('NEEDS ATTENTION')).not.toHaveAttribute('title');
        expect(screen.getByText('NEEDS ATTENTION').parentElement).not.toHaveClass('white-box__details-row--attention');
    });

    it('lists at most five names and summarises the rest', async () => {
        await renderSummary(['app-7', 'app-3', 'app-1', 'app-5', 'app-2', 'app-6', 'app-4'].map(name => app(name, 'OutOfSync', 'Healthy')));

        expect(valueOf('NEEDS ATTENTION')).toBe('7');
        expect(valueCell('NEEDS ATTENTION')).toHaveAttribute('title', 'app-1, app-2, app-3, app-4, app-5, +2 more');
    });

    // Añadido tras la prueba de mutantes (2026-09-29): la fila va después de NAMESPACES, que no cambia.
    it('places NEEDS ATTENTION after NAMESPACES', async () => {
        await renderSummary([app('a', 'Synced', 'Healthy')]);
        const namespaces = screen.getByText('NAMESPACES');
        expect(valueOf('NAMESPACES')).toBe('1');
        expect(namespaces.compareDocumentPosition(screen.getByText('NEEDS ATTENTION')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('does not show a percentage for NEEDS ATTENTION', async () => {
        await renderSummary([app('a', 'OutOfSync', 'Healthy'), app('b', 'Synced', 'Healthy')]);

        expect(valueOf('NEEDS ATTENTION')).toBe('1');
        expect(valueOf('SYNCED')).toBe('1 (50%)');
    });
});
