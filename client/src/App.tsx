import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { GameProvider } from './context/GameContext';
import { Home } from './pages/Home';
import { Lobby } from './pages/Lobby';
import { Game } from './pages/Game';

function App() {
  return (
    <BrowserRouter>
      <GameProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:code" element={<Lobby />} />
          <Route path="/game" element={<Game />} />
        </Routes>
      </GameProvider>
    </BrowserRouter>
  );
}

export default App;
