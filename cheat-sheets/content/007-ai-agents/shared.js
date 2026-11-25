// Shared by every page in 007-ai-agents

// Follow the site's theme if it changes in another tab
addEventListener('storage', e => {
  if (e.key === 'mn-theme') document.documentElement.setAttribute('data-theme', e.newValue || 'light');
});

const $ = id => document.getElementById(id);

// A row of choice buttons; pick(i) runs when one is chosen
function buttons(host, labels, pick) {
  labels.forEach((text, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = text;
    b.setAttribute('aria-pressed', 'false');
    b.onclick = () => {
      [...host.children].forEach(x => x.setAttribute('aria-pressed', x === b));
      pick(i);
    };
    host.append(b);
  });
}

// gates: [icon, label]; states: [class, text], class is pass | stop | wait | skip
function drawGates(gates, states) {
  $('gates').innerHTML = gates.map(([icon, label], n) =>
    `<li class="gate ${states[n][0]}" style="--n:${n}"><i class="fas ${icon}"></i><b>${label}</b><span class="st">${states[n][1]}</span></li>`
  ).join('');
}

// Result line; a fresh node restarts the fade-in. kind: pass | stop | wait, icon optional
function drawOut(kind, text, icon) {
  icon = icon || {pass: 'fa-circle-check', stop: 'fa-rotate-left', wait: 'fa-user-clock'}[kind];
  const out = $('out').cloneNode(false);
  out.className = 'out ' + kind;
  out.innerHTML = `<i class="fas ${icon}"></i><span>${text}</span>`;
  $('out').replaceWith(out);
}
