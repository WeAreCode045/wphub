import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="hero-section">
          <h1 className="hero-title">
            Welcome to <span className="gradient-text">WPHub</span>
          </h1>
          <p className="hero-subtitle">
            Your centralized hub to manage all your WordPress sites, themes, and plugins
          </p>
          
          <div className="hero-actions">
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="primary-button"
              >
                Go to Dashboard
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="primary-button"
                >
                  Get Started
                </button>
                <button
                  onClick={() => navigate('/signup')}
                  className="secondary-button"
                >
                  Sign Up
                </button>
              </>
            )}
          </div>
        </div>

        <div className="features-section">
          <div className="feature-card">
            <div className="feature-icon">🌐</div>
            <h3>Manage Sites</h3>
            <p>Keep track of all your WordPress sites in one place</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🎨</div>
            <h3>Organize Themes</h3>
            <p>Manage and monitor your WordPress themes efficiently</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">🔌</div>
            <h3>Track Plugins</h3>
            <p>Keep your plugins organized and up to date</p>
          </div>
        </div>
      </div>
    </div>
  );
}
