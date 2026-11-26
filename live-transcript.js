// Keep received text for this session, even when the listener changes languages.
class LiveTranscript {
  constructor(box) {
    this.box = box;
    this.session = '';
    this.lang = '';
    this.channels = new Map();
  }
  select(session, lang) {
    const changed = session && session !== this.session;
    if (changed) {
      this.session = session;
      this.channels.clear();
    }
    if (!changed && lang === this.lang && this.channel) return;
    this.lang = lang;
    if (!this.channels.has(lang)) this.channels.set(lang, {rows: [], ids: new Set()});
    this.channel = this.channels.get(lang);
    const fragment = document.createDocumentFragment();
    for (let i = this.channel.rows.length - 1; i >= 0; i--) fragment.append(this.channel.rows[i]);
    this.box.replaceChildren(fragment);
    this.box.scrollTop = 0;
  }
  add(id, text, className = '') {
    if (!text || (id && this.channel.ids.has(id))) return false;
    if (id) this.channel.ids.add(id);
    const line = document.createElement('p');
    line.textContent = text;
    line.className = className;
    this.channel.rows.push(line);
    const before = this.box.scrollHeight;
    const offset = this.box.scrollTop;
    this.box.prepend(line);
    this.box.scrollTop = offset > 2 ? offset + this.box.scrollHeight - before : 0;
    return true;
  }
}
