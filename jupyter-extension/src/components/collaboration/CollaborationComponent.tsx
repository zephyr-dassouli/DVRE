import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useProjects, ProjectInfo } from '../../hooks/useProjects';
import ProjectCreationHub from './ProjectCreationHub';
import ProjectList from './ProjectList';
import ProjectDetails from './ProjectDetails';
import JoinProjectDialog from './JoinProjectDialog';

type ViewMode = 'main' | 'create' | 'details' | 'join';

interface CollaborationComponentProps {
  title?: string;
}

export const CollaborationComponent: React.FC<CollaborationComponentProps> = ({ 
  title = 'Project Collaboration' 
}) => {
  const { account } = useAuth();
  const { projects, userProjects, loading, error, requestToJoinProject, getProjectRoles, loadProjects } = useProjects();
  const [viewMode, setViewMode] = useState<ViewMode>('main');
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [projectToJoin, setProjectToJoin] = useState<ProjectInfo | null>(null);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [joinLoading, setJoinLoading] = useState(false);

  const handleSelectProject = async (project: ProjectInfo) => {
    if (project.isMember) {
      // User is already a member, show project details
      setSelectedProject(project.address);
      setViewMode('details');
    } else if (project.hasPendingRequest) {
      // User has a pending request, show a message
      alert('You already have a pending join request for this project. Please wait for the project creator to review your request.');
    } else {
      // User is not a member and has no pending request, load available roles and show join dialog
      setProjectToJoin(project);
      try {
        const roles = await getProjectRoles(project.address);
        setAvailableRoles(roles);
      } catch (err) {
        console.error('Failed to load project roles:', err);
        setAvailableRoles([]);
      }
      setViewMode('join');
    }
  };

  const handleJoinProject = async (role: string): Promise<boolean> => {
    if (!projectToJoin) return false;
    
    setJoinLoading(true);
    try {
      const success = await requestToJoinProject(projectToJoin.address, role);
      if (success) {
        // Successfully submitted join request
        alert(`Join request submitted successfully! The project creator will review your request to join as "${role}".`);
        console.log('Successfully submitted join request');
        return true;
      }
      return false;
    } catch (err) {
      console.error('Failed to submit join request:', err);
      return false;
    } finally {
      setJoinLoading(false);
    }
  };

  const handleBackToMain = () => {
    setViewMode('main');
    setSelectedProject(null);
    setProjectToJoin(null);
    setAvailableRoles([]);
    setJoinLoading(false);
  };

  const handleRefreshProjects = async () => {
    try {
      await loadProjects();
    } catch (error) {
      console.error('Failed to refresh projects:', error);
    }
  };

  if (!account) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem',
          color: 'var(--jp-ui-font-color1)',
          margin: '0 0 16px 0'
        }}        >
          Project Collaboration
        </h1>
        <p style={{ 
          color: 'var(--jp-ui-font-color2)'
        }}>
          Please connect your wallet to access project collaboration features.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        padding: '20px', 
        textAlign: 'center',
        color: 'var(--jp-error-color1)'
      }}>
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (viewMode === 'join' && projectToJoin) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <JoinProjectDialog
          project={projectToJoin}
          availableRoles={availableRoles}
          onJoin={handleJoinProject}
          onCancel={handleBackToMain}
          loading={joinLoading}
        />
      </div>
    );
  }

  if (viewMode === 'details' && selectedProject) {
    return (
      <div style={{ 
        padding: '20px', 
        fontFamily: 'var(--jp-ui-font-family)',
        background: 'var(--jp-layout-color1)',
        minHeight: '400px'
      }}>
        <ProjectDetails 
          projectAddress={selectedProject}
          onBack={handleBackToMain}
          onMembershipChange={handleRefreshProjects}
        />
      </div>
    );
  }

  const handleProjectCreationSuccess = () => {
    setViewMode('main');
    handleRefreshProjects();
  };

  if (viewMode === 'create') {
    return (
      <ProjectCreationHub 
        onBack={handleBackToMain}
        onSuccess={handleProjectCreationSuccess}
      />
    );
  }

  return (
    <div style={{ 
      padding: '20px', 
      fontFamily: 'var(--jp-ui-font-family)',
      background: 'var(--jp-layout-color1)',
      minHeight: '400px'
    }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h1 style={{ 
          fontSize: '1.5rem',
          color: 'var(--jp-ui-font-color1)',
          margin: 0
        }}        >
          Project Collaboration
        </h1>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleRefreshProjects}
            disabled={loading}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-layout-color2)',
              border: '1px solid var(--jp-border-color1)',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: 'var(--jp-ui-font-color1)',
              fontSize: '13px',
              opacity: loading ? 0.6 : 1
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={() => setViewMode('create')}
            style={{
              padding: '8px 16px',
              background: 'var(--jp-brand-color1)',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            + New Project
          </button>
        </div>
      </div>

      <div style={{ 
        display: 'flex', 
        gap: '20px',
        flexWrap: 'wrap'
      }}>
        <ProjectList
          projects={userProjects}
          title="My Projects"
          onSelectProject={handleSelectProject}
          loading={loading}
        />
        
        <ProjectList
          projects={projects.filter(p => !p.isMember)}
          title="Available Projects"
          onSelectProject={handleSelectProject}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default CollaborationComponent;