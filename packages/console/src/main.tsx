import { render } from 'solid-js/web'
import { QueryClient, QueryClientProvider } from '@tanstack/solid-query'
import { Route, Router } from '@solidjs/router'
import { App } from './App'
import { DashboardPage } from './pages/Dashboard'
import { CollectionsPage } from './pages/Collections'
import { CollectionPage } from './pages/CollectionPage'
import { MediaPage } from './pages/Media'
import { DocumentsPage } from './pages/Documents'
import AttachmentsPage from './pages/AttachmentsPage'
import { UsersPage } from './pages/Users'
import { ConfigPage } from './pages/Config'
import { UniversePage } from './pages/Universe'
import { SeedPage } from './pages/Seed'
import { PluginsPage } from './pages/Plugins'
import { PluginPage } from './pages/PluginPage'
import { PanelsPage } from './pages/Panels'
import { PanelDetailPage } from './pages/PanelDetail'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

render(
  () => (
    <QueryClientProvider client={queryClient}>
      <Router root={(props) => <App>{props.children}</App>}>
        <Route path="/" component={DashboardPage} />
        <Route path="/collections" component={CollectionsPage} />
        <Route path="/media" component={MediaPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/attachments" component={AttachmentsPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/config" component={ConfigPage} />
        <Route path="/universe" component={UniversePage} />
        <Route path="/seed" component={SeedPage} />
        <Route path="/plugins" component={PluginsPage} />
        <Route path="/plugins/:name" component={PluginPage} />
        <Route path="/panels" component={PanelsPage} />
        <Route path="/panels/:id" component={PanelDetailPage} />
        <Route path="/collections/:collection" component={CollectionPage} />
      </Router>
    </QueryClientProvider>
  ),
  document.getElementById('root')!,
)