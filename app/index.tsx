import { UserProfile } from '@/components/UserProfile';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function HomeScreen() {
  return (
    <ProtectedRoute>
      <UserProfile />
    </ProtectedRoute>
  );
}