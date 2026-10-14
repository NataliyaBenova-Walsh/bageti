import { useOutletContext } from 'react-router'
import type { User } from '../types'

// The logged-in staff member or admin, for pages inside AdminLayout
export const useAdminUser = () => useOutletContext<User>()
