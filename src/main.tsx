import React from 'react'
import ReactDOM from 'react-dom/client'
import { Navigate, RouterProvider, createBrowserRouter } from 'react-router-dom'
import '@fontsource/quicksand/latin-600.css'
import '@fontsource/quicksand/latin-700.css'
import '@fontsource/nunito/latin-400.css'
import '@fontsource/nunito/latin-600.css'
import { Layout, RouteError } from './components/Layout'
import { Home, SearchResults, ViewRecord, NotFound } from './pages/PublicPages'
import { Login, RecordManagement } from './pages/AdminPages'
import { RecordForm } from './pages/RecordForm'
import { RequireAdmin } from './lib/auth'
import './styles.css'

const router = createBrowserRouter([{
  element: <Layout />,
  errorElement: <RouteError />,
  children: [
    { path: '/', element: <Home /> },
    { path: '/about', element: <Navigate to="/#about" replace /> },
    { path: '/records', element: <SearchResults /> },
    { path: '/records/:id', element: <ViewRecord /> },
    { path: '/admin/login', element: <Login /> },
    { element: <RequireAdmin />, children: [
      { path: '/admin/records', element: <RecordManagement /> },
      { path: '/admin/records/new', element: <RecordForm key="new" /> },
      { path: '/admin/records/:id/edit', element: <RecordForm key="edit" editing /> },
    ] },
    { path: '*', element: <NotFound /> },
  ],
}])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
)
