// ─── SudoCode shadcn Interactive Scripts ───────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Lucide Icons
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  // 2. Setup Copy Handlers
  setupCopyInteractions();

  // 3. Start Terminal Simulator
  startTerminalSimulation();

  // 4. Replay Handler
  const replayBtn = document.getElementById('btn-replay-demo');
  if (replayBtn) {
    replayBtn.addEventListener('click', () => {
      startTerminalSimulation();
    });
  }
});

// ─── Clipboard Copy Handlers ────────────────────────────────────────────────

function setupCopyInteractions() {
  const mainInstallBtn = document.getElementById('btn-copy-install');
  const ctaCopyBtn = document.getElementById('btn-cta-copy');
  const stepCopyBtns = document.querySelectorAll('.step-copy-btn');

  const executeCopy = (text, btnElement) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast(`Copied "${text}" to clipboard`);
      
      // Temporary checkmark feedback
      if (btnElement) {
        btnElement.classList.add('copied');
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = `<i data-lucide="check" class="icon-xs" style="color: #34D399;"></i> <span>Copied!</span>`;
        if (window.lucide) window.lucide.createIcons();

        setTimeout(() => {
          btnElement.innerHTML = originalHtml;
          btnElement.classList.remove('copied');
          if (window.lucide) window.lucide.createIcons();
        }, 1800);
      }
    }).catch(() => {
      showToast('Copied to clipboard');
    });
  };

  if (mainInstallBtn) {
    mainInstallBtn.addEventListener('click', () => {
      executeCopy('npx sudocode-ai', mainInstallBtn);
    });
  }

  if (ctaCopyBtn) {
    ctaCopyBtn.addEventListener('click', () => {
      executeCopy('npx sudocode-ai', ctaCopyBtn);
    });
  }

  stepCopyBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const copyVal = btn.getAttribute('data-copy') || 'npx sudocode-ai';
      executeCopy(copyVal, btn);
    });
  });
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-message');
  if (!toast) return;

  if (msgEl) msgEl.textContent = msg;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 2200);
}

// ─── Terminal Simulator (Claude Code Realtime Flow) ─────────────────────────

const STARBURST_FRAMES = ['·', '⋄', '◇', '◈', '◆', '◈', '◇', '⋄'];

function startTerminalSimulation() {
  const streamArea = document.getElementById('term-stream-area');
  if (!streamArea) return;

  streamArea.innerHTML = '';

  // Prompt Row
  const promptRow = document.createElement('div');
  promptRow.className = 'prompt-line';
  promptRow.innerHTML = `
    <span class="prompt-ws">sudocode</span>
    <span class="prompt-git">(main)</span>
    <span class="prompt-chevron">❯</span>
    <span class="prompt-input" id="typewriter-target"></span>
  `;
  streamArea.appendChild(promptRow);

  const inputEl = document.getElementById('typewriter-target');
  const demoCommand = 'refactor auth handler and verify with tests';

  // Typewriter effect
  typeText(inputEl, demoCommand, 26, () => {
    // Show thinking spinner after prompt finished
    setTimeout(() => {
      const thinkingRow = document.createElement('div');
      thinkingRow.className = 'thinking-line';
      thinkingRow.id = 'thinking-spinner-row';
      thinkingRow.innerHTML = `
        <span class="starburst-icon" id="burst-glyph">◈</span>
        <span>Thinking... <span class="muted-text" id="burst-timer">(0.0s)</span></span>
      `;
      streamArea.appendChild(thinkingRow);

      let frame = 0;
      let startTime = Date.now();
      const spinnerInterval = setInterval(() => {
        frame = (frame + 1) % STARBURST_FRAMES.length;
        const glyph = document.getElementById('burst-glyph');
        const timer = document.getElementById('burst-timer');
        if (glyph) glyph.textContent = STARBURST_FRAMES[frame];
        if (timer) {
          const sec = ((Date.now() - startTime) / 1000).toFixed(1);
          timer.textContent = `(${sec}s)`;
        }
      }, 85);

      // Transition to tool executions after 1.3s
      setTimeout(() => {
        clearInterval(spinnerInterval);
        const spinner = document.getElementById('thinking-spinner-row');
        if (spinner) spinner.remove();

        renderToolsFlow(streamArea);
      }, 1300);
    }, 250);
  });
}

function typeText(element, text, speed, onDone) {
  let idx = 0;
  element.textContent = '';
  const timer = setInterval(() => {
    if (idx < text.length) {
      element.textContent += text.charAt(idx);
      idx++;
    } else {
      clearInterval(timer);
      if (onDone) onDone();
    }
  }, speed);
}

function renderToolsFlow(container) {
  const tools = [
    {
      name: 'Read',
      arg: 'src/auth.ts',
      time: '0.1s',
      summary: 'Read 142 lines (5.1 KB)'
    },
    {
      name: 'Edit',
      arg: 'src/auth.ts',
      time: '0.2s',
      summary: 'Added token expiration & error verification'
    },
    {
      name: 'Bash',
      arg: 'npm test',
      time: '0.7s',
      summary: '✔ 4 tests passed, 0 failed (auth.test.ts)'
    }
  ];

  let cumulativeDelay = 0;

  tools.forEach((t, i) => {
    setTimeout(() => {
      const toolBox = document.createElement('div');
      toolBox.className = 'tool-line-block';
      toolBox.innerHTML = `
        <div class="tool-name-line">
          <span class="tool-dot">●</span>
          <span>${t.name}(<span class="cyan-text">${t.arg}</span>)</span>
          <span class="muted-text">(${t.time})</span>
        </div>
        <div class="tool-output-line">
          <span class="tree-branch">⎿</span>  ${t.summary}
        </div>
      `;
      container.appendChild(toolBox);

      const terminalScreen = document.getElementById('terminal-screen');
      if (terminalScreen) terminalScreen.scrollTop = terminalScreen.scrollHeight;

      // When last tool completes
      if (i === tools.length - 1) {
        setTimeout(() => {
          const footer = document.createElement('div');
          footer.className = 'terminal-turn-footer';
          footer.innerHTML = `
            <span class="footer-burst">◈</span> SudoCode completed in <span style="color: #FAFAFA; font-weight: 500;">2.1s</span> · <span class="coral-text">3 tools</span> executed
          `;
          container.appendChild(footer);

          // Subsequent prompt
          const nextPrompt = document.createElement('div');
          nextPrompt.className = 'prompt-line';
          nextPrompt.style.marginTop = '10px';
          nextPrompt.innerHTML = `
            <span class="prompt-ws">sudocode</span>
            <span class="prompt-git">(main)</span>
            <span class="prompt-chevron">❯</span>
            <span style="color: #71717A;">█</span>
          `;
          container.appendChild(nextPrompt);

          if (terminalScreen) terminalScreen.scrollTop = terminalScreen.scrollHeight;
        }, 450);
      }
    }, cumulativeDelay);

    cumulativeDelay += 500;
  });
}
