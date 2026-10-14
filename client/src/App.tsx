import { createBrowserRouter, RouterProvider } from 'react-router'
import { AdminLayout } from './admin/AdminLayout'
import { LoginPage } from './admin/LoginPage'
import { OrdersPage } from './admin/OrdersPage'
import { ProductsPage } from './admin/ProductsPage'
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
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <OrdersPage /> },
      { path: 'products', element: <ProductsPage /> },
    ],
  },
])

function App() {
  return <RouterProvider router={router} />
}

export default App
