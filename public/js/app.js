'use strict';

/**
 * Asset Forge — Main App Module
 * View routing, navigation/menu system, state management
 */
window.App = (function() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const state = {
    currentView: 'project-list',  // 'project-list' | 'workspace'
    currentTab: 'generate',       // 'generate' | 'library' | 'palette'
    currentProject: null,         // full project object or null
    generatedSprite: null,        // transient generated sprite (not yet saved)
    parentSprite: null,           // parent sprite for iteration
  };

  // ---------------------------------------------------------------------------
  // DOM References
  // ---------------------------------------------------------------------------
  let appContent, workspaceNav, breadcrumb, tabs;

  function init() {
    appContent = document.getElementById('app-content');
    workspaceNav = document.getElementById('workspace-nav');
    breadcrumb = document.getElementById('breadcrumb');

    // Tab navigation
    tabs = workspaceNav.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;
        switchTab(tabName);
      });
    });

    // Home buttons
    document.getElementById('home-btn').addEventListener('click', (e) => {
      e.preventDefault();
      navigateToProjectList();
    });
    document.getElementById('home-btn-alt').addEventListener('click', () => {
      navigateToProjectList();
    });

    // Start on project list
    navigateToProjectList();
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function navigateToProjectList() {
    state.currentView = 'project-list';
    state.currentProject = null;
    state.generatedSprite = null;
    state.parentSprite = null;

    workspaceNav.hidden = true;
    breadcrumb.innerHTML = '<span class="breadcrumb-item breadcrumb-home">Home</span>';

    if (window.ProjectList) {
      window.ProjectList.render(appContent);
    }
  }

  function navigateToWorkspace(project) {
    state.currentView = 'workspace';
    state.currentProject = project;
    state.generatedSprite = null;
    state.parentSprite = null;

    workspaceNav.hidden = false;
    breadcrumb.innerHTML =
      '<span class="breadcrumb-item breadcrumb-home breadcrumb-link" id="breadcrumb-home">Home</span>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<span class="breadcrumb-item breadcrumb-project">' + escapeHtml(project.name) + '</span>';

    document.getElementById('breadcrumb-home').addEventListener('click', () => {
      navigateToProjectList();
    });

    switchTab('generate');
  }

  function switchTab(tabName) {
    state.currentTab = tabName;

    // Update active tab
    tabs.forEach(tab => {
      if (tab.dataset.tab === tabName) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // Render the tab content
    renderCurrentTab();
  }

  function renderCurrentTab() {
    if (!state.currentProject) return;

    switch (state.currentTab) {
      case 'generate':
        if (window.SpriteGen) {
          window.SpriteGen.render(appContent, state.currentProject, state.parentSprite);
        }
        break;
      case 'library':
        if (window.Library) {
          window.Library.render(appContent, state.currentProject);
        }
        break;
      case 'palette':
        if (window.PaletteEditor) {
          window.PaletteEditor.render(appContent, state.currentProject);
        }
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Actions (called by components)
  // ---------------------------------------------------------------------------

  function selectProject(project) {
    navigateToWorkspace(project);
  }

  function updateProject(project) {
    state.currentProject = project;
  }

  function startVariation(parentSprite) {
    state.parentSprite = parentSprite;
    switchTab('generate');
  }

  function clearParentSprite() {
    state.parentSprite = null;
  }

  function refreshLibrary() {
    if (state.currentTab === 'library') {
      renderCurrentTab();
    }
  }

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-fade');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function getState() {
    return { ...state };
  }

  // ---------------------------------------------------------------------------
  // Init on DOM ready
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);

  return {
    selectProject,
    updateProject,
    startVariation,
    clearParentSprite,
    refreshLibrary,
    navigateToProjectList,
    switchTab,
    showToast,
    getState,
    escapeHtml,
  };
})();
