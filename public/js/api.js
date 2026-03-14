// Asset Forge Service — Browser API Client
// All methods call the server at /api/* using fetch().

(function () {
  async function handleResponse(response) {
    if (response.ok) {
      if (response.status === 204) return;
      return response.json();
    }
    let message;
    try {
      const body = await response.json();
      message = body.error || body.message || response.statusText;
    } catch {
      message = response.statusText;
    }
    throw new Error(message);
  }

  // -- Projects --

  async function getProjects() {
    const res = await fetch('/api/projects');
    return handleResponse(res);
  }

  async function createProject(name, description) {
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    });
    return handleResponse(res);
  }

  async function getProject(id) {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`);
    return handleResponse(res);
  }

  async function deleteProject(id) {
    const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  }

  // -- Palette --

  async function generatePalette(projectId, prompt) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/palette/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      }
    );
    return handleResponse(res);
  }

  async function updatePalette(projectId, palette) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/palette`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ palette }),
      }
    );
    return handleResponse(res);
  }

  // -- Sprites --

  async function getSprites(projectId) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sprites`
    );
    return handleResponse(res);
  }

  async function getSprite(projectId, spriteId) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sprites/${encodeURIComponent(spriteId)}`
    );
    return handleResponse(res);
  }

  async function generateSprite(
    projectId,
    prompt,
    width,
    height,
    useProjectPalette,
    parentId
  ) {
    const body = { prompt, width, height, useProjectPalette };
    if (parentId !== undefined) body.parentId = parentId;
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sprites/generate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    return handleResponse(res);
  }

  async function saveSprite(projectId, spriteData) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sprites`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(spriteData),
      }
    );
    return handleResponse(res);
  }

  async function deleteSprite(projectId, spriteId) {
    const res = await fetch(
      `/api/projects/${encodeURIComponent(projectId)}/sprites/${encodeURIComponent(spriteId)}`,
      { method: 'DELETE' }
    );
    return handleResponse(res);
  }

  // -- Export (URL builders, synchronous) --

  function exportSpriteUrl(projectId, spriteId) {
    return `/api/projects/${encodeURIComponent(projectId)}/sprites/${encodeURIComponent(spriteId)}/export`;
  }

  function exportProjectUrl(projectId) {
    return `/api/projects/${encodeURIComponent(projectId)}/export`;
  }

  // -- Expose on window --

  window.API = {
    getProjects,
    createProject,
    getProject,
    deleteProject,
    generatePalette,
    updatePalette,
    getSprites,
    getSprite,
    generateSprite,
    saveSprite,
    deleteSprite,
    exportSpriteUrl,
    exportProjectUrl,
  };
})();
