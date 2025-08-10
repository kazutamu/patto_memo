import { useState, useEffect } from 'react';
import { MotionEvent, MotionEventCreate, MotionSettings } from './types';
import { api } from './api';

function App() {
  const [events, setEvents] = useState<MotionEvent[]>([]);
  const [settings, setSettings] = useState<MotionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state for creating new events
  const [newEvent, setNewEvent] = useState<MotionEventCreate>({
    confidence: 0.8,
    duration: 1.0,
    description: '',
  });
  const [creating, setCreating] = useState(false);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [eventsData, settingsData] = await Promise.all([
        api.getMotionEvents(),
        api.getMotionSettings(),
      ]);
      
      setEvents(eventsData);
      setSettings(settingsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setCreating(true);
      const createdEvent = await api.createMotionEvent(newEvent);
      
      // Add the new event to the list
      setEvents(prev => [...prev, createdEvent]);
      
      // Reset form
      setNewEvent({
        confidence: 0.8,
        duration: 1.0,
        description: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event');
    } finally {
      setCreating(false);
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>Motion Detector Dashboard</h1>
      
      {error && (
        <div style={{ 
          background: '#ffebee', 
          color: '#c62828', 
          padding: '10px', 
          borderRadius: '4px',
          marginBottom: '20px' 
        }}>
          Error: {error}
        </div>
      )}

      {/* Settings Section */}
      {settings && (
        <div style={{ marginBottom: '30px' }}>
          <h2>Current Settings</h2>
          <div style={{ 
            background: '#f5f5f5', 
            padding: '15px', 
            borderRadius: '4px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '10px'
          }}>
            <div>Detection Enabled: <strong>{settings.detection_enabled ? 'Yes' : 'No'}</strong></div>
            <div>Sensitivity: <strong>{settings.sensitivity}</strong></div>
            <div>Min Confidence: <strong>{settings.min_confidence}</strong></div>
            <div>Recording: <strong>{settings.recording_enabled ? 'Yes' : 'No'}</strong></div>
            <div>Alerts: <strong>{settings.alert_notifications ? 'Yes' : 'No'}</strong></div>
          </div>
        </div>
      )}

      {/* Create Event Form */}
      <div style={{ marginBottom: '30px' }}>
        <h2>Create Motion Event</h2>
        <form onSubmit={handleCreateEvent} style={{ 
          background: '#f9f9f9', 
          padding: '20px', 
          borderRadius: '4px',
          display: 'grid',
          gap: '15px',
          maxWidth: '400px'
        }}>
          <div>
            <label htmlFor="confidence" style={{ display: 'block', marginBottom: '5px' }}>
              Confidence (0.0 - 1.0):
            </label>
            <input
              id="confidence"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={newEvent.confidence}
              onChange={(e) => setNewEvent(prev => ({ 
                ...prev, 
                confidence: parseFloat(e.target.value) || 0 
              }))}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="duration" style={{ display: 'block', marginBottom: '5px' }}>
              Duration (seconds):
            </label>
            <input
              id="duration"
              type="number"
              min="0"
              step="0.1"
              value={newEvent.duration}
              onChange={(e) => setNewEvent(prev => ({ 
                ...prev, 
                duration: parseFloat(e.target.value) || 0 
              }))}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              required
            />
          </div>
          
          <div>
            <label htmlFor="description" style={{ display: 'block', marginBottom: '5px' }}>
              Description:
            </label>
            <input
              id="description"
              type="text"
              value={newEvent.description}
              onChange={(e) => setNewEvent(prev => ({ 
                ...prev, 
                description: e.target.value 
              }))}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              placeholder="Optional description"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={creating}
            style={{ 
              padding: '10px 20px', 
              backgroundColor: creating ? '#ccc' : '#007bff', 
              color: 'white', 
              border: 'none', 
              borderRadius: '4px',
              cursor: creating ? 'not-allowed' : 'pointer'
            }}
          >
            {creating ? 'Creating...' : 'Create Event'}
          </button>
        </form>
      </div>

      {/* Events List */}
      <div>
        <h2>Motion Events ({events.length})</h2>
        <button 
          onClick={loadData}
          style={{ 
            marginBottom: '15px',
            padding: '8px 16px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
        
        {events.length === 0 ? (
          <p>No motion events found.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {events.map((event) => (
              <div 
                key={event.id} 
                style={{ 
                  border: '1px solid #ddd', 
                  padding: '15px', 
                  borderRadius: '4px',
                  backgroundColor: 'white'
                }}
              >
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                  <div><strong>ID:</strong> {event.id}</div>
                  <div><strong>Confidence:</strong> {(event.confidence * 100).toFixed(1)}%</div>
                  <div><strong>Duration:</strong> {event.duration}s</div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Time:</strong> {formatTimestamp(event.timestamp)}
                  </div>
                  {event.description && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <strong>Description:</strong> {event.description}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;