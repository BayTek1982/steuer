/*
 * Steuer-Kompass – Berechnungskern (Einkommensteuer, vereinfachte Schätzung).
 * Läuft im Browser (window.Tax) und in Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Tax = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Kennzahlen je Veranlagungsjahr
  const JAHRE = {
    2024: {
      tarif: { gfb: 11784, e1: 17005, e2: 66760, e3: 277825, a: 954.80, c: 181.19, k: 991.21, m42: 10636.31, m45: 18971.06 },
      soliFreigrenze: 18130,
      kinderfreibetrag: 9540, // inkl. BEA-Freibetrag, je Kind für beide Eltern
      kindergeld: 3000, // je Kind und Jahr
      rvHoechstbetrag: 27566,
      betreuungQuote: 2 / 3,
      betreuungMax: 4000,
    },
    2025: {
      tarif: { gfb: 12096, e1: 17443, e2: 68480, e3: 277825, a: 932.30, c: 176.64, k: 1015.13, m42: 10911.92, m45: 19246.67 },
      soliFreigrenze: 19950,
      kinderfreibetrag: 9600,
      kindergeld: 3060,
      rvHoechstbetrag: 29344,
      betreuungQuote: 0.8,
      betreuungMax: 4800,
    },
  };

  const K = {
    arbeitnehmerPauschbetrag: 1230,
    sonderausgabenPauschbetrag: 36,
    homeofficeTag: 6,
    homeofficeMaxTage: 210,
    kmNah: 0.30,
    kmFern: 0.38,
    sonstigeVorsorgeMax: 1900,
    entlastungAlleinerziehend: 4260,
    entlastungJeWeiteresKind: 240,
    ausbildungsfreibetrag: 1200,
    sparerPauschbetrag: 1000,
    freigrenzeVeraeusserung: 1000,
  };

  const n = (v) => {
    const x = typeof v === 'string' ? parseFloat(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) : Number(v);
    return Number.isFinite(x) ? x : 0;
  };
  const pos = (v) => Math.max(0, n(v));
  const r2 = (v) => Math.round(v * 100) / 100;

  /** Grundtarif nach § 32a EStG für ein zu versteuerndes Einkommen. */
  function grundtarif(jahr, zvE) {
    const t = JAHRE[jahr].tarif;
    const x = Math.floor(zvE);
    let st;
    if (x <= t.gfb) st = 0;
    else if (x <= t.e1) {
      const y = (x - t.gfb) / 10000;
      st = (t.a * y + 1400) * y;
    } else if (x <= t.e2) {
      const z = (x - t.e1) / 10000;
      st = (t.c * z + 2397) * z + t.k;
    } else if (x <= t.e3) st = 0.42 * x - t.m42;
    else st = 0.45 * x - t.m45;
    return Math.floor(st);
  }

  /** Tarifliche Steuer inkl. Splitting und Progressionsvorbehalt. */
  function tarif(jahr, zvE, splitting, lohnersatz) {
    const f = splitting ? 2 : 1;
    const basis = Math.max(0, zvE) / f;
    const le = pos(lohnersatz) / f;
    if (le <= 0) return grundtarif(jahr, basis) * f;
    const gesamt = basis + le;
    if (gesamt <= 0) return 0;
    const satz = grundtarif(jahr, gesamt) / Math.floor(gesamt);
    return Math.floor(Math.floor(basis) * satz) * f;
  }

  function soli(jahr, steuer, splitting) {
    const grenze = JAHRE[jahr].soliFreigrenze * (splitting ? 2 : 1);
    if (steuer <= grenze) return 0;
    return r2(Math.min(steuer * 0.055, (steuer - grenze) * 0.119));
  }

  /** Zumutbare Belastung (§ 33 Abs. 3 EStG), stufenweise berechnet. */
  function zumutbareBelastung(gde, splitting, kinder) {
    let s;
    if (kinder >= 3) s = [0.01, 0.01, 0.02];
    else if (kinder >= 1) s = [0.02, 0.03, 0.04];
    else s = splitting ? [0.04, 0.05, 0.06] : [0.05, 0.06, 0.07];
    const g = Math.max(0, gde);
    return r2(
      Math.min(g, 15340) * s[0] +
        Math.max(0, Math.min(g, 51130) - 15340) * s[1] +
        Math.max(0, g - 51130) * s[2]
    );
  }

  function werbungskosten(p) {
    const km = pos(p.km), tage = pos(p.tage);
    const fahrt = r2(tage * (Math.min(km, 20) * K.kmNah + Math.max(0, km - 20) * K.kmFern));
    const homeoffice = Math.min(pos(p.hoTage), K.homeofficeMaxTage) * K.homeofficeTag;
    const uebrige = pos(p.arbeitsmittel) + pos(p.fortbildung) + pos(p.sonstigeWK);
    const tatsaechlich = r2(fahrt + homeoffice + uebrige);
    const brutto = pos(p.brutto);
    const pauschbetrag = Math.min(K.arbeitnehmerPauschbetrag, brutto);
    const angesetzt = Math.max(tatsaechlich, pauschbetrag);
    return { fahrt, homeoffice, uebrige, tatsaechlich, pauschbetrag, angesetzt, pauschal: tatsaechlich <= pauschbetrag };
  }

  /** Tarif mit Fünftelregelung (§ 34 EStG) für außerordentliche Einkünfte `ao`. */
  function mitFuenftel(jahr, zvE, splitting, lohnersatz, ao) {
    const a = Math.min(Math.max(0, ao), Math.max(0, zvE));
    if (a <= 0) return tarif(jahr, zvE, splitting, lohnersatz);
    const rest = zvE - a;
    const basis = tarif(jahr, rest, splitting, lohnersatz);
    return basis + 5 * (tarif(jahr, rest + a / 5, splitting, lohnersatz) - basis);
  }

  const liste = (v) => (Array.isArray(v) ? v.filter((z) => z && typeof z === 'object') : []);

  /** Vermietung: Kosten des ganzen Hauses zählen nur mit dem vermieteten Flächenanteil. */
  function vermietung(s) {
    const gesamt = pos(s.vFlaecheGesamt), vermietet = pos(s.vFlaecheVermietet);
    const anteil = gesamt > 0 && vermietet > 0 ? Math.min(1, vermietet / gesamt) : 1;
    let voll = 0, anteilig = 0, privat = 0;
    liste(s.vKosten).forEach((z) => {
      if (z.art === 'voll') voll += pos(z.betrag);
      else if (z.art === 'privat') privat += pos(z.betrag);
      else anteilig += pos(z.betrag);
    });
    const miete = pos(s.vMiete), afa = pos(s.vAfa);
    const kosten = r2(afa + voll + anteilig * anteil);
    return { miete, afa, anteil, voll: r2(voll), anteilig: r2(anteilig * anteil), privat: r2(privat), kosten, ueberschuss: r2(miete - kosten), vorhanden: miete > 0 || kosten > 0 };
  }

  /** Private Veräußerungsgeschäfte (§ 23 EStG): Verluste mindern andere Einkünfte nicht. */
  function veraeusserung(s) {
    const posten = liste(s.soListe).map((z) => ({ name: z.name || '', ergebnis: r2(pos(z.erloes) - pos(z.kosten)) }));
    const saldo = r2(posten.reduce((a, z) => a + z.ergebnis, 0));
    const steuerpflichtig = saldo >= K.freigrenzeVeraeusserung ? saldo : 0;
    return { posten, saldo, steuerpflichtig, verlustvortrag: saldo < 0 ? -saldo : 0, vorhanden: posten.length > 0 };
  }

  /** Kapitalerträge (Abgeltungsteuer 25 %) mit Verrechnung von Termingeschäften. */
  function kapital(s, f) {
    const ertraege = pos(s.kErtraege);
    const termin = r2(pos(s.kTerminGewinne) - pos(s.kTerminVerluste));
    const saldo = r2(ertraege + termin);
    const steuerpflichtig = Math.max(0, saldo - K.sparerPauschbetrag * f);
    const steuer = r2(Math.max(0, steuerpflichtig * 0.25 - pos(s.kAusland)));
    const soliK = r2(steuer * 0.055);
    const einbehalten = r2(pos(s.kSteuer) + pos(s.kSoli));
    return {
      ertraege, termin, saldo, steuerpflichtig, steuer, soli: soliK, einbehalten,
      erstattung: r2(einbehalten - steuer - soliK),
      verlustvortrag: saldo < 0 ? -saldo : 0,
      vorhanden: ertraege > 0 || termin !== 0 || einbehalten > 0,
    };
  }

  /**
   * Gesamte Berechnung.
   * @param {object} s Eingaben (siehe app.js: leererZustand)
   * @returns {object} Ergebnis mit Zwischenwerten
   */
  function berechne(s) {
    const jahr = JAHRE[s.jahr] ? Number(s.jahr) : 2025;
    const J = JAHRE[jahr];
    const splitting = s.veranlagung === 'joint';
    const personen = (s.p || []).slice(0, splitting ? 2 : 1);
    const f = splitting ? 2 : 1;
    const kinder = Math.floor(pos(s.kinder));

    // 1. Einkünfte
    const pers = personen.map((p) => {
      const wk = werbungskosten(p);
      const brutto = pos(p.brutto);
      return { brutto, wk, einkuenfte: r2(brutto - wk.angesetzt) };
    });
    const lohnEinkuenfte = pers.reduce((a, p) => a + p.einkuenfte, 0);
    const weitere = n(s.weitereEinkuenfte);
    const v = vermietung(s);
    const so = veraeusserung(s);
    const kap = kapital(s, f);
    const summeEinkuenfte = r2(lohnEinkuenfte + weitere + v.ueberschuss + so.steuerpflichtig);
    const entlastung =
      !splitting && s.alleinerziehend && kinder > 0
        ? K.entlastungAlleinerziehend + (kinder - 1) * K.entlastungJeWeiteresKind
        : 0;
    const gde = r2(summeEinkuenfte - entlastung); // Gesamtbetrag der Einkünfte

    // 2. Vorsorgeaufwendungen
    let rvGesamt = 0, rvAG = 0, basisKV = 0, sonstVorsorge = pos(s.sonstVers);
    personen.forEach((p) => {
      const kv = pos(p.kv);
      const abschlag = p.krankengeld === false ? 0 : kv * 0.04;
      rvGesamt += pos(p.rvAN) + pos(p.rvAG);
      rvAG += pos(p.rvAG);
      basisKV += Math.max(0, kv - abschlag - pos(p.agKV)) + Math.max(0, pos(p.pv) - pos(p.agPV));
      sonstVorsorge += abschlag + pos(p.av);
    });
    const altersvorsorge = r2(Math.max(0, Math.min(rvGesamt, J.rvHoechstbetrag * f) - rvAG));
    const krankenvorsorge = r2(Math.max(basisKV, Math.min(basisKV + sonstVorsorge, K.sonstigeVorsorgeMax * f)));
    const vorsorge = r2(altersvorsorge + krankenvorsorge);

    // 3. Übrige Sonderausgaben
    const kistGezahlt = personen.reduce((a, p) => a + pos(p.kist), 0);
    const spenden = r2(Math.min(pos(s.spenden), Math.max(0, gde) * 0.2));
    const betreuung = kinder > 0 ? r2(Math.min(pos(s.kinderbetreuung) * J.betreuungQuote, J.betreuungMax * kinder)) : 0;
    const sonderTatsaechlich = r2(kistGezahlt + spenden + betreuung);
    const sonderausgaben = Math.max(sonderTatsaechlich, K.sonderausgabenPauschbetrag * f);

    // 4. Außergewöhnliche Belastungen
    const agbKosten = pos(s.krankheitskosten);
    const zumutbar = zumutbareBelastung(gde, splitting, kinder);
    const agb = r2(Math.max(0, agbKosten - zumutbar));

    const ausbildung = kinder > 0 ? Math.min(Math.floor(pos(s.ausbildungAuswaerts)), kinder) * K.ausbildungsfreibetrag : 0;
    const einkommen = r2(gde - vorsorge - sonderausgaben - agb - ausbildung);

    // 5. Kinder: Günstigerprüfung Freibetrag ./. Kindergeld
    const anteil = splitting ? 1 : 0.5;
    const kfb = kinder * J.kinderfreibetrag * anteil;
    const kindergeld = kinder * J.kindergeld * anteil;
    const le = personen.reduce((a, p) => a + pos(p.lohnersatz), 0);
    const zvEOhne = Math.max(0, Math.floor(einkommen));
    const zvEMit = Math.max(0, Math.floor(einkommen - kfb));
    const mehrjaehrig = personen.reduce((a, p) => a + pos(p.mehrjaehrig), 0);
    const stOhne = mitFuenftel(jahr, zvEOhne, splitting, le, mehrjaehrig);
    const stMit = mitFuenftel(jahr, zvEMit, splitting, le, mehrjaehrig);
    const freibetragGuenstiger = kinder > 0 && stOhne - stMit > kindergeld;
    const zvE = freibetragGuenstiger ? zvEMit : zvEOhne;
    const tarifSteuer = freibetragGuenstiger ? stMit : stOhne;

    // 6. Steuerermäßigung § 35a
    const erm35a = r2(
      Math.min(pos(s.haushaltsnah) * 0.2, 4000) +
        Math.min(pos(s.handwerker) * 0.2, 1200) +
        Math.min(pos(s.minijob) * 0.2, 510)
    );
    const ermaessigung = Math.min(erm35a, tarifSteuer);
    const est = r2(tarifSteuer - ermaessigung + (freibetragGuenstiger ? kindergeld : 0));

    // 7. Zuschlagsteuern (Bemessung immer mit Kinderfreibeträgen)
    const bemessung = Math.max(0, stMit - Math.min(erm35a, stMit));
    const soliFest = soli(jahr, bemessung, splitting);
    const kistSatz = n(s.kistSatz) / 100;
    const mitglieder = personen.filter((p) => p.kirche);
    let kistAnteil = 0;
    if (mitglieder.length === personen.length) kistAnteil = 1;
    else if (mitglieder.length > 0) {
      const summe = pers.reduce((a, p) => a + Math.max(0, p.einkuenfte), 0);
      const eigene = personen.reduce((a, p, i) => a + (p.kirche ? Math.max(0, pers[i].einkuenfte) : 0), 0);
      kistAnteil = summe > 0 ? eigene / summe : 0.5;
    }
    const kistFest = r2(bemessung * kistSatz * kistAnteil);

    // 8. Abrechnung
    const gezahlt = {
      lohnsteuer: r2(personen.reduce((a, p) => a + pos(p.lohnsteuer), 0)),
      soli: r2(personen.reduce((a, p) => a + pos(p.soli), 0)),
      kist: r2(kistGezahlt),
      vorauszahlungen: pos(s.vorauszahlungen),
    };
    const summeGezahlt = r2(gezahlt.lohnsteuer + gezahlt.soli + gezahlt.kist + gezahlt.vorauszahlungen + kap.einbehalten);
    const summeFest = r2(est + soliFest + kistFest + kap.steuer + kap.soli);
    const erstattung = r2(summeGezahlt - summeFest);
    const bruttoGesamt = pers.reduce((a, p) => a + p.brutto, 0);

    return {
      jahr, splitting, kinder, pers, weitere, vermietung: v, veraeusserung: so, kapital: kap,
      mehrjaehrig, ausbildung, summeEinkuenfte, entlastung, gde,
      altersvorsorge, krankenvorsorge, vorsorge,
      kistGezahlt, spenden, betreuung, sonderTatsaechlich, sonderausgaben,
      agbKosten, zumutbar, agb, einkommen,
      kfb, kindergeld, freibetragGuenstiger, zvE, lohnersatz: le,
      tarifSteuer, erm35a, ermaessigung, est, soli: soliFest, kist: kistFest,
      gezahlt, summeGezahlt, summeFest, erstattung,
      durchschnittssteuersatz: zvE > 0 ? (tarifSteuer - ermaessigung) / zvE : 0,
      hatEingaben: bruttoGesamt > 0 || weitere !== 0 || v.vorhanden || so.vorhanden || kap.vorhanden,
    };
  }

  return { JAHRE, K, grundtarif, tarif, mitFuenftel, vermietung, veraeusserung, kapital, soli, zumutbareBelastung, werbungskosten, berechne, zahl: n };
});
