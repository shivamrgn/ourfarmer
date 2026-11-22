import { Dashboard } from '@/components/Dashboard';

export interface User {
  id: number | string;
  name: string;
  email: string;
}

const Index = () => {
  return <Dashboard />;
};

export default Index;

