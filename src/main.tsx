import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource-variable/fraunces';
import './styles/index.css';
import { App } from './App';
import { createStore, StoreProvider } from './state/store';
import { dailySnapshot, loadState, storageAvailable } from './lib/storage';
import { UIProvider } from './components/ui';
import { EditorProvider } from './components/PublicationEditor';

const { state, notice } = loadState();
dailySnapshot(state);
const store = createStore(state);
const storageNotice = storageAvailable()
  ? notice
  : 'Ce navigateur bloque le stockage local (navigation privée ?). Vos modifications seront perdues à la fermeture : exportez une sauvegarde JSON.';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <UIProvider>
        <EditorProvider>
          <App notice={storageNotice} />
        </EditorProvider>
      </UIProvider>
    </StoreProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
