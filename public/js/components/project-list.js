// Asset Forge — Project List Component (T019)
// Renders project cards with create/delete, or an empty-state welcome screen.

(function () {
  'use strict';

  /**
   * Render the project list view into the given container element.
   */
  async function render(container) {
    container.innerHTML =
      '<div class="text-center mt-lg"><p class="text-muted">Loading projects...</p></div>';

    let projects;
    try {
      projects = await API.getProjects();
    } catch (err) {
      container.innerHTML = '';
      App.showToast('Failed to load projects: ' + err.message, 'error');
      return;
    }

    if (!projects || projects.length === 0) {
      renderEmptyState(container);
    } else {
      renderProjectGrid(container, projects);
    }
  }

  // ---------------------------------------------------------------------------
  // Empty state — first-time experience
  // ---------------------------------------------------------------------------

  function renderEmptyState(container) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-state-icon">&#9881;</div>' +
        '<h2 class="empty-state-title">Welcome to Asset Forge</h2>' +
        '<p class="empty-state-text">' +
          'Create your first project to start generating pixel-art sprites with AI.' +
        '</p>' +
      '</div>' +
      '<div class="card" style="max-width:520px;margin:0 auto;">' +
        '<h3 class="card-title mb-md">Create Your First Project</h3>' +
        buildCreateForm() +
      '</div>';

    attachFormHandler(container);
  }

  // ---------------------------------------------------------------------------
  // Grid of existing projects + new-project form
  // ---------------------------------------------------------------------------

  function renderProjectGrid(container, projects) {
    var cardsHtml = '';

    for (var i = 0; i < projects.length; i++) {
      cardsHtml += buildProjectCard(projects[i]);
    }

    container.innerHTML =
      '<div class="section-header">' +
        '<h2 class="section-title">Your Projects</h2>' +
      '</div>' +
      '<div class="project-list">' +
        cardsHtml +
        '<div class="card project-card-new" id="pl-new-toggle">' +
          '<div class="project-card-new-icon">+</div>' +
          '<span>New Project</span>' +
        '</div>' +
      '</div>' +
      '<div id="pl-create-form-wrapper" class="card mt-lg" style="max-width:520px;display:none;">' +
        '<div class="card-header">' +
          '<h3 class="card-title">New Project</h3>' +
          '<button class="btn btn-small btn-ghost" id="pl-cancel-new">&times; Cancel</button>' +
        '</div>' +
        buildCreateForm() +
      '</div>';

    // Attach card click handlers
    var cards = container.querySelectorAll('[data-project-id]');
    cards.forEach(function (card) {
      var selectBtn = card.querySelector('.pl-select-btn');
      var deleteBtn = card.querySelector('.pl-delete-btn');

      // Clicking the card (or Select button) selects the project
      selectBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        selectById(card.dataset.projectId);
      });

      card.addEventListener('click', function () {
        selectById(card.dataset.projectId);
      });

      // Delete button
      deleteBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        handleDelete(card.dataset.projectId, card.dataset.projectName);
      });
    });

    // Toggle create form
    var toggleBtn = document.getElementById('pl-new-toggle');
    var formWrapper = document.getElementById('pl-create-form-wrapper');
    var cancelBtn = document.getElementById('pl-cancel-new');

    toggleBtn.addEventListener('click', function () {
      formWrapper.style.display = '';
      formWrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    cancelBtn.addEventListener('click', function () {
      formWrapper.style.display = 'none';
    });

    attachFormHandler(container);
  }

  // ---------------------------------------------------------------------------
  // Reusable create-project form HTML
  // ---------------------------------------------------------------------------

  function buildCreateForm() {
    return (
      '<form id="pl-create-form">' +
        '<div class="form-group">' +
          '<label class="form-label" for="pl-name">Project Name</label>' +
          '<input class="form-input" type="text" id="pl-name" placeholder="Tank Game" required>' +
        '</div>' +
        '<div class="form-group">' +
          '<label class="form-label" for="pl-desc">Description</label>' +
          '<textarea class="form-textarea" id="pl-desc" ' +
            'placeholder="a top-down tank battle game with desert and jungle maps" required></textarea>' +
          '<p class="form-hint">Describe your game so the AI can generate a fitting color palette.</p>' +
        '</div>' +
        '<button class="btn btn-primary" type="submit" id="pl-submit-btn">Create Project</button>' +
      '</form>'
    );
  }

  // ---------------------------------------------------------------------------
  // Project card HTML
  // ---------------------------------------------------------------------------

  function buildProjectCard(project) {
    var dateStr = '';
    if (project.createdAt) {
      try {
        dateStr = new Date(project.createdAt).toLocaleDateString();
      } catch (_) {
        dateStr = project.createdAt;
      }
    }

    return (
      '<div class="card project-card" data-project-id="' + App.escapeHtml(project.id) + '" ' +
        'data-project-name="' + App.escapeHtml(project.name) + '">' +
        '<div class="card-header">' +
          '<h3 class="card-title">' + App.escapeHtml(project.name) + '</h3>' +
          '<button class="btn btn-small btn-danger pl-delete-btn" title="Delete project">' +
            '&#128465;' +
          '</button>' +
        '</div>' +
        (project.description
          ? '<p class="project-card-description">' + App.escapeHtml(project.description) + '</p>'
          : '') +
        '<div class="project-card-footer">' +
          '<span>' + (dateStr ? 'Created ' + App.escapeHtml(dateStr) : '') + '</span>' +
          '<button class="btn btn-small btn-secondary pl-select-btn">Select</button>' +
        '</div>' +
      '</div>'
    );
  }

  // ---------------------------------------------------------------------------
  // Form submit handler
  // ---------------------------------------------------------------------------

  function attachFormHandler(container) {
    var form = container.querySelector('#pl-create-form');
    if (!form) return;

    form.addEventListener('submit', async function (e) {
      e.preventDefault();

      var nameInput = document.getElementById('pl-name');
      var descInput = document.getElementById('pl-desc');
      var submitBtn = document.getElementById('pl-submit-btn');

      var name = nameInput.value.trim();
      var description = descInput.value.trim();

      if (!name) {
        App.showToast('Project name is required.', 'warning');
        nameInput.focus();
        return;
      }
      if (!description) {
        App.showToast('Description is required so the AI can generate a palette.', 'warning');
        descInput.focus();
        return;
      }

      // Loading state
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';

      try {
        var project = await API.createProject(name, description);
        App.showToast('Project created!', 'success');
        App.selectProject(project);
      } catch (err) {
        App.showToast('Failed to create project: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Project';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Select helper — fetches the full project then hands off to App
  // ---------------------------------------------------------------------------

  async function selectById(id) {
    try {
      var project = await API.getProject(id);
      App.selectProject(project);
    } catch (err) {
      App.showToast('Failed to load project: ' + err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Delete handler with confirmation
  // ---------------------------------------------------------------------------

  async function handleDelete(id, name) {
    var confirmed = window.confirm(
      'Delete project "' + name + '"? This cannot be undone.'
    );
    if (!confirmed) return;

    try {
      await API.deleteProject(id);
      App.showToast('Project deleted.', 'success');
      // Re-render list
      var appContent = document.getElementById('app-content');
      render(appContent);
    } catch (err) {
      App.showToast('Failed to delete project: ' + err.message, 'error');
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  window.ProjectList = { render: render };
})();
