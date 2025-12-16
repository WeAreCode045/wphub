import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddSite, setShowAddSite] = useState(false);
  const [newSite, setNewSite] = useState({
    name: '',
    url: '',
    description: '',
  });

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    fetchSites();
  }, [user, navigate]);

  const fetchSites = async () => {
    try {
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSites(data || []);
    } catch (error) {
      console.error('Error fetching sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSite = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('sites').insert([
        {
          ...newSite,
          user_id: user.id,
        },
      ]);

      if (error) throw error;

      setNewSite({ name: '', url: '', description: '' });
      setShowAddSite(false);
      fetchSites();
    } catch (error) {
      console.error('Error adding site:', error);
      alert('Error adding site: ' + error.message);
    }
  };

  const handleDeleteSite = async (id) => {
    if (!confirm('Are you sure you want to delete this site?')) return;

    try {
      const { error } = await supabase.from('sites').delete().eq('id', id);

      if (error) throw error;
      fetchSites();
    } catch (error) {
      console.error('Error deleting site:', error);
      alert('Error deleting site: ' + error.message);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>WPHub Dashboard</h1>
          <div className="header-actions">
            <span className="user-email">{user?.email}</span>
            <button onClick={handleSignOut} className="signout-button">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="sites-header">
            <h2>Your WordPress Sites</h2>
            <button
              onClick={() => setShowAddSite(!showAddSite)}
              className="add-site-button"
            >
              {showAddSite ? 'Cancel' : '+ Add Site'}
            </button>
          </div>

          {showAddSite && (
            <form onSubmit={handleAddSite} className="add-site-form">
              <h3>Add New Site</h3>
              <div className="form-group">
                <label htmlFor="name">Site Name</label>
                <input
                  id="name"
                  type="text"
                  value={newSite.name}
                  onChange={(e) =>
                    setNewSite({ ...newSite, name: e.target.value })
                  }
                  placeholder="My WordPress Site"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="url">Site URL</label>
                <input
                  id="url"
                  type="url"
                  value={newSite.url}
                  onChange={(e) =>
                    setNewSite({ ...newSite, url: e.target.value })
                  }
                  placeholder="https://example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="description">Description (optional)</label>
                <textarea
                  id="description"
                  value={newSite.description}
                  onChange={(e) =>
                    setNewSite({ ...newSite, description: e.target.value })
                  }
                  placeholder="Brief description of your site"
                  rows="3"
                />
              </div>
              <button type="submit" className="submit-button">
                Add Site
              </button>
            </form>
          )}

          {sites.length === 0 ? (
            <div className="empty-state">
              <p>No sites yet. Add your first WordPress site to get started!</p>
            </div>
          ) : (
            <div className="sites-grid">
              {sites.map((site) => (
                <div key={site.id} className="site-card">
                  <div className="site-card-header">
                    <h3>{site.name}</h3>
                    <button
                      onClick={() => handleDeleteSite(site.id)}
                      className="delete-button"
                      title="Delete site"
                    >
                      ×
                    </button>
                  </div>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="site-url"
                  >
                    {site.url}
                  </a>
                  {site.description && (
                    <p className="site-description">{site.description}</p>
                  )}
                  <div className="site-meta">
                    <span className="site-date">
                      Added {new Date(site.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
