import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { useRoute } from './router';
import { Dashboard } from './views/Dashboard';
import { StrategyView } from './views/Strategy';
import { SocialView } from './views/Social';
import { CreativeView } from './views/Creative';
import { CalendarView } from './views/Calendar';
import { SeoView } from './views/Seo';
import { AnalyticsView } from './views/Analytics';
import { CampaignsView, CampaignDetail } from './views/Campaigns';
import { PublicationsView } from './views/Publications';
import { ApprovalView } from './views/Approval';
import { TemplatesView } from './views/Templates';
import { ClaudeView } from './views/ClaudeWorkshop';
import { BrandView } from './views/BrandSettings';
import { DataView } from './views/Data';
import { Empty } from './components/ui';
import { NAV } from './router';

export function App({ notice }: { notice: string | null }) {
  const [section, sub] = useRoute();
  const route = [section, sub].filter(Boolean).join('/');

  useEffect(() => {
    const label = NAV.find((n) => n.path === (section ?? ''))?.label;
    document.title = label && section ? `${label} — The Vitrine Marketing` : 'The Vitrine Marketing';
  }, [section]);

  let view;
  switch (section ?? '') {
    case '':
      view = <Dashboard />;
      break;
    case 'strategie':
      view = <StrategyView />;
      break;
    case 'reseaux':
      view = <SocialView />;
      break;
    case 'creation':
      view = <CreativeView />;
      break;
    case 'calendrier':
      view = <CalendarView />;
      break;
    case 'seo':
      view = <SeoView />;
      break;
    case 'analyses':
      view = <AnalyticsView />;
      break;
    case 'campagnes':
      view = sub ? <CampaignDetail id={sub} /> : <CampaignsView />;
      break;
    case 'publications':
      view = <PublicationsView />;
      break;
    case 'validation':
      view = <ApprovalView />;
      break;
    case 'modeles':
      view = <TemplatesView />;
      break;
    case 'claude':
      view = <ClaudeView />;
      break;
    case 'marque':
      view = <BrandView />;
      break;
    case 'donnees':
      view = <DataView />;
      break;
    default:
      view = <Empty title="Page introuvable" icon="alert">Utilisez le menu pour revenir à un espace.</Empty>;
  }

  return (
    <Layout route={route} notice={notice}>
      {view}
    </Layout>
  );
}
