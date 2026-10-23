import React from 'react'
import ReactDOM from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import '@fontsource/quicksand/latin-600.css'
import '@fontsource/quicksand/latin-700.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-600.css'
import { Layout, RouteError } from './components/Layout'
import { RequireAdmin } from './lib/auth'
import './styles.css'

const router = createBrowserRouter([{
  element: <Layout />,
  errorElement: <RouteError />,
  children: [
    { path: '/', lazy: async () => ({ Component: (await import('./pages/PublicPages')).Home }) },
    { path: '/about', element: <Navigate to="/#about" replace /> },
    { path: '/records', lazy: async () => ({ Component: (await import('./pages/PublicPages')).SearchResults }) },
    { path: '/records/:id', lazy: async () => ({ Component: (await import('./pages/PublicPages')).ViewRecord }) },
    { path: '/admin/login', lazy: async () => ({ Component: (await import('./pages/AdminPages')).Login }) },
    { element: <RequireAdmin />, children: [
      { path: '/admin/records', lazy: async () => ({ Component: (await import('./pages/RecordManagement')).RecordManagement }) },
      { path: '/admin/records/new', lazy: async () => {
        const { RecordForm } = await import('./pages/RecordForm')
        return { Component: () => <RecordForm key="new" /> }
      } },
      { path: '/admin/records/:id/edit', lazy: async () => {
        const { RecordForm } = await import('./pages/RecordForm')
        return { Component: () => <RecordForm key="edit" editing /> }
      } },
    ] },
    { path: '*', lazy: async () => ({ Component: (await import('./pages/PublicPages')).NotFound }) },
  ],
}])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
)
