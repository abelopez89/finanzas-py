import ConfigTabs from '@/components/ConfigTabs';
import { PageHeader } from '@/components/ui/Layout';

export default function ConfiguracionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader titulo="Configuración" />
      <ConfigTabs />
      {children}
    </div>
  );
}
