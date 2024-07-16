import './App.css';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Main from './components/main';

const App = () => {
  return (
    <div className="App App-header">
      <Router>
        <Routes>
          <Route exact path="/" element={<Main />} />
          <Route path="/debt/:address?" element={<Main />} />
        </Routes>
      </Router>
    </div>
  );
};

export default App;



