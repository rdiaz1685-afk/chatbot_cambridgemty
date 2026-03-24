const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'src/lib/automation/innovat-agent.ts');
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/\r\n/g, '\n');

// Find the boundaries of the PASO 2 block (updated markers from current file)
const startMarker = '      // Esperar a que Innovat cargue las opciones del formato via AJAX';
const endMarker   = '\n\n      // PASO 4:';

const startIdx = content.indexOf(startMarker);
const endIdx   = content.indexOf(endMarker, startIdx);

if (startIdx === -1 || endIdx === -1) {
  // Try alternative markers
  const alt1 = content.indexOf('// PASO 2: Seleccionar formato');
  console.log('alt1:', alt1);
  const step2start = content.indexOf('      // PASO 2:');
  console.log('step2start:', step2start);
  console.log('endMarker idx:', content.indexOf(endMarker));
  process.exit(1);
}

const before = content.substring(0, startIdx);
const after   = content.substring(endIdx); // keep the "\n\n      // PASO 4:" part

const newBlock = `      // PASO 2: Seleccionar formato de ficha
      console.log('[InnovatAgent] Paso 2: Seleccionando formato (' + conceptoId + ')...');
      const mes = conceptoId ? this.extraerMes(conceptoId) : (() => {
          const mList = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
          return mList[new Date().getMonth()];
      })();

      // Extraer tipo y mes
      const mesClean2 = mes.toLowerCase().replace(/-/g, ' ').replace(/\\([^)]*\\)/g, '');
      const mesParts2 = mesClean2.split(/\\s+/).filter((k: string) => k.length > 2);
      const tipoK = mesParts2[0] || '';
      const mesK  = mesParts2[mesParts2.length - 1] || '';
      console.log('[InnovatAgent] tipo="' + tipoK + '" mes="' + mesK + '"');

      // DIAGNOSTICO extendido
      const diagInfo = await page.evaluate(() => {
          const selects = Array.from(document.querySelectorAll('select')).map((s, i) => ({
              i, id: s.id, name: s.name, optsCount: s.options.length,
              firstOpts: Array.from(s.options).slice(0, 3).map(o => o.text)
          }));
          const s2any = Array.from(document.querySelectorAll('[class*="select2"]')).map(el => ({
              tag: el.tagName, cls: el.className.substring(0, 60)
          })).slice(0, 8);
          return { selects, s2any };
      });
      console.log('[InnovatAgent] DIAG selects:', JSON.stringify(diagInfo.selects));
      console.log('[InnovatAgent] DIAG select2-any:', JSON.stringify(diagInfo.s2any));

      // ESTRATEGIA: Las opciones del formato cargan CUANDO SE ABRE el dropdown (AJAX on demand).
      // 1. Encontrar y abrir el dropdown de formato
      // 2. Esperar a que aparezcan las opciones
      // 3. Click en la opcion correcta

      // El dropdown de formato es el que tiene clase select2 y esta vacio (no tiene el nombre del alumno)
      // O es el segundo <select> en la pagina

      // Paso A: Encontrar y clickear el dropdown de formato
      let formatOpened = false;

      // Intento 1: Buscar contenedor Select2 con texto vacio o corto
      const openedViaSelect2 = await page.evaluate(() => {
          // Buscar todos los elementos que parecen dropdowns Select2 (varios patrones de clases)
          const candidates = [
              ...Array.from(document.querySelectorAll('.select2-container')),
              ...Array.from(document.querySelectorAll('[class*="select2-container"]')),
          ];
          const uniqueCandidates = Array.from(new Set(candidates));
          const visible = uniqueCandidates.filter(c => (c as HTMLElement).offsetParent !== null);
          console.log('select2 candidates visible:', visible.length);
          const fmtContainer = visible.find(c => {
              // El de formato tiene texto vacio o muy corto (no el nombre del alumno)
              const chosenText = (
                  c.querySelector('.select2-chosen') as HTMLElement ||
                  c.querySelector('.select2-selection__rendered') as HTMLElement
              )?.innerText?.trim() || '';
              return chosenText.length === 0 || chosenText.length < 10;
          });
          if (fmtContainer) {
              const clickTarget = (
                  fmtContainer.querySelector('.select2-choice') ||
                  fmtContainer.querySelector('.select2-selection') ||
                  fmtContainer as HTMLElement
              ) as HTMLElement;
              clickTarget.click();
              return 'clicked:' + fmtContainer.className.substring(0, 40);
          }
          return false;
      });
      console.log('[InnovatAgent] Select2 open attempt:', openedViaSelect2);
      if (openedViaSelect2) {
          await this.browser.wait(800);
          formatOpened = true;
      }

      // Intento 2: Click en el segundo <select> visible (si no habia Select2 containers)
      if (!formatOpened) {
          const s2 = page.locator('select').nth(1);
          if (await s2.isVisible({ timeout: 1000 }).catch(() => false)) {
              await s2.click({ force: true });
              await this.browser.wait(800);
              formatOpened = true;
              console.log('[InnovatAgent] Clicked second <select> directly');
          }
      }

      // Paso B: Esperar a que aparezcan las opciones del dropdown
      if (formatOpened) {
          // Esperar resultados select2 o options del select
          const resultsAppeared = await Promise.race([
              page.waitForSelector('.select2-results li', { timeout: 6000 }).then(() => 'select2-results'),
              page.waitForSelector('.select2-results__option', { timeout: 6000 }).then(() => 'select2-results__option'),
          ]).catch(() => null);
          console.log('[InnovatAgent] resultados dropdown: ' + resultsAppeared);

          if (resultsAppeared) {
              // Paso C: Iterar opciones y hacer click en la correcta
              const resultItems = page.locator('.select2-results li, .select2-results__option');
              const itemCount = await resultItems.count().catch(() => 0);
              console.log('[InnovatAgent] items en dropdown: ' + itemCount);
              let clicked = false;

              for (let ii = 0; ii < itemCount; ii++) {
                  const item = resultItems.nth(ii);
                  const txt = ((await item.textContent().catch(() => '')) || '').toLowerCase();
                  const ok = (mesK ? txt.includes(mesK) : true)
                           && !txt.includes('anual');
                  console.log('[InnovatAgent] item[' + ii + ']: "' + txt + '" ok=' + ok);
                  if (ok && txt.length > 1) {
                      await item.click({ force: true });
                      await this.browser.wait(400);
                      console.log('[InnovatAgent] ✅ Formato click: "' + txt + '"');
                      clicked = true;
                      break;
                  }
              }

              if (!clicked) {
                  console.warn('[InnovatAgent] ⚠️ No se encontro opcion correcta, cerrando...');
                  await page.keyboard.press('Escape');
                  await this.browser.wait(300);
              }
          } else {
              // No aparecieron resultados en formato Select2 - intentar con native select options
              console.warn('[InnovatAgent] ⚠️ No aparecio dropdown Select2, intentando native select...');

              // Esperar que el segundo select tenga opciones
              await page.waitForFunction(() => {
                  const sels = document.querySelectorAll('select');
                  return sels.length > 1 && (sels[1] as HTMLSelectElement).options.length > 1;
              }, { timeout: 6000 }).catch(() => null);

              const s2Opts = await page.evaluate(() => {
                  const sel = document.querySelectorAll('select')[1] as HTMLSelectElement;
                  if (!sel) return [];
                  return Array.from(sel.options).map(o => ({ t: o.text, v: o.value }));
              });
              console.log('[InnovatAgent] select[1] options after click:', JSON.stringify(s2Opts));

              const bestV = s2Opts.find((o: { t: string; v: string }) => {
                  const t = o.t.toLowerCase();
                  return (mesK ? t.includes(mesK) : true) && !t.includes('anual');
              });
              if (bestV) {
                  await page.evaluate(({ idx, val }: { idx: number; val: string }) => {
                      const sel = document.querySelectorAll('select')[idx] as HTMLSelectElement;
                      if (sel) {
                          sel.value = val;
                          sel.dispatchEvent(new Event('change', { bubbles: true }));
                          const jq = (window as any).$ || (window as any).jQuery;
                          if (jq) jq(sel).trigger('change');
                      }
                  }, { idx: 1, val: bestV.v });
                  console.log('[InnovatAgent] Native select set: "' + bestV.t + '"');
                  await this.browser.wait(400);
              }
          }
      } else {
          console.warn('[InnovatAgent] ⚠️ No se pudo abrir el dropdown de formato');
      }
      await this.browser.wait(300);`;

fs.writeFileSync(file, before + newBlock + after, 'utf8');
console.log('SUCCESS: PASO 2 replaced. startIdx=' + startIdx + ' endIdx=' + endIdx);
