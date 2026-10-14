import { createBrowserRouter, RouterProvider } from 'react-router'
import { Layout } from './components/Layout'
import { CheckoutPage } from './pages/CheckoutPage'
import { ConfirmationPage } from './pages/ConfirmationPage'
import { MenuPage } from './pages/MenuPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <MenuPage /> },
      { path: '/checkout', element: <CheckoutPage /> },
      { path: '/order/confirmation', element: <ConfirmationPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
