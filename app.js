/* Steuer-Kompass – Oberfläche: Interview-Schritte, Speicherung, Ergebnis. */
(function () {
  'use strict';

  const SPEICHER = 'steuerkompass.v2';
  const $ = (id) => document.getElementById(id);
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const fmt = (v) => euro.format(v || 0);
  const prozent = (x) => `${(x * 100).toFixed(2).replace('.', ',')} %`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const leerePerson = () => ({ krankengeld: true, kirche: false });
  const leererZustand = () => ({ jahr: 2025, veranlagung: 'single', kistSatz: 9, p: [leerePerson(), leerePerson()], beispiel: false });
  // Erfundene Beispieldaten (Familie Mustermann), damit die App beim ersten Öffnen alle Bereiche zeigt.
  const beispielZustand = () => ({
    jahr: 2025, veranlagung: 'joint', kistSatz: 9, beispiel: true,
    p: [
      { name: 'Max', krankengeld: true, kirche: false, brutto: 62000, lohnsteuer: 9400,
        rvAG: 5766, rvAN: 5766, kv: 5053, pv: 1116, av: 806, km: 18, tage: 200, hoTage: 30, arbeitsmittel: 250 },
      { name: 'Erika', krankengeld: true, kirche: false, brutto: 24000, lohnsteuer: 2900,
        rvAG: 2232, rvAN: 2232, kv: 1956, pv: 432, av: 312, km: 6, tage: 180 },
    ],
    vMiete: 7200, vFlaecheVermietet: 45, vFlaecheGesamt: 180, vAfa: 1200,
    vKosten: [
      { name: 'Schuldzinsen', betrag: 3600, art: 'anteilig' },
      { name: 'Gebäudeversicherung', betrag: 520, art: 'anteilig' },
      { name: 'Grundsteuer', betrag: 380, art: 'anteilig' },
      { name: 'Strom Mietwohnung', betrag: 300, art: 'voll' },
    ],
    kErtraege: 2400, kSteuer: 100, kSoli: 5.5,
    soListe: [{ name: 'Krypto-Börse', erloes: 4200, kosten: 5000 }],
    kinder: 2, kinderbetreuung: 1800, spenden: 150, sonstVers: 240, handwerker: 900,
  });

  // Schritte des Interviews. person: true = Feld gibt es je Person.
  const SCHRITTE = [
    {
      id: 'start', titel: 'Allgemeines',
      text: 'Lege fest, für welches Jahr und für wen du rechnest.',
      felder: [
        { k: 'jahr', art: 'wahl', label: 'Steuerjahr', optionen: [[2025, '2025'], [2024, '2024']] },
        { k: 'veranlagung', art: 'wahl', label: 'Veranlagung', optionen: [['single', 'Einzeln'], ['joint', 'Zusammen (Ehe / Lebenspartnerschaft)']], tipp: 'Zusammenveranlagung nutzt den Splittingtarif.' },
        { k: 'kistSatz', art: 'wahl', label: 'Kirchensteuersatz am Wohnort', optionen: [[9, '9 % (übrige Länder)'], [8, '8 % (Bayern, Baden-Württemberg)']], tipp: 'Zählt nur, wenn im nächsten Schritt eine Kirchenmitgliedschaft angehakt ist.' },
      ],
    },
    {
      id: 'lohn', titel: 'Lohn und Gehalt', person: true,
      text: 'Übertrage die Werte aus deiner Lohnsteuerbescheinigung. Die Zeilennummern stehen dabei.',
      felder: [
        { k: 'name', art: 'text', label: 'Vorname', tipp: 'Nur zur Beschriftung' },
        { k: 'brutto', label: 'Bruttoarbeitslohn', tipp: 'Zeile 3' },
        { k: 'mehrjaehrig', label: 'Davon Arbeitslohn für mehrere Jahre', tipp: 'Zeile 10, zum Beispiel Jubiläumszahlung oder Abfindung. Wird nach der Fünftelregelung ermäßigt besteuert.' },
        { k: 'lohnsteuer', label: 'Einbehaltene Lohnsteuer', tipp: 'Zeile 4' },
        { k: 'soli', label: 'Einbehaltener Solidaritätszuschlag', tipp: 'Zeile 5' },
        { k: 'kist', label: 'Einbehaltene Kirchensteuer', tipp: 'Zeile 6' },
        { k: 'rvAG', label: 'Rentenversicherung, Arbeitgeberanteil', tipp: 'Zeile 22' },
        { k: 'rvAN', label: 'Rentenversicherung, Arbeitnehmeranteil', tipp: 'Zeile 23' },
        { k: 'kv', label: 'Krankenversicherung, Beitrag', tipp: 'Zeile 25. Bei freiwillig Versicherten der gesamte Beitrag.' },
        { k: 'pv', label: 'Pflegeversicherung, Beitrag', tipp: 'Zeile 26' },
        { k: 'agKV', label: 'Arbeitgeberzuschuss Krankenversicherung', tipp: 'Zeile 24a, nur bei freiwillig oder privat Versicherten' },
        { k: 'agPV', label: 'Arbeitgeberzuschuss Pflegeversicherung', tipp: 'Zeile 24c' },
        { k: 'av', label: 'Arbeitslosenversicherung, Arbeitnehmeranteil', tipp: 'Zeile 27' },
        { k: 'lohnersatz', label: 'Lohnersatzleistungen', tipp: 'Elterngeld, Arbeitslosengeld I, Krankengeld, Kurzarbeitergeld. Steuerfrei, erhöhen aber den Steuersatz.' },
        { k: 'krankengeld', art: 'haken', label: 'Anspruch auf Krankengeld', tipp: 'Trifft auf gesetzlich versicherte Angestellte in der Regel zu.' },
        { k: 'kirche', art: 'haken', label: 'Kirchensteuerpflichtig', tipp: 'Mitglied einer Kirche, die Kirchensteuer erhebt.' },
      ],
    },
    {
      id: 'werbungskosten', titel: 'Werbungskosten', person: true,
      text: 'Kosten rund um den Beruf. Das Finanzamt setzt mindestens 1.230 € an, erst darüber lohnt sich jeder Beleg.',
      felder: [
        { k: 'km', art: 'zahl', einheit: 'km', label: 'Einfache Entfernung zur Arbeit', tipp: '0,30 € je km, ab dem 21. km 0,38 €' },
        { k: 'tage', art: 'zahl', einheit: 'Tage', label: 'Tage im Betrieb', tipp: 'Tage, an denen du zur Arbeit gefahren bist' },
        { k: 'hoTage', art: 'zahl', einheit: 'Tage', label: 'Tage im Homeoffice', tipp: '6 € je Tag, höchstens 210 Tage' },
        { k: 'arbeitsmittel', label: 'Arbeitsmittel', tipp: 'Computer, Fachliteratur, Werkzeug, Arbeitskleidung' },
        { k: 'fortbildung', label: 'Fortbildung', tipp: 'Kursgebühren, Fahrtkosten, Lernmaterial' },
        { k: 'sonstigeWK', label: 'Weitere Werbungskosten', tipp: 'Gewerkschaft, Kontoführung (16 €), Reinigung von Berufskleidung, Steuersoftware, Telefon' },
      ],
    },
    {
      id: 'vermietung', titel: 'Vermietung', summe: 'vSumme',
      text: 'Für eine vermietete Wohnung im eigenen Haus. Kosten des ganzen Hauses zählen nur mit dem Flächenanteil der vermieteten Wohnung.',
      felder: [
        { k: 'vMiete', label: 'Mieteinnahmen im Jahr', tipp: 'Kaltmiete und Nebenkosten-Vorauszahlungen' },
        { k: 'vAfa', label: 'Abschreibung Gebäude (AfA)', tipp: 'Betrag für die vermietete Wohnung, wie im letzten Bescheid' },
        { k: 'vFlaecheVermietet', art: 'zahl', einheit: 'm²', label: 'Vermietete Wohnfläche' },
        { k: 'vFlaecheGesamt', art: 'zahl', einheit: 'm²', label: 'Wohnfläche des ganzen Hauses' },
      ],
      liste: {
        k: 'vKosten', titel: 'Kosten', neu: { art: 'anteilig' },
        spalten: [
          { c: 'name', art: 'text', label: 'Bezeichnung' },
          { c: 'betrag', label: 'Betrag' },
          { c: 'art', art: 'wahl', label: 'Zuordnung', optionen: [['anteilig', 'Ganzes Haus, anteilig'], ['voll', 'Nur Mietwohnung, voll'], ['privat', 'Privat, nicht absetzbar']] },
        ],
      },
    },
    {
      id: 'kapital', titel: 'Kapitalerträge', summe: 'kSumme',
      text: 'Werte aus der Steuerbescheinigung der Bank und Termingeschäfte bei Börsen ohne Steuerabzug. Verluste aus Termingeschäften werden mit den Kapitalerträgen verrechnet.',
      felder: [
        { k: 'kErtraege', label: 'Kapitalerträge laut Steuerbescheinigung', tipp: 'Zeile 7' },
        { k: 'kSteuer', label: 'Einbehaltene Kapitalertragsteuer', tipp: 'Zeile 37' },
        { k: 'kSoli', label: 'Einbehaltener Solidaritätszuschlag', tipp: 'Zeile 38' },
        { k: 'kAusland', label: 'Angerechnete ausländische Steuer', tipp: 'Zeile 40' },
        { k: 'kTerminGewinne', label: 'Termingeschäfte: Gewinne', tipp: 'Futures, Perpetuals, Optionen ohne Steuerabzug. Erhaltenes Funding zählt dazu.' },
        { k: 'kTerminVerluste', label: 'Termingeschäfte: Verluste und Aufwendungen', tipp: 'Verluste, Handelsgebühren, bezahltes Funding' },
      ],
    },
    {
      id: 'verkaeufe', titel: 'Krypto und Verkäufe', summe: 'soSumme',
      text: 'Private Verkäufe innerhalb eines Jahres nach dem Kauf, zum Beispiel Kryptowährungen im Spot-Handel. Ein Posten je Börse genügt.',
      liste: {
        k: 'soListe', titel: 'Verkäufe', neu: {},
        spalten: [
          { c: 'name', art: 'text', label: 'Bezeichnung' },
          { c: 'erloes', label: 'Erlös' },
          { c: 'kosten', label: 'Anschaffungskosten' },
        ],
      },
    },
    {
      id: 'vorsorge', titel: 'Spenden und Versicherungen',
      text: 'Sozialversicherungsbeiträge sind schon über den Lohn erfasst. Hier kommt dazu, was du selbst gezahlt hast.',
      felder: [
        { k: 'spenden', label: 'Spenden und Mitgliedsbeiträge', tipp: 'An gemeinnützige Organisationen, absetzbar bis 20 % der Einkünfte' },
        { k: 'sonstVers', label: 'Weitere Versicherungen', tipp: 'Haftpflicht, Unfall, Berufsunfähigkeit, Risikoleben. Wirkt nur, solange der Höchstbetrag von 1.900 € je Person nicht ausgeschöpft ist.' },
      ],
    },
    {
      id: 'familie', titel: 'Familie und Kinder',
      text: 'Der Steuer-Kompass prüft, ob Kindergeld oder Kinderfreibetrag für dich günstiger ist.',
      felder: [
        { k: 'kinder', art: 'zahl', einheit: 'Kinder', label: 'Kinder mit Kindergeldanspruch', tipp: 'Bei Einzelveranlagung wird der halbe Freibetrag angesetzt.' },
        { k: 'ausbildungAuswaerts', art: 'zahl', einheit: 'Kinder', label: 'Davon volljährig, in Ausbildung und auswärts wohnend', tipp: 'Ausbildungsfreibetrag von 1.200 € je Kind. Gilt nicht für Kinder, die zu Hause wohnen.' },
        { k: 'kinderbetreuung', label: 'Kinderbetreuungskosten', tipp: 'Kita, Tagesmutter, Hort für Kinder unter 14, ohne Verpflegung' },
        { k: 'alleinerziehend', art: 'haken', label: 'Alleinerziehend', tipp: 'Entlastungsbetrag von 4.260 €, je weiterem Kind 240 € mehr. Nur bei Einzelveranlagung.' },
      ],
    },
    {
      id: 'haushalt', titel: 'Haushalt und Gesundheit',
      text: 'Arbeiten im Haushalt mindern die Steuer direkt um 20 % der Arbeitskosten. Trage nur Lohn-, Fahrt- und Maschinenkosten ein, kein Material.',
      felder: [
        { k: 'handwerker', label: 'Handwerkerleistungen', tipp: 'Renovierung, Reparatur, Schornsteinfeger. Höchstens 1.200 € Ermäßigung.' },
        { k: 'haushaltsnah', label: 'Haushaltsnahe Dienstleistungen', tipp: 'Reinigung, Gartenpflege, Winterdienst, Posten aus der Nebenkostenabrechnung. Höchstens 4.000 € Ermäßigung.' },
        { k: 'minijob', label: 'Minijob im Haushalt', tipp: 'Haushaltshilfe im Haushaltsscheckverfahren. Höchstens 510 € Ermäßigung.' },
        { k: 'krankheitskosten', label: 'Krankheits- und Pflegekosten', tipp: 'Selbst getragene Kosten für Zahnersatz, Brille, Medikamente auf Rezept. Wirkt erst oberhalb der zumutbaren Belastung.' },
      ],
    },
    {
      id: 'weitere', titel: 'Weitere Angaben',
      text: 'Andere Einkünfte und bereits geleistete Zahlungen.',
      felder: [
        { k: 'weitereEinkuenfte', label: 'Weitere Einkünfte (Gewinn oder Überschuss)', negativ: true, tipp: 'Selbstständigkeit, Gewerbe, Renten. Verluste mit Minuszeichen.' },
        { k: 'vorauszahlungen', label: 'Einkommensteuer-Vorauszahlungen', tipp: 'Für dieses Steuerjahr an das Finanzamt überwiesen' },
      ],
    },
    { id: 'ergebnis', titel: 'Ergebnis' },
  ];

  let z = laden();

  function laden() {
    try {
      const roh = localStorage.getItem(SPEICHER);
      if (roh) return pruefen(JSON.parse(roh));
    } catch (e) { /* Speicher nicht verfügbar */ }
    try {
      if (window.STEUER_VORGABE) return pruefen(JSON.parse(JSON.stringify(window.STEUER_VORGABE)));
    } catch (e) { /* Vorgabe unbrauchbar */ }
    return beispielZustand();
  }
  function pruefen(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Kein gültiger Datensatz');
    const basis = leererZustand();
    const p = Array.isArray(d.p) ? d.p : [];
    ['vKosten', 'soListe'].forEach((k) => {
      d[k] = Array.isArray(d[k]) ? d[k].filter((r) => r && typeof r === 'object') : [];
    });
    return { ...basis, ...d, p: [0, 1].map((i) => ({ ...leerePerson(), ...(p[i] && typeof p[i] === 'object' ? p[i] : {}) })) };
  }
  function speichern() {
    try { localStorage.setItem(SPEICHER, JSON.stringify(z)); } catch (e) { /* ohne Speicher weiterarbeiten */ }
  }

  const zusammen = () => z.veranlagung === 'joint';
  const aktuell = () => SCHRITTE.find((s) => s.id === location.hash.slice(1)) || SCHRITTE[0];
  const personName = (i) => (z.p[i].name ? esc(z.p[i].name) : zusammen() ? `Person ${i + 1}` : '');

  function feldHtml(f, i) {
    const id = `f-${f.k}${i == null ? '' : '-' + i}`;
    const wert = i == null ? z[f.k] : z.p[i][f.k];
    const daten = `data-k="${f.k}"${i == null ? '' : ` data-p="${i}"`}`;
    const tipp = f.tipp ? `<small>${esc(f.tipp)}</small>` : '';
    if (f.art === 'haken') {
      return `<div class="feld haken"><input type="checkbox" id="${id}" ${daten}${wert ? ' checked' : ''}>
        <div><label for="${id}">${esc(f.label)}</label>${tipp}</div></div>`;
    }
    if (f.art === 'wahl') {
      const opts = f.optionen.map(([v, t]) => `<option value="${v}"${String(v) === String(wert) ? ' selected' : ''}>${esc(t)}</option>`).join('');
      return `<div class="feld"><label for="${id}">${esc(f.label)}</label><select id="${id}" ${daten}>${opts}</select>${tipp}</div>`;
    }
    if (f.art === 'text') {
      return `<div class="feld"><label for="${id}">${esc(f.label)}</label>
        <div class="eingabe"><input type="text" class="text" id="${id}" ${daten} value="${wert == null ? '' : esc(wert)}"></div>${tipp}</div>`;
    }
    const ganz = f.art === 'zahl';
    return `<div class="feld"><label for="${id}">${esc(f.label)}</label>
      <div class="eingabe"><input type="number" inputmode="${ganz ? 'numeric' : 'decimal'}" id="${id}" ${daten}
        step="${ganz ? 1 : 0.01}"${f.negativ ? '' : ' min="0"'} placeholder="0" value="${wert == null ? '' : esc(wert)}">
        <span class="einheit">${esc(f.einheit || '€')}</span></div>${tipp}</div>`;
  }

  function listeHtml(l) {
    const zeilen = (z[l.k] || []).map((r, i) => {
      const zellen = l.spalten.map((sp) => {
        const id = `l-${l.k}-${i}-${sp.c}`;
        const daten = `data-l="${l.k}" data-i="${i}" data-c="${sp.c}"`;
        const wert = r[sp.c];
        let feld;
        if (sp.art === 'wahl') {
          feld = `<select id="${id}" ${daten}>${sp.optionen.map(([v, t]) => `<option value="${v}"${v === wert ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
        } else if (sp.art === 'text') {
          feld = `<div class="eingabe"><input type="text" class="text" id="${id}" ${daten} value="${wert == null ? '' : esc(wert)}"></div>`;
        } else {
          feld = `<div class="eingabe"><input type="number" inputmode="decimal" step="0.01" min="0" placeholder="0" id="${id}" ${daten} value="${wert == null ? '' : esc(wert)}"><span class="einheit">€</span></div>`;
        }
        return `<div class="feld${sp.art === 'text' ? ' breit' : ''}"><label for="${id}">${esc(sp.label)}</label>${feld}</div>`;
      }).join('');
      return `<div class="listenzeile">${zellen}<button type="button" class="knopf leise klein" data-weg="${i}" data-l="${l.k}">Entfernen</button></div>`;
    }).join('');
    return `<h2>${esc(l.titel)}</h2><div class="liste">${zeilen || '<p class="einleitung">Noch keine Einträge.</p>'}</div>
      <div><button type="button" class="knopf leise klein" data-neu="${l.k}">Zeile hinzufügen</button></div>`;
  }

  function zeichneSchritte() {
    const a = aktuell();
    $('schritte').innerHTML = SCHRITTE.map((s, i) =>
      `<a href="#${s.id}"${s === a ? ' aria-current="step"' : ''}><span class="nr">${i + 1}</span>${esc(s.titel)}</a>`).join('');
  }

  function zeichneInhalt() {
    const s = aktuell();
    const idx = SCHRITTE.indexOf(s);
    const vor = SCHRITTE[idx - 1], nach = SCHRITTE[idx + 1];
    let html = `<h1>${esc(s.titel)}</h1>`;
    if (s.id === 'ergebnis') html += '<div id="bericht"></div>';
    else {
      html += `<p class="einleitung">${esc(s.text)}</p>`;
      const gruppen = s.person ? (zusammen() ? [0, 1] : [0]) : [null];
      html += gruppen.map((i) => `<section class="karte">
        ${i != null && personName(i) ? `<h2>${personName(i)}</h2>` : ''}
        ${s.felder ? `<div class="felder">${s.felder.map((f) => feldHtml(f, i)).join('')}</div>` : ''}
        ${s.liste ? listeHtml(s.liste) : ''}
        ${s.id === 'werbungskosten' ? `<div class="zwischensumme" id="wkSumme-${i}"></div>` : ''}
        ${s.summe ? `<div class="zwischensumme" id="${s.summe}"></div>` : ''}
      </section>`).join('');
    }
    html += `<div class="weiter">
      ${vor ? `<a class="knopf leise" href="#${vor.id}">Zurück</a>` : '<span></span>'}
      ${nach ? `<a class="knopf" href="#${nach.id}">${nach.id === 'ergebnis' ? 'Zum Ergebnis' : 'Weiter'}</a>` : ''}
    </div>`;
    $('inhalt').innerHTML = html;
  }

  function zeile(text, wert, klasse, ein) {
    return `<tr${klasse ? ` class="${klasse}"` : ''}><td${ein ? ' class="ein"' : ''}>${esc(text)}</td><td>${wert == null ? '' : fmt(wert)}</td></tr>`;
  }

  function berichtHtml(e) {
    const r = [];
    r.push(zeile('Einkünfte', null, 'gruppe'));
    e.pers.forEach((p, i) => {
      if (!p.brutto && i > 0) return;
      const wer = personName(i) ? ` ${z.p[i].name || personName(i)}` : '';
      r.push(zeile(`Bruttoarbeitslohn${wer}`, p.brutto));
      r.push(zeile(p.wk.pauschal ? 'Arbeitnehmer-Pauschbetrag' : 'Werbungskosten', -p.wk.angesetzt, '', true));
    });
    const v = e.vermietung, so = e.veraeusserung, k = e.kapital;
    if (v.vorhanden) {
      r.push(zeile('Mieteinnahmen', v.miete));
      r.push(zeile(`Kosten der Vermietung (Flächenanteil ${prozent(v.anteil)})`, -v.kosten, '', true));
    }
    if (so.steuerpflichtig) r.push(zeile('Gewinn aus privaten Verkäufen', so.steuerpflichtig));
    if (e.weitere) r.push(zeile('Weitere Einkünfte', e.weitere));
    if (e.entlastung) r.push(zeile('Entlastungsbetrag für Alleinerziehende', -e.entlastung, '', true));
    r.push(zeile('Gesamtbetrag der Einkünfte', e.gde, 'summe'));

    r.push(zeile('Abzüge', null, 'gruppe'));
    r.push(zeile('Altersvorsorge', -e.altersvorsorge, '', true));
    r.push(zeile('Kranken-, Pflege- und weitere Versicherungen', -e.krankenvorsorge, '', true));
    r.push(zeile(e.sonderTatsaechlich > e.sonderausgaben - 0.005 ? 'Sonderausgaben (Kirchensteuer, Spenden, Kinderbetreuung)' : 'Sonderausgaben-Pauschbetrag', -e.sonderausgaben, '', true));
    if (e.agbKosten) r.push(zeile(`Außergewöhnliche Belastungen (zumutbar: ${fmt(e.zumutbar)})`, -e.agb, '', true));
    if (e.ausbildung) r.push(zeile('Ausbildungsfreibetrag', -e.ausbildung, '', true));
    if (e.freibetragGuenstiger) r.push(zeile('Kinderfreibeträge', -e.kfb, '', true));
    r.push(zeile('Zu versteuerndes Einkommen', e.zvE, 'summe'));

    r.push(zeile('Steuer', null, 'gruppe'));
    r.push(zeile(`Einkommensteuer laut ${e.splitting ? 'Splittingtarif' : 'Grundtarif'}${e.mehrjaehrig ? `, ${fmt(e.mehrjaehrig)} nach Fünftelregelung` : ''}`, e.tarifSteuer));
    if (e.ermaessigung) r.push(zeile('Ermäßigung für Arbeiten im Haushalt', -e.ermaessigung, '', true));
    if (e.freibetragGuenstiger) r.push(zeile('Erhaltenes Kindergeld wird hinzugerechnet', e.kindergeld, '', true));
    r.push(zeile('Festzusetzende Einkommensteuer', e.est, 'summe'));
    r.push(zeile('Solidaritätszuschlag', e.soli));
    r.push(zeile('Kirchensteuer', e.kist));

    if (k.vorhanden) {
      r.push(zeile('Kapitalerträge', null, 'gruppe'));
      r.push(zeile('Kapitalerträge laut Steuerbescheinigung', k.ertraege));
      if (k.termin) r.push(zeile('Ergebnis aus Termingeschäften', k.termin, '', true));
      r.push(zeile('Saldo Kapitalvermögen', k.saldo, 'summe'));
      r.push(zeile('Abgeltungsteuer und Soli darauf', k.steuer + k.soli));
    }

    r.push(zeile('Abrechnung', null, 'gruppe'));
    r.push(zeile('Steuern insgesamt', e.summeFest));
    r.push(zeile('Lohnsteuer bereits gezahlt', -e.gezahlt.lohnsteuer, '', true));
    if (e.gezahlt.soli) r.push(zeile('Solidaritätszuschlag bereits gezahlt', -e.gezahlt.soli, '', true));
    if (e.gezahlt.kist) r.push(zeile('Kirchensteuer bereits gezahlt', -e.gezahlt.kist, '', true));
    if (e.gezahlt.vorauszahlungen) r.push(zeile('Vorauszahlungen', -e.gezahlt.vorauszahlungen, '', true));
    if (k.einbehalten) r.push(zeile('Kapitalertragsteuer und Soli von der Bank einbehalten', -k.einbehalten, '', true));
    r.push(zeile(e.erstattung >= 0 ? 'Voraussichtliche Erstattung' : 'Voraussichtliche Nachzahlung', Math.abs(e.erstattung), 'summe'));

    if (k.verlustvortrag || so.verlustvortrag) {
      r.push(zeile('Verluste für die Folgejahre', null, 'gruppe'));
      if (k.verlustvortrag) r.push(zeile('Verlustvortrag Kapitalvermögen', k.verlustvortrag));
      if (so.verlustvortrag) r.push(zeile('Verlustvortrag private Verkäufe', so.verlustvortrag));
    }

    const tipps = tippsFuer(e);
    return `<section class="karte"><div class="tabellenrahmen"><table class="abrechnung"><tbody>${r.join('')}</tbody></table></div></section>
      <section class="karte"><h2>Was du noch prüfen kannst</h2><ul class="tipps">${tipps.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></section>`;
  }

  function tippsFuer(e) {
    const t = [];
    e.pers.forEach((p, i) => {
      if (p.brutto > 0 && p.wk.pauschal) {
        const fehlt = p.wk.pauschbetrag - p.wk.tatsaechlich;
        t.push(`${personName(i) ? (z.p[i].name || personName(i)) + ': ' : ''}Deine Werbungskosten liegen ${fmt(fehlt)} unter dem Pauschbetrag. Prüfe Fahrten zur Arbeit, Homeoffice-Tage und Arbeitsmittel.`);
      }
    });
    if (e.kapital.verlustvortrag) t.push(`Der Verlust aus Kapitalvermögen von ${fmt(e.kapital.verlustvortrag)} wird nur vorgetragen, wenn du in der Anlage KAP die Überprüfung des Steuereinbehalts beantragst. Er mindert spätere Kapitalerträge, nicht den Lohn.`);
    if (e.veraeusserung.verlustvortrag) t.push(`Der Verlust aus privaten Verkäufen von ${fmt(e.veraeusserung.verlustvortrag)} mindert nur Gewinne aus privaten Verkäufen in anderen Jahren.`);
    if (e.vermietung.privat) t.push(`${fmt(e.vermietung.privat)} Kosten sind als privat markiert und bleiben unberücksichtigt.`);
    if (!z.handwerker && !z.haushaltsnah && !e.vermietung.vorhanden) t.push('Mieter finden haushaltsnahe Dienstleistungen in der Nebenkostenabrechnung: Hausmeister, Treppenhausreinigung, Gartenpflege. 20 % davon mindern die Steuer direkt.');
    if (e.agbKosten > 0 && e.agb === 0) t.push(`Deine Krankheitskosten liegen unter der zumutbaren Belastung von ${fmt(e.zumutbar)} und wirken sich nicht aus.`);
    if (e.kinder > 0) t.push(e.freibetragGuenstiger ? 'Für dich ist der Kinderfreibetrag günstiger als das Kindergeld. Das Finanzamt rechnet das Kindergeld gegen.' : 'Für dich ist das Kindergeld günstiger als der Kinderfreibetrag. Es bleibt dabei.');
    if (e.kinder > 0 && !z.kinderbetreuung) t.push('Kinderbetreuungskosten für Kinder unter 14 sind zu einem großen Teil absetzbar.');
    if (e.lohnersatz > 0) t.push('Wegen der Lohnersatzleistungen gilt ein höherer Steuersatz (Progressionsvorbehalt). Die Abgabe einer Erklärung ist dann Pflicht, sobald sie 410 € übersteigen.');
    if (e.erstattung > 0) t.push('Eine freiwillige Erklärung kannst du bis zu vier Jahre nach Ablauf des Steuerjahres abgeben.');
    t.push('Die amtliche Abgabe läuft über ELSTER. Die hier ermittelten Werte kannst du dort als Orientierung nutzen.');
    return t;
  }

  function zeichneErgebnis() {
    const e = Tax.berechne(z);
    const plus = e.erstattung >= 0;
    const stand = !e.hatEingaben ? 'neutral' : plus ? 'gut' : 'schlecht';
    $('ergebnis').className = `ergebnis ${stand}`;
    $('ergebnis').innerHTML = `
      <span class="pille">${!e.hatEingaben ? 'Noch keine Angaben' : plus ? 'Erstattung' : 'Nachzahlung'}</span>
      <div><div class="etikett">Voraussichtlich ${plus ? 'bekommst du zurück' : 'zahlst du nach'}</div>
      <div class="betrag">${fmt(Math.abs(e.erstattung))}</div></div>
      <dl class="kurz">
        <dt>Zu versteuerndes Einkommen</dt><dd>${fmt(e.zvE)}</dd>
        <dt>Einkommensteuer</dt><dd>${fmt(e.est)}</dd>
        <dt>Soli und Kirchensteuer</dt><dd>${fmt(e.soli + e.kist)}</dd>
        ${e.kapital.vorhanden ? `<dt>Abgeltungsteuer</dt><dd>${fmt(e.kapital.steuer + e.kapital.soli)}</dd>` : ''}
        <dt>Bereits gezahlt</dt><dd>${fmt(e.summeGezahlt)}</dd>
        <dt>Durchschnittssteuersatz</dt><dd>${(e.durchschnittssteuersatz * 100).toFixed(1).replace('.', ',')} %</dd>
      </dl>
      ${aktuell().id === 'ergebnis' ? '' : '<a class="knopf leise" href="#ergebnis">Berechnung ansehen</a>'}`;

    e.pers.forEach((p, i) => {
      const el = $(`wkSumme-${i}`);
      if (el) el.innerHTML = `<span>Eingetragen: <b>${fmt(p.wk.tatsaechlich)}</b></span>
        <span>Angesetzt: <b>${fmt(p.wk.angesetzt)}</b>${p.wk.pauschal ? ' (Pauschbetrag)' : ''}</span>`;
    });
    const fuelle = (id, html) => { const el = $(id); if (el) el.innerHTML = html; };
    const v = e.vermietung, k = e.kapital, so = e.veraeusserung;
    fuelle('vSumme', `<span>Flächenanteil: <b>${prozent(v.anteil)}</b></span><span>Kosten: <b>${fmt(v.kosten)}</b></span><span>Überschuss: <b>${fmt(v.ueberschuss)}</b></span>`);
    fuelle('kSumme', `<span>Saldo: <b>${fmt(k.saldo)}</b></span><span>Erstattung von der Bank einbehaltener Steuer: <b>${fmt(k.erstattung)}</b></span>${k.verlustvortrag ? `<span>Verlustvortrag: <b>${fmt(k.verlustvortrag)}</b></span>` : ''}`);
    fuelle('soSumme', `<span>Ergebnis: <b>${fmt(so.saldo)}</b></span><span>${so.saldo < 0 ? 'Wird vorgetragen, mindert das Einkommen nicht' : so.steuerpflichtig ? 'Wird mit dem Einkommen versteuert' : 'Unter der Freigrenze von 1.000 €, steuerfrei'}</span>`);
    const bericht = $('bericht');
    if (bericht) bericht.innerHTML = berichtHtml(e);
    $('kopfJahr').textContent = `Einkommensteuer ${e.jahr}`;
    $('beispielBand').hidden = !z.beispiel;
  }

  function zeichneAlles() {
    zeichneSchritte();
    zeichneInhalt();
    zeichneErgebnis();
  }

  $('inhalt').addEventListener('input', (ev) => {
    const el = ev.target;
    if (el.dataset.l) {
      const zeileL = z[el.dataset.l][Number(el.dataset.i)];
      const c = el.dataset.c;
      if (el.type === 'number') { if (el.value === '') delete zeileL[c]; else zeileL[c] = Number(el.value); }
      else zeileL[c] = el.value;
      speichern();
      zeichneErgebnis();
      return;
    }
    const k = el.dataset.k;
    if (!k) return;
    const ziel = el.dataset.p == null ? z : z.p[Number(el.dataset.p)];
    if (el.type === 'checkbox') ziel[k] = el.checked;
    else if (el.tagName === 'SELECT') ziel[k] = /^\d+$/.test(el.value) ? Number(el.value) : el.value;
    else if (el.type === 'text') ziel[k] = el.value;
    else if (el.value === '') delete ziel[k];
    else ziel[k] = Number(el.value);
    speichern();
    zeichneErgebnis();
  });

  $('inhalt').addEventListener('click', (ev) => {
    const b = ev.target.closest('button');
    if (!b) return;
    const s = aktuell();
    if (b.dataset.neu) z[b.dataset.neu].push({ ...(s.liste ? s.liste.neu : {}) });
    else if (b.dataset.weg) z[b.dataset.l].splice(Number(b.dataset.weg), 1);
    else return;
    speichern();
    zeichneInhalt();
    zeichneErgebnis();
  });

  window.addEventListener('hashchange', () => {
    zeichneAlles();
    window.scrollTo(0, 0);
  });

  // Dialoge
  document.querySelectorAll('[data-zu]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  $('btnSichern').addEventListener('click', () => {
    $('txtSichern').value = JSON.stringify(z);
    $('sichernFehler').hidden = true;
    $('dlgSichern').showModal();
  });
  $('btnKopieren').addEventListener('click', async () => {
    const feld = $('txtSichern');
    try {
      await navigator.clipboard.writeText(feld.value);
      $('btnKopieren').textContent = 'Kopiert';
    } catch (e) {
      feld.select();
      $('btnKopieren').textContent = 'Markiert, jetzt Strg+C';
    }
    setTimeout(() => { $('btnKopieren').textContent = 'Kopieren'; }, 2500);
  });
  $('btnLaden').addEventListener('click', () => {
    try {
      z = pruefen(JSON.parse($('txtSichern').value));
      z.beispiel = false;
      speichern();
      zeichneAlles();
      $('dlgSichern').close();
    } catch (e) {
      $('sichernFehler').textContent = 'Der Text ist kein gültiger Datensatz. Füge den vollständigen gesicherten Text ein.';
      $('sichernFehler').hidden = false;
    }
  });
  $('btnLeeren').addEventListener('click', () => $('dlgLeeren').showModal());
  const leeren = () => {
    z = leererZustand();
    speichern();
    zeichneAlles();
  };
  $('btnLeerenJa').addEventListener('click', () => { leeren(); $('dlgLeeren').close(); });
  $('btnBeispielWeg').addEventListener('click', leeren);

  zeichneAlles();

  // Offline-Nutzung auf der eigenen Webseite; in eingebetteten Ansichten nicht verfügbar.
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
