import { readFile, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

// Reuse the browser renderer so the first paint and JSON stay in sync.
export async function initialHTML(data) {
  const source = await readFile('js/content.js', 'utf8');
  const hero = { innerHTML: '', setAttribute() {} };
  const context = vm.createContext({ document: { querySelector: () => hero } });
  vm.runInContext(source.split('window.portfolioContentReady =')[0], context);
  context.payload = data;
  vm.runInContext('renderHero(payload.hero, payload.chrome)', context);
  const copy = data.ui.initial;
  const email = data.contact.email.address;
  const projects = data.work.items.filter(item => item.href);
  const access = `<div class="static-access" role="region" aria-label="${escape(copy.label)}"><div class="section-inner"><h2>${escape(copy.title)}</h2><ul>${projects.map(item => `<li><a href="${escape(item.href)}">${escape(item.title)}</a></li>`).join('')}</ul><p><a href="mailto:${escape(email)}">${escape(email)}</a></p><p>${escape(copy.note)}</p></div></div>`;
  return { hero: hero.innerHTML, access };
}

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const tags = list => list?.length ? `<ul class="wp-tags" aria-label="Technologies used">${list.map(tag => `<li>${escape(tag)}</li>`).join('')}</ul>` : '';

// The full Work page (work.html): every project with its notes open,
// then the systems that have no public link. Plain HTML, no JS needed.
export function workPageHTML(work) {
  const page = work.page || {};
  const visit = work.viewer?.visit || 'Visit live site';
  // Same order as the homepage carousel: the featured project first.
  const live = work.items.filter(item => item.href)
    .sort((a, b) => (b.title === work.viewer?.defaultProject) - (a.title === work.viewer?.defaultProject));
  const archive = work.items.filter(item => !item.href);
  const project = item => `<article class="wp-project">
      ${item.image?.src ? `<a class="wp-shot" href="${escape(item.href)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true"><img src="${escape(item.image.src)}" alt="" width="${escape(item.image.width)}" height="${escape(item.image.height)}" loading="lazy" decoding="async"></a>` : ''}
      <div class="wp-body">
        <h3>${escape(item.title)}</h3>
        ${item.status ? `<p class="wp-status">${escape(item.status)}</p>` : ''}
        <p class="wp-summary">${escape(item.summary)}</p>
        ${item.caseStudy?.length ? `<dl class="wp-case">${item.caseStudy.map(row => `<div><dt>${escape(row.label)}</dt><dd>${escape(row.text)}</dd></div>`).join('')}</dl>` : ''}
        <div class="wp-meta">${tags(item.tags)}<a class="wp-visit" href="${escape(item.href)}" target="_blank" rel="noopener noreferrer">${escape(item.visitLabel || visit)} &#8599;<span class="sr-only"> (${escape(item.title)})</span></a></div>
      </div>
    </article>`;
  return `${pageHead(page)}
    ${pageSection('wp-live', page.liveHeading, live.length, live.map(project).join(''))}
    ${archive.length ? pageSection('wp-archive', work.viewer?.archiveTitle, archive.length, `<ul class="wp-archive">${archive.map(item => `<li><h3>${escape(item.title)}</h3><p>${escape(item.summary)}</p>${tags(item.tags)}</li>`).join('')}</ul>`) : ''}`;
}

const pageHead = page => `<header class="wp-head"><h1>${escape(page.title)}</h1><p>${escape(page.intro)}</p></header>`;

// A section opens with a small mono label and its count.
const pageSection = (id, heading, count, body) => `<section aria-labelledby="${id}"><h2 class="wp-heading" id="${id}">${escape(heading)}${count ? ` <span>${count}</span>` : ''}</h2>${body}</section>`;

const image = (src, width, height) => `<img src="${escape(src)}" alt="" width="${escape(width)}" height="${escape(height)}" loading="lazy" decoding="async">`;

// The full Edits page (edits.html): client numbers, every edit linking
// to its post, and the AI hooks as players that load only when played.
export function editsPageHTML(edits) {
  const page = edits.page || {};
  const delivery = edits.delivery?.items || [];
  const hooks = edits.hooks?.items || [];
  const edit = item => `<li class="ep-card"><a href="${escape(item.href)}" target="_blank" rel="noopener noreferrer">
      <span class="ep-media">${image(item.image, item.imageWidth, item.imageHeight)}${item.badge ? `<span class="ep-badge">${escape(item.badge)}</span>` : ''}</span>
      <span class="ep-title">${escape(item.title)}</span>
      <span class="ep-meta">${escape(page.watchLabel)} ${escape(item.platform)} &#8599;</span>
    </a></li>`;
  const hook = item => `<li class="ep-card">
      <span class="ep-media"><video controls playsinline preload="none" poster="${escape(item.image)}" width="${escape(item.imageWidth)}" height="${escape(item.imageHeight)}" aria-label="${escape(item.alt || item.title)}"><source src="${escape(item.video)}" type="video/mp4"></video>${item.badge ? `<span class="ep-badge">${escape(item.badge)}</span>` : ''}</span>
      <span class="ep-title">${escape(item.title)}</span>
      <span class="ep-meta">${escape(edits.hooks.platform)}</span>
    </li>`;
  return `${pageHead(page)}
    ${delivery.length ? `<dl class="ep-delivery" aria-label="${escape(edits.delivery.label)}">${delivery.map(item => `<div><dt>${escape(item.label)}</dt><dd>${escape(item.value)}</dd></div>`).join('')}</dl>` : ''}
    ${pageSection('ep-edits', page.editsHeading, edits.items.length, `<ul class="ep-grid">${edits.items.map(edit).join('')}</ul>`)}
    ${hooks.length ? pageSection('ep-hooks', page.hooksHeading, hooks.length, `<ul class="ep-grid ep-grid--square">${hooks.map(hook).join('')}</ul>`) : ''}`;
}

// The full Experience page (experience.html): every role, then
// education, certifications and other work from the resume.
export function experiencePageHTML(experience) {
  const page = experience.page || {};
  const role = item => `<li class="xp-row">
      <p class="xp-period">${escape(item.period)}</p>
      <div>
        <h3>${escape(item.role)}</h3>
        <p class="xp-org">${escape(item.organization)}</p>
        <p class="xp-summary">${escape(item.summary)}</p>
        ${item.link?.href ? `<a class="wp-visit" href="${escape(item.link.href)}" target="_blank" rel="noopener noreferrer">${escape(item.link.label)} &#8599;</a>` : ''}
      </div>
    </li>`;
  const school = page.education;
  return `${pageHead(page)}
    ${pageSection('xp-roles', page.rolesHeading, experience.items.length, `<ul class="xp-list">${experience.items.map(role).join('')}</ul>`)}
    ${school ? pageSection('xp-education', page.educationHeading, 0, `<div class="xp-row"><p class="xp-period">${escape(school.period)}</p><div><h3>${escape(school.degree)}</h3><p class="xp-org">${escape(school.school)}</p>${(school.notes || []).length ? `<ul class="xp-notes">${school.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ul>` : ''}${page.languages ? `<p class="xp-summary">${escape(page.languages)}</p>` : ''}</div></div>`) : ''}
    ${(page.certifications || []).length ? pageSection('xp-certs', page.certificationsHeading, page.certifications.length, `<ul class="xp-certs">${page.certifications.map(cert => `<li><h3>${escape(cert.name)}</h3><p>${escape(cert.issuer)} · ${escape(cert.year)}</p></li>`).join('')}</ul>`) : ''}
    ${(page.more || []).length ? pageSection('xp-more', page.moreHeading, 0, `<ul class="xp-list">${page.more.map(role).join('')}</ul>`) : ''}`;
}

// Each full page and the generator that fills its markers.
export const FULL_PAGES = [
  { file: 'work.html', render: data => workPageHTML(data.work) },
  { file: 'edits.html', render: data => editsPageHTML(data.edits) },
  { file: 'experience.html', render: data => experiencePageHTML(data.experience) }
];

async function fillMarkers(file, prefix, generated) {
  let html = await readFile(file, 'utf8');
  for (const [name, markup] of Object.entries(generated)) {
    const pattern = new RegExp(`<!-- ${prefix}${name}:start -->[\\s\\S]*?<!-- ${prefix}${name}:end -->`);
    if (!pattern.test(html)) throw new Error(`Missing generated HTML markers in ${file}: ${prefix}${name}`);
    html = html.replace(pattern, () => `<!-- ${prefix}${name}:start -->${markup}<!-- ${prefix}${name}:end -->`);
  }
  await writeFile(file, await versionAssets(html));
}

export async function writeInitialHTML(data) {
  await fillMarkers('index.html', 'initial:', await initialHTML(data));
  for (const page of FULL_PAGES) await fillMarkers(page.file, '', { page: page.render(data) });
}

export async function versionAssets(html) {
  const assets = [...new Set([...html.matchAll(/(?:href|src)="((?:css|js|vendor)\/[^"?]+\.(?:css|js))(?:\?v=[^"]*)?"/g)].map(match => match[1]))];
  for (const asset of assets) {
    const digest = createHash('sha256').update(await readFile(asset)).digest('hex').slice(0, 10);
    const escaped = asset.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    html = html.replace(new RegExp(`((?:href|src)=")${escaped}(?:\\?v=[^"]*)?"`, 'g'), `$1${asset}?v=${digest}"`);
  }
  return html;
}
