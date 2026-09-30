// EvoGuard S010 · T002 — leyendas de Sync y Health como filtros.
import {act, fireEvent, render, screen} from '@testing-library/react';
import * as React from 'react';

import {ClusterCtx} from '../shared/components';
import * as models from '../shared/models';
import {ApplicationsSummary} from '../applications/components/applications-list/applications-summary';
import {ApplicationsList} from '../applications/components/applications-list/applications-list';
import {Context} from '../shared/context';
import {services} from '../shared/services';
import {BehaviorSubject, NEVER} from 'rxjs';

const mockServices = services as unknown as {
    clusters: {list: jest.Mock};
    viewPreferences: {getPreferences: jest.Mock; updatePreferences: jest.Mock};
    applications: {list: jest.Mock; watch: jest.Mock; get: jest.Mock};
};

jest.mock('react-svg-piechart', () => ({default: () => null}));
jest.mock('../applications/components/utils', () => ({
    ...jest.requireActual('../applications/components/utils'),
    ComparisonStatusIcon: () => null,
    HealthStatusIcon: () => null,
    HydrateOperationPhaseIcon: () => null
}));

// Integración con la lista (punto 6), añadida tras la prueba de mutantes (2026-09-29). Se sustituyen solo las
// piezas de la página ajenas al resumen (marco, barra superior, paginación, filtros laterales) y los servicios.
jest.mock('../shared/components', () => ({
    ...jest.requireActual('../shared/components'),
    Page: ({children}: any) => children,
    FlexTopBar: () => null,
    Paginate: () => null
}));
jest.mock('../applications/components/applications-list/applications-filter', () => ({
    ...jest.requireActual('../applications/components/applications-list/applications-filter'),
    ApplicationsFilter: () => null
}));
jest.mock('../applications/components/applications-list/view-type-switcher', () => ({ViewTypeSwitcher: () => null}));
// Paneles de sincronización y refresco (no intervienen): se sustituyen para no cargar su cadena de dependencias.
jest.mock('../applications/components/application-sync-panel/application-sync-panel', () => ({ApplicationSyncPanel: () => null}));
jest.mock('../applications/components/applications-sync-panel/applications-sync-panel', () => ({ApplicationsSyncPanel: () => null}));
jest.mock('../applications/components/applications-refresh-panel/applications-refresh-panel', () => ({ApplicationsRefreshPanel: () => null}));
// lodash-es se publica como ESM sin transformar; mismo apaño que los tests del proyecto (application-parameters.test.tsx).
jest.mock('lodash-es', () => ({
    __esModule: true,
    cloneDeep: (value: any) => (value == null ? value : JSON.parse(JSON.stringify(value))),
    debounce: (fn: any) => fn,
    isEqual: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b),
    omit: (obj: any, ...keys: any[]) => {
        const copy = {...obj};
        keys.flat().forEach((key: string) => delete copy[key]);
        return copy;
    }
}));
jest.mock('../sidebar/sidebar', () => ({
    ...jest.requireActual('../sidebar/sidebar'),
    useSidebarTarget: () => ({current: document.createElement('div')})
}));
jest.mock('../shared/services', () => ({
    ...jest.requireActual('../shared/services'),
    services: {
        clusters: {list: jest.fn()},
        viewPreferences: {getPreferences: jest.fn(), updatePreferences: jest.fn()},
        applications: {list: jest.fn(), watch: jest.fn(), get: jest.fn()}
    }
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

        expect(screen.getByRole('button', {name: 'Synced (3)'})).toHaveAttribute('type', 'button');
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

describe('evoguard S010 T002 — the list replaces its filter from the summary legend', () => {
    const listApp = (name: string, sync: string, health: string) =>
        ({
            metadata: {name, namespace: 'argocd', labels: {}, annotations: {}, creationTimestamp: '2025-01-01T00:00:00Z'},
            spec: {
                project: 'default',
                source: {repoURL: 'https://example.com/repo.git', path: '.', targetRevision: 'HEAD'},
                destination: {server: 'https://kubernetes.default.svc', namespace: 'default'}
            },
            status: {sync: {status: sync}, health: {status: health}, summary: {}, resources: []}
        }) as unknown as models.Application;
    const appList = {
        view: 'summary',
        labelsFilter: [],
        annotationsFilter: [],
        projectsFilter: [],
        namespacesFilter: [],
        reposFilter: [],
        targetRevisionFilter: [],
        clustersFilter: [],
        syncFilter: [],
        autoSyncFilter: [],
        healthFilter: [],
        operationFilter: [],
        favoritesAppList: [],
        showFavorites: false,
        hideFilters: false,
        statusBarView: {showHealthStatusBar: true},
        annotations: []
    };

    beforeEach(() => {
        mockServices.clusters.list.mockReturnValue(Promise.resolve([]));
        mockServices.viewPreferences.getPreferences.mockReturnValue(new BehaviorSubject({appList, hideSidebar: false}));
        mockServices.viewPreferences.updatePreferences.mockReset();
        mockServices.applications.list.mockReturnValue(
            Promise.resolve({items: [listApp('a', 'Synced', 'Healthy'), listApp('b', 'OutOfSync', 'Healthy'), listApp('c', 'Synced', 'Degraded')], metadata: {resourceVersion: '1'}})
        );
        mockServices.applications.watch.mockReturnValue(NEVER);
    });

    const renderList = () =>
        render(
            <Context.Provider
                value={
                    {
                        history: {location: {search: '?view=summary'}, listen: () => () => undefined},
                        navigation: {goto: jest.fn()},
                        popup: {confirm: jest.fn()},
                        notifications: {show: jest.fn()}
                    } as any
                }>
                <ApplicationsList {...({match: {url: '/applications'}, location: {search: '?view=summary'}, history: {}} as any)} />
            </Context.Provider>
        );
    const lastAppList = () => mockServices.viewPreferences.updatePreferences.mock.calls.slice(-1)[0][0].appList;

    it('a Sync legend entry replaces only the sync filter', async () => {
        renderList();
        fireEvent.click(await screen.findByRole('button', {name: 'OutOfSync (1)'}, {timeout: 4000}));
        expect(lastAppList().syncFilter).toEqual(['OutOfSync']);
        expect(lastAppList().healthFilter).toEqual([]);
    });

    it('a Health legend entry replaces only the health filter', async () => {
        renderList();
        fireEvent.click(await screen.findByRole('button', {name: 'Degraded (1)'}, {timeout: 4000}));
        expect(lastAppList().healthFilter).toEqual(['Degraded']);
        expect(lastAppList().syncFilter).toEqual([]);
    });
});
