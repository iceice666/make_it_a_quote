const form = document.querySelector('#quoteForm');
const statusEl = document.querySelector('#status');
const previewCanvas = document.querySelector('#previewCanvas');
const previewImage = document.querySelector('#previewImage');
const previewSection = document.querySelector('.preview');
const generateBtn = document.querySelector('#generateBtn');
const contentTextarea = document.querySelector('#content');
const contentCounter = document.querySelector('#content-counter');
const toastContainer = document.querySelector('#toastContainer');

let isProcessing = false;
let latestImageUrl = '';

const MAX_CONTENT_LENGTH = 500;
const graphemeSegmenter =
  typeof Intl !== 'undefined' && 'Segmenter' in Intl
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;
const ZERO_ADVANCE_CHARACTER_REGEX = /[\p{Mark}\p{Default_Ignorable_Code_Point}]/u;

function getGraphemes(text) {
  if (!text) {
    return [];
  }

  if (graphemeSegmenter) {
    return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
  }

  return Array.from(text);
}

function isLineBreakGrapheme(grapheme) {
  return grapheme === '\n' || grapheme === '\r' || grapheme === '\r\n';
}

function hasCountableGlyph(grapheme) {
  if (isLineBreakGrapheme(grapheme)) {
    return true;
  }

  for (const char of grapheme) {
    if (!ZERO_ADVANCE_CHARACTER_REGEX.test(char)) {
      return true;
    }
  }

  return false;
}

function countDisplayCharacters(text) {
  let count = 0;

  for (const grapheme of getGraphemes(text)) {
    if (hasCountableGlyph(grapheme)) {
      count += 1;
    }
  }

  return count;
}

function showToast(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');

  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 20 20" fill="var(--success)"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>`,
    error: `<svg class="toast-icon" viewBox="0 0 20 20" fill="var(--error)"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 20 20" fill="var(--warning)"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>`,
    info: `<svg class="toast-icon" viewBox="0 0 20 20" fill="var(--muted)"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
  };

  toast.innerHTML = `
    ${icons[type] || icons.info}
    <span>${message}</span>
    <button class="toast-close" aria-label="Close notification">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/></svg>
    </button>
  `;

  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => dismissToast(toast));

  toastContainer.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => dismissToast(toast), duration);
  }
}

function dismissToast(toast) {
  if (toast.classList.contains('toast-exit')) return;
  toast.classList.add('toast-exit');
  toast.addEventListener('animationend', () => toast.remove(), { once: true });
  setTimeout(() => toast.remove(), 300);
}

function setStatus(message, type = 'info') {
  statusEl.textContent = message;
  statusEl.className = '';
  if (type === 'error') statusEl.classList.add('error');
  if (type === 'success') statusEl.classList.add('success');
}

function setProcessing(processing) {
  isProcessing = processing;
  form.classList.toggle('processing', processing);
  generateBtn.disabled = processing;
  const spinner = generateBtn.querySelector('.spinner');
  const btnText = generateBtn.querySelector('.btn-text');
  spinner.classList.toggle('visible', processing);
  btnText.textContent = processing ? 'Rendering...' : 'Render Image';

  if (processing) {
  }
}

function updateCharCounter() {
  const length = countDisplayCharacters(contentTextarea.value);
  contentCounter.textContent = `${length} / ${MAX_CONTENT_LENGTH} visible`;
  contentCounter.className = 'char-counter';
  if (length >= MAX_CONTENT_LENGTH) {
    contentCounter.classList.add('error');
  } else if (length >= MAX_CONTENT_LENGTH * 0.9) {
    contentCounter.classList.add('warn');
  }
}

contentTextarea.addEventListener('input', updateCharCounter);
updateCharCounter();

function resetPreview() {
  previewCanvas.dataset.ready = '';
  previewImage.removeAttribute('src');
  previewImage.alt = '';
  previewSection.classList.remove('has-content');
}

function revokeLatestImageUrl() {
  if (!latestImageUrl) return;
  URL.revokeObjectURL(latestImageUrl);
  latestImageUrl = '';
}

function setPreviewImage(blob, payload) {
  revokeLatestImageUrl();
  latestImageUrl = URL.createObjectURL(blob);

  previewImage.src = latestImageUrl;
  previewImage.alt = `Rendered quote image for Discord ID ${payload.discordId}`;
  previewCanvas.dataset.ready = 'true';
  previewSection.classList.add('has-content');
}

async function generateQuoteImage(payload) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorJson = await response.json();
      if (errorJson?.detail) {
        message = errorJson.detail;
      } else if (errorJson?.error) {
        message = errorJson.error;
      }
    } catch {
      // ignored
    }
    throw new Error(message);
  }

  return response.blob();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (isProcessing) return;

  const formData = new FormData(form);
  const payload = {
    discordId: String(formData.get('discordId') || '').trim(),
    displayName: String(formData.get('displayName') || '').trim(),
    attributionSuffix: String(formData.get('attributionSuffix') || '').trim(),
    content: String(formData.get('content') || '').trim(),
    template: String(formData.get('template') || 'left-half').trim(),
    monospace: formData.get('monospace') === 'on',
  };
  const contentLength = countDisplayCharacters(payload.content);

  if (!payload.discordId) {
    setStatus('Please enter a Discord ID.', 'error');
    showToast('Discord ID is required.', 'error');
    document.querySelector('#discordId').focus();
    return;
  }

  if (!/^[0-9]{17,20}$/.test(payload.discordId)) {
    setStatus('Discord ID must be 17-20 digits.', 'error');
    showToast('Invalid Discord ID format.', 'error');
    document.querySelector('#discordId').focus();
    return;
  }

  if (contentLength === 0) {
    setStatus('Please enter quote content.', 'error');
    showToast('Quote content needs at least one visible character.', 'error');
    contentTextarea.focus();
    return;
  }

  if (contentLength > MAX_CONTENT_LENGTH) {
    setStatus(`Quote content must be ${MAX_CONTENT_LENGTH} visible characters or fewer.`, 'error');
    showToast(`Quote content exceeds the ${MAX_CONTENT_LENGTH}-character visible limit.`, 'error');
    contentTextarea.focus();
    return;
  }

  setProcessing(true);
  setStatus('Rendering image...');
  resetPreview();

  try {
    const imageBlob = await generateQuoteImage(payload);
    setPreviewImage(imageBlob, payload);
    setStatus('Rendered image ready.', 'success');
    showToast('Quote image generated!', 'success');

    previewCanvas.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    resetPreview();
    const message = error instanceof Error ? error.message : 'Failed to render image';
    setStatus(message, 'error');
    showToast(message, 'error');
  } finally {
    setProcessing(false);
  }
});

document.querySelectorAll('input, textarea, select').forEach((input) => {
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault();
      const formElements = Array.from(form.querySelectorAll('input, textarea, select, button'));
      const currentIndex = formElements.indexOf(e.target);
      const nextElement = formElements[currentIndex + 1];
      if (nextElement) {
        nextElement.focus();
      }
    }
  });
});

window.addEventListener('beforeunload', revokeLatestImageUrl);
