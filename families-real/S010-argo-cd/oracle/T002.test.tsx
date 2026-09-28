// EvoGuard S010 · T002 — leyendas de Sync y Health como filtros.
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

const apps = () => [
    app('a', 'Synced', 'Healthy', 'Hydrated'),
    app('b', 'Synced', 'Healthy'),
    app('c', 'Synced', 'Degraded'),
    app('d', 'OutOfSync', 'Healthy')
];

describe('evoguard S010 T002 — legend filters', () => {
    it('calls onFilter with the sync status when a Sync legend entry is clicked', async () => {
        const onFilter = jest.fn();
        await renderSummary(apps(), {onFilter});

        fireEvent.click(screen.getByRole('button', {name: 'Synced (3)'}));
        expect(onFilter).toHaveBeenCalledTimes(1);
        expect(onFilter).toHaveBeenCalledWith('sync', 'Synced');

        fireEvent.click(screen.getByRole('button', {name: 'OutOfSync (1)'}));
        expect(onFilter).toHaveBeenLastCalledWith('sync', 'OutOfSync');
    });

    it('calls onFilter with the health status when a Health legend entry is clicked', async () => {
        const onFilter = jest.fn();
        await renderSummary(apps(), {onFilter});

        fireEvent.click(screen.getByRole('button', {name: 'Degraded (1)'}));
        expect(onFilter).toHaveBeenCalledWith('health', 'Degraded');
    });

    it('disables legend entries with no applications', async () => {
        const onFilter = jest.fn();
        await renderSummary(apps(), {onFilter});

        const unknown = screen.getAllByRole('button', {name: 'Unknown (0)'});
        expect(unknown).toHaveLength(2);
        unknown.forEach(button => expect(button).toBeDisabled());
        expect(screen.getByRole('button', {name: 'Missing (0)'})).toBeDisabled();
        expect(screen.getByRole('button', {name: 'Healthy (3)'})).toBeEnabled();

        fireEvent.click(screen.getByRole('button', {name: 'Missing (0)'}));
        expect(onFilter).not.toHaveBeenCalled();
    });

    it('keeps the Hydrator legend as plain text', async () => {
        await renderSummary(apps(), {onFilter: jest.fn()});

        expect(screen.queryByRole('button', {name: 'Hydrated (1)'})).toBeNull();
        expect(screen.getByText(/Hydrated \(1\)/)).toBeInTheDocument();
    });

    it('renders no buttons when onFilter is not provided', async () => {
        await renderSummary(apps());

        expect(screen.queryAllByRole('button')).toHaveLength(0);
        expect(screen.getByText(/Synced \(3\)/)).toBeInTheDocument();
    });
});
